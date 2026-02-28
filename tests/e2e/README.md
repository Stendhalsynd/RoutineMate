# RoutineMate E2E Scenario Skeleton

This folder defines skeleton coverage for the first 10 Android-focused E2E scenarios.

## Required Scenarios

1. Launch app to quick-log-first home screen.
2. Tap quick log action and confirm entry sheet opens.
3. Save quick log entry and verify card count increments.
4. Cancel quick log action and verify no progress mutation.
5. View hydration card progress bar percent text.
6. View focus sessions card progress bar percent text.
7. Complete a fully done card and show 100 percent complete.
8. Handle empty day state and render onboarding hint.
9. Reopen app and preserve previously logged progress.
10. Recover from failed log submission with retry message.

Use `scenarios.spec.ts` as the first placeholder test suite.
