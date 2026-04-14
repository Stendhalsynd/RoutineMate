process.env.ROUTINEMATE_REPO_MODE = "memory";

const prefixesToClear = [
  "NOTION_",
  "FIREBASE_",
  "FIRESTORE_",
  "NEXT_PUBLIC_FIREBASE_",
  "EXPO_PUBLIC_FIREBASE_"
];

for (const key of Object.keys(process.env)) {
  if (prefixesToClear.some((prefix) => key.startsWith(prefix))) {
    delete process.env[key];
  }
}

process.env.GOOGLE_ANDROID_CLIENT_ID = "test-android-client-id";
process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = "test-android-client-id";
process.env.GOOGLE_WEB_CLIENT_ID = "test-web-client-id";
process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID = "test-web-client-id";
process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = "test-web-client-id";
