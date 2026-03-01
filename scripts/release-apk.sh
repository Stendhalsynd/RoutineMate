#!/usr/bin/env bash
set -euo pipefail

TAG="${1:-}"
APK_PATH="${2:-}"
TITLE="${3:-RoutineMate Android APK}"

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

NOTES_FILE="/tmp/routinemate_release_notes_${TAG}.md"
cat > "$NOTES_FILE" <<NOTE
# ${TITLE}

- Web canonical: https://routinemate-kohl.vercel.app
- Android APK attached
NOTE

if gh release view "$TAG" >/dev/null 2>&1; then
  gh release upload "$TAG" "$APK_PATH" --clobber
else
  gh release create "$TAG" "$APK_PATH" --title "$TITLE" --notes-file "$NOTES_FILE"
fi

echo "[PASS] Uploaded APK to GitHub release: $TAG"
