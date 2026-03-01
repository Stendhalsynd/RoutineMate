#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-preview}"

if ! command -v eas >/dev/null 2>&1; then
  echo "[FAIL] eas CLI is not installed. Run: npm i -g eas-cli"
  exit 1
fi

if [[ -z "${EXPO_TOKEN:-}" ]]; then
  echo "[FAIL] Missing env: EXPO_TOKEN"
  exit 1
fi

if [[ -z "${EAS_PROJECT_ID:-}" ]]; then
  echo "[WARN] EAS_PROJECT_ID is empty. Ensure app is linked to EAS project."
fi

echo "[INFO] Building Android APK with profile=${PROFILE}"
cd "$(dirname "$0")/.."
eas build --platform android --profile "${PROFILE}" --non-interactive
