# 2026-04-14 S7-2 Firestore Schema And Migration

## todo
- [x] Write `spec/S7-2.md`
- [x] Add failing tests for Firestore schema helpers and migration parity
- [x] Add shared Firestore schema utilities
- [x] Add server/admin Firebase helper for scripts
- [x] Add Notion export + migration planning utilities
- [x] Add `scripts/migrate-notion-to-firestore.ts`
- [x] Verify tests and type checks
- [ ] Run code review gate

## doing
- Review gate pending

## done
- Created the S7-2 schema and migration spec
- Created the S7-2 progress log
- Added Firestore schema/admin helpers
- Added Notion export + migration planning modules
- Added dry-run capable migration script and migration docs
- Verified migration tests, workspace unit tests, and type checks

## verification
- `node --test --import tsx tests/unit/firestore-migration.test.ts`
- `npm run test:unit`
- `npm run typecheck`

## risks
- Existing legacy `userId` values do not yet equal Firebase Auth `uid`, so cutover will require a follow-up identity bridge in `S7-3`
- Optional Notion databases may be absent in some environments and the migration tooling must degrade gracefully
