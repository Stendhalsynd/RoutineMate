# RoutineMate Firestore Migration

## Goal
- Export existing Notion-backed RoutineMate data into the new Firestore shape before the runtime data layer switches over.

## Commands
- Dry run all users: `npm run firestore:migrate:notion:dry-run`
- Dry run one legacy user: `npm run firestore:migrate:notion:dry-run -- --user user_123`
- Execute migration: `npm run firestore:migrate:notion`

## Required Environment
- Firebase admin:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`
- Notion source:
  - `NOTION_TOKEN`
  - `NOTION_DB_SESSIONS`
  - `NOTION_DB_MEALS`
  - `NOTION_DB_WORKOUTS`
  - `NOTION_DB_BODY_METRICS`
  - `NOTION_DB_GOALS`
- Optional Notion source DBs:
  - `NOTION_DB_MEAL_TEMPLATES`
  - `NOTION_DB_WORKOUT_TEMPLATES`
  - `NOTION_DB_REMINDER_SETTINGS`

## Firestore Shape
- User root: `users/{legacyUserId}`
- Embedded session summary lives on the user document to preserve legacy session ownership before `S7-3` identity bridging.
- Subcollections:
  - `mealLogs`
  - `mealCheckins`
  - `workoutLogs`
  - `bodyMetrics`
  - `goals`
  - `mealTemplates`
  - `workoutTemplates`
  - `reminderSettings`

## Notes
- `mealLogs` and `mealCheckins` are separated during export because the current Notion `Meals` database stores both record styles.
- Dry run prints a parity summary so we can confirm source counts before writing anything.
- `S7-3` will bridge legacy `userId` values to Firebase-authenticated identities during cutover.
