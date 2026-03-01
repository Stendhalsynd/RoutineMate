#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-preview}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE_DIR="${ROOT_DIR}/apps/mobile"
ANDROID_DIR="${MOBILE_DIR}/android"
APK_DIST_DIR="${ROOT_DIR}/dist/apk"

load_dotenv() {
  local env_file="${ROOT_DIR}/.env"
  if [[ ! -f "${env_file}" ]]; then
    return
  fi

  set -a
  # shellcheck disable=SC1091
  source "${env_file}"
  set +a

  if [[ -z "${EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID:-}" && -n "${GOOGLE_ANDROID_CLIENT_ID:-}" ]]; then
    export EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID="${GOOGLE_ANDROID_CLIENT_ID}"
  fi

  if [[ -z "${EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID:-}" && -n "${GOOGLE_WEB_CLIENT_ID:-}" ]]; then
    export EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID="${GOOGLE_WEB_CLIENT_ID}"
  fi
}

load_dotenv

if [[ -z "${EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID:-}" ]]; then
  echo "[WARN] EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID is not set. Android google login will be unavailable."
fi

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
  local plugin_dir_old="${ANDROID_DIR}/gradle-plugin"
  local plugin_dir="${ANDROID_DIR}/expo-module-gradle-plugin"

  # avoid includeBuild name conflicts with React Native's gradle-plugin directory
  if [[ -d "${plugin_dir_old}" ]]; then
    rm -rf "${plugin_dir_old}"
  fi
  mkdir -p "${plugin_dir}/src/main/groovy" "${plugin_dir}/src/main/resources/META-INF/gradle-plugins"

  cat > "${plugin_dir}/build.gradle" <<'EOF'
plugins {
    id 'groovy-gradle-plugin'
}

tasks.named('processResources').configure {
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
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
                new File(project.rootDir, "node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle"),
                new File(project.rootProject.projectDir.parentFile.parentFile, "node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle"),
                new File(project.rootProject.projectDir.parentFile.parentFile.parentFile, "node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle")
        ]

        def pluginScript = candidatePaths.find { it.exists() } as File

        if (pluginScript == null) {
            throw new GradleException("Missing ExpoModulesCorePlugin.gradle. Checked paths: ${candidatePaths*.absolutePath}")
        }

        project.apply from: pluginScript
    }
}
EOF

  # `gradlePlugin` DSL in this project already generates this file.
  # Keep only generated marker to avoid duplicate resource collisions.
  rm -f "${plugin_dir}/src/main/resources/META-INF/gradle-plugins/expo-module-gradle-plugin.properties"

  local settings_file="${ANDROID_DIR}/settings.gradle"
  python3 - "$settings_file" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()

if "pluginManagement {" not in text:
    raise SystemExit("settings.gradle missing pluginManagement block.")

needle = "    includeBuild(new File(rootDir, 'expo-module-gradle-plugin'))"
lines = text.splitlines()
filtered = []
for line in lines:
    stripped = line.strip()
    if (
        "includeBuild(new File(rootDir, 'gradle-plugin')" in stripped
        or stripped == needle
    ):
        continue
    filtered.append(line)

text = "\n".join(filtered)
if needle not in text:
    marker = "pluginManagement {"
    replacement = f"{marker}\n{needle}"
    if marker not in text:
        raise SystemExit("Could not locate pluginManagement block.")
    text = text.replace(marker, replacement, 1)
text = text + "\n"

path.write_text(text)
PY
}

patch_expo_modules_core_plugin() {
  local core_plugin_file="${ROOT_DIR}/node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle"

  if [[ ! -f "${core_plugin_file}" ]]; then
    return
  fi

  if rg -n "releaseComponent = components.findByName\\(\"release\"\\)" "${core_plugin_file}" >/dev/null 2>&1; then
    return
  fi

  python3 - "${core_plugin_file}" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()

old = """          from components.release
"""
new = """          def releaseComponent = components.findByName("release")
          if (releaseComponent != null) {
            from releaseComponent
          }
"""

if old not in text:
    print("[WARN] useExpoPublishing block was not updated; pattern changed", file=sys.stderr)
    sys.exit(0)

path.write_text(text.replace(old, new, 1))
PY
}

sync_android_launcher_icons() {
  local icon_src="${MOBILE_DIR}/assets/icon.png"
  if [[ ! -f "${icon_src}" ]]; then
    echo "[WARN] Icon source not found: ${icon_src}"
    return
  fi
  if ! command -v sips >/dev/null 2>&1; then
    echo "[WARN] sips is not available. Skipping Android launcher icon sync."
    return
  fi

  # Keep launcher resources in sync with the source icon to avoid stale APK icons.
  sips -z 48 48 "${icon_src}" --out "${ANDROID_DIR}/app/src/main/res/mipmap-mdpi/ic_launcher.webp" >/dev/null
  sips -z 48 48 "${icon_src}" --out "${ANDROID_DIR}/app/src/main/res/mipmap-mdpi/ic_launcher_round.webp" >/dev/null
  sips -z 72 72 "${icon_src}" --out "${ANDROID_DIR}/app/src/main/res/mipmap-hdpi/ic_launcher.webp" >/dev/null
  sips -z 72 72 "${icon_src}" --out "${ANDROID_DIR}/app/src/main/res/mipmap-hdpi/ic_launcher_round.webp" >/dev/null
  sips -z 96 96 "${icon_src}" --out "${ANDROID_DIR}/app/src/main/res/mipmap-xhdpi/ic_launcher.webp" >/dev/null
  sips -z 96 96 "${icon_src}" --out "${ANDROID_DIR}/app/src/main/res/mipmap-xhdpi/ic_launcher_round.webp" >/dev/null
  sips -z 144 144 "${icon_src}" --out "${ANDROID_DIR}/app/src/main/res/mipmap-xxhdpi/ic_launcher.webp" >/dev/null
  sips -z 144 144 "${icon_src}" --out "${ANDROID_DIR}/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.webp" >/dev/null
  sips -z 192 192 "${icon_src}" --out "${ANDROID_DIR}/app/src/main/res/mipmap-xxxhdpi/ic_launcher.webp" >/dev/null
  sips -z 192 192 "${icon_src}" --out "${ANDROID_DIR}/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.webp" >/dev/null
}

ensure_expo_module_gradle_plugin
patch_expo_modules_core_plugin
sync_android_launcher_icons

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
