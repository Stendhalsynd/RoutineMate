export const FIRESTORE_USER_SUBCOLLECTIONS = [
  "mealLogs",
  "mealCheckins",
  "workoutLogs",
  "bodyMetrics",
  "goals",
  "mealTemplates",
  "workoutTemplates",
  "reminderSettings"
] as const;

export type FirestoreUserSubcollection = (typeof FIRESTORE_USER_SUBCOLLECTIONS)[number];

export function userDocPath(userId: string): string {
  return `users/${userId}`;
}

export function userSubcollectionPath(
  userId: string,
  collection: FirestoreUserSubcollection
): string {
  return `${userDocPath(userId)}/${collection}`;
}

export function userSubdocumentPath(
  userId: string,
  collection: FirestoreUserSubcollection,
  documentId: string
): string {
  return `${userSubcollectionPath(userId, collection)}/${documentId}`;
}

export function isFirestoreUserSubcollection(value: string): value is FirestoreUserSubcollection {
  return (FIRESTORE_USER_SUBCOLLECTIONS as readonly string[]).includes(value);
}
