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
