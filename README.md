# RoutineMate

RoutineMate is a monorepo for a quick-log-first fitness routine product.

## Apps

- `apps/web`: Next.js dashboard + API routes for routine logging.
- `apps/mobile`: Expo React Native app for Android-focused quick entry.

## Packages

- `packages/domain`: Shared types and scoring logic.
- `packages/api-contract`: Zod request/query contracts.
- `packages/ui`: Shared design tokens.

## Development

```bash
npm install
npm run typecheck
npm run test
```

## TDD Workflow

1. Write/adjust `spec/<TASK-ID>.md` with Given/When/Then.
2. Add failing tests first.
3. Implement minimum code to pass.
4. Refactor with regression checks.
