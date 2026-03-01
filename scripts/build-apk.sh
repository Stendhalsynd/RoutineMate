#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-preview}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE_DIR="${ROOT_DIR}/apps/mobile"
ANDROID_DIR="${MOBILE_DIR}/android"
APK_DIST_DIR="${ROOT_DIR}/dist/apk"

if ! command -v npx >/dev/null 2>&1; then
  echo "[FAIL] npx is not installed."
  exit 1
fi

if ! command -v java >/dev/null 2>&1; then
  echo "[FAIL] java is not installed. Install JDK 17+."
  exit 1
fi

if [[ -z "${ANDROID_HOME:-}" && -z "${ANDROID_SDK_ROOT:-}" ]]; then
  echo "[FAIL] Missing Android SDK path. Set ANDROID_HOME or ANDROID_SDK_ROOT."
  exit 1
fi

if [[ ! -d "${ANDROID_DIR}" ]]; then
  echo "[INFO] Android native project not found. Running expo prebuild..."
  cd "${MOBILE_DIR}"
  npx expo prebuild --platform android --non-interactive
fi

ensure_expo_module_gradle_plugin() {
  local plugin_dir="${ANDROID_DIR}/gradle-plugin"
  mkdir -p "${plugin_dir}/src/main/groovy" "${plugin_dir}/src/main/resources/META-INF/gradle-plugins"

  cat > "${plugin_dir}/build.gradle" <<'EOF'
plugins {
    id 'groovy-gradle-plugin'
}

repositories {
    google()
    mavenCentral()
}

dependencies {
    implementation localGroovy()
}

gradlePlugin {
    plugins {
        expoModuleGradlePlugin {
            id = 'expo-module-gradle-plugin'
            implementationClass = 'ExpoModuleGradlePlugin'
        }
    }
}
EOF

  cat > "${plugin_dir}/src/main/groovy/ExpoModuleGradlePlugin.groovy" <<'EOF'
import org.gradle.api.GradleException
import org.gradle.api.Plugin
import org.gradle.api.Project

class ExpoModuleGradlePlugin implements Plugin<Project> {
    @Override
    void apply(Project project) {
        def candidatePaths = [
                new File(project.rootProject.projectDir, "../node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle"),
                new File(project.rootProject.projectDir, "node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle"),
                new File(project.rootDir, "node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle")
        ]

        def pluginScript = candidatePaths.find { it.exists() } as File

        if (pluginScript == null) {
            throw new GradleException("Missing ExpoModulesCorePlugin.gradle. Checked paths: ${candidatePaths*.absolutePath}")
        }

        project.apply from: pluginScript
    }
}
EOF

  cat > "${plugin_dir}/src/main/resources/META-INF/gradle-plugins/expo-module-gradle-plugin.properties" <<'EOF'
implementation-class=ExpoModuleGradlePlugin
EOF

  local settings_file="${ANDROID_DIR}/settings.gradle"
  python3 - "$settings_file" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()
needle = "    includeBuild(new File(rootDir, 'gradle-plugin'))"

if "pluginManagement {" not in text:
    raise SystemExit("settings.gradle missing pluginManagement block.")

lines = text.splitlines()
seen = False
filtered = []
for line in lines:
    if line.strip() == needle.strip():
        if seen:
            continue
        seen = True
    filtered.append(line)
text = "\n".join(filtered) + "\n"

if needle not in text:
    marker = "pluginManagement {"
    idx = text.find(marker)
    if idx == -1:
        raise SystemExit("Could not locate pluginManagement block.")
    insert_at = idx + len(marker)
    text = text.replace(
        marker,
        "pluginManagement {\n" + needle + "\n",
        1,
    )
else:
    # ensure a single declaration and keep ordering.
    if text.count(needle) > 1:
        # remove any extra declarations (kept only first occurrence)
        first_index = text.find(needle)
        while True:
            second_index = text.find(needle, first_index + len(needle))
            if second_index == -1:
                break
            text = text[:second_index] + text[second_index + len(needle):]

path.write_text(text)
PY
}

ensure_expo_module_gradle_plugin

GRADLE_TASK=""
APK_SRC=""
OUTPUT_LABEL=""

case "${PROFILE}" in
  preview|debug)
    GRADLE_TASK="assembleDebug"
    APK_SRC="${ANDROID_DIR}/app/build/outputs/apk/debug/app-debug.apk"
    OUTPUT_LABEL="preview"
    ;;
  release)
    GRADLE_TASK="assembleRelease"
    APK_SRC="${ANDROID_DIR}/app/build/outputs/apk/release/app-release.apk"
    OUTPUT_LABEL="release"
    ;;
  *)
    echo "[FAIL] Unsupported profile: ${PROFILE}. Use preview|debug|release."
    exit 1
    ;;
esac

echo "[INFO] Building Android APK locally with Gradle task=${GRADLE_TASK}"
cd "${ANDROID_DIR}"
./gradlew --no-daemon "${GRADLE_TASK}"

if [[ ! -f "${APK_SRC}" && "${PROFILE}" == "release" ]]; then
  if [[ -f "${ANDROID_DIR}/app/build/outputs/apk/release/app-release-unsigned.apk" ]]; then
    APK_SRC="${ANDROID_DIR}/app/build/outputs/apk/release/app-release-unsigned.apk"
  fi
fi

if [[ ! -f "${APK_SRC}" ]]; then
  echo "[FAIL] APK output not found: ${APK_SRC}"
  exit 1
fi

mkdir -p "${APK_DIST_DIR}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
APK_DEST="${APK_DIST_DIR}/routinemate-${OUTPUT_LABEL}-${TIMESTAMP}.apk"
cp "${APK_SRC}" "${APK_DEST}"
echo "[PASS] APK built: ${APK_DEST}"
