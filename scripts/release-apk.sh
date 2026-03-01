#!/usr/bin/env bash
set -euo pipefail

TAG="${1:-}"
APK_PATH="${2:-}"
TITLE="${3:-RoutineMate Android APK}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "$TAG" || -z "$APK_PATH" ]]; then
  echo "Usage: $0 <tag> <apk_path> [title]"
  exit 1
fi

if [[ ! -f "$APK_PATH" ]]; then
  echo "[FAIL] APK not found: $APK_PATH"
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "[FAIL] gh CLI is not installed"
  exit 1
fi

if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  export GH_TOKEN="$GITHUB_TOKEN"
fi

NOTES_FILE="${ROOT_DIR}/dist/releases/routinemate_${TAG}_release_notes.md"
mkdir -p "$(dirname "$NOTES_FILE")"
node "${ROOT_DIR}/scripts/generate-release-notes.mjs" "$TAG" "$NOTES_FILE"
cat >> "$NOTES_FILE" <<NOTE
- APK: ${APK_PATH}
NOTE

if gh release view "$TAG" >/dev/null 2>&1; then
  gh release upload "$TAG" "$APK_PATH" --clobber
else
  gh release create "$TAG" "$APK_PATH" --title "$TITLE" --notes-file "$NOTES_FILE"
fi

echo "[PASS] Uploaded APK to GitHub release: $TAG"
