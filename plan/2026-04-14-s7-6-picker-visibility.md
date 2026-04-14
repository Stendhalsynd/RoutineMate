# 2026-04-14 S7-6 Picker Visibility Fix

## todo
- [x] Write `spec/S7-6.md`
- [x] Move highlight layer behind wheel digits
- [x] Make highlight non-interactive
- [x] Add regression coverage
- [ ] Run code review gate

## doing
- Review gate pending

## done
- Added `pointerEvents="none"` to the decimal highlight overlay
- Lowered the highlight z-layer and raised the digit row z-layer
- Added a source-based regression test for picker layer ordering

## verification
- `npm run test --workspace @routinemate/mobile`
- `npm run typecheck --workspace @routinemate/mobile`

## risks
- The regression test is source-structure based, so later refactors must update it if the implementation shape changes
