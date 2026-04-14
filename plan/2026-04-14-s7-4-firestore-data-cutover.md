# 2026-04-14 S7-4 Firestore Data Repository Cutover

## todo
- [x] Write `spec/S7-4.md`
- [x] Add Firestore data repository helpers
- [x] Compose the runtime `repo` with Firestore data overrides
- [x] Verify existing workspace tests still pass
- [ ] Run code review gate

## doing
- Code review gate is pending while the Firestore-backed data mode is stabilized behind env-driven activation

## done
- Added `apps/web/src/lib/firestore-data-repository.ts`
- Composed `repo` to keep legacy auth/session methods while delegating record/settings CRUD to Firestore when enabled
- Verified workspace tests, root type checks, and web production build still pass

## verification
- `npm run test --workspaces --if-present`
- `npm run typecheck`
- `npm run build --workspace @routinemate/web`

## risks
- Firestore mode is implemented but not yet activated in local `.env` because Firebase credentials are not configured in this workspace
- Auth/session reads still use the legacy path until `S7-3` is completed
