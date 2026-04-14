# 2026-04-14 S7-7 Design Foundation

## todo
- [x] Write `spec/S7-7.md`
- [x] Add `DESIGN.md`
- [x] Expand shared UI tokens for Neo Brutalism
- [x] Align web global styles with the documented palette and frame system
- [ ] Run code review gate

## doing
- Review gate pending

## done
- Added `DESIGN.md` as the primary visual contract
- Updated `packages/ui` tokens for brutalist color, spacing, border, and shadow semantics
- Updated web global CSS to use the new palette, borders, and offset shadows

## verification
- `npm run typecheck`
- `npm run build --workspace @routinemate/web`

## risks
- Mobile visual changes currently come mostly from shared tokens; full component-level redesign is still pending
