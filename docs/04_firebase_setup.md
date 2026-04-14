# RoutineMate Firebase Setup

## Goal
- Replace the current Notion-backed backend with Firebase Auth + Firestore while keeping web and mobile flows aligned.

## Required Files
- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`
- `.env.example`

## Environment Variables
- Web uses `NEXT_PUBLIC_FIREBASE_*`.
- Mobile uses `EXPO_PUBLIC_FIREBASE_*`.
- Server-side scripts and migrations use `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`.

## Setup Steps
1. Create a Firebase project for RoutineMate.
2. Enable `Authentication` with Anonymous and Google providers.
3. Create one web app and one Android app in Firebase console.
4. Copy the SDK values into `.env`.
5. Download Android `google-services.json` only when native Firebase services are required. Keep it untracked.
6. Start local emulators with `npm run firebase:emulators`.

## Firestore Model Direction
- User root document: `users/{uid}`
- User-scoped subcollections:
  - `mealLogs`
  - `goals`
  - `mealCheckins`
  - `workoutLogs`
  - `bodyMetrics`
  - `mealTemplates`
  - `workoutTemplates`
  - `reminderSettings`

## Notes
- Anonymous auth is the default entry flow for S7.
- Google account upgrade will use Firebase account linking rather than the current custom guest session restore flow.
- Rules in this slice are the minimum safe foundation and will become stricter once the final schema is implemented in `S7-2` and `S7-3`.
- The migration workflow is documented in `docs/05_firestore_migration.md`.
