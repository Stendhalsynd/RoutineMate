#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "[FAIL] Missing env: VERCEL_TOKEN"
  exit 1
fi

echo "[STEP] Notion schema check"
npm run notion:schema:check

echo "[STEP] Deploy to Vercel production"
npx vercel --prod --yes --token "$VERCEL_TOKEN"

VERIFY_URL="${PLAYWRIGHT_BASE_URL:-https://routinemate-kohl.vercel.app}"
echo "[STEP] Playwright verify: ${VERIFY_URL}"
PLAYWRIGHT_BASE_URL="$VERIFY_URL" npx playwright test --config=playwright.deploy.config.ts

echo "[DONE] deploy + verify completed"
