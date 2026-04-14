import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

type FirebaseMobileConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

function readRequiredEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required Firebase environment variable: ${key}`);
  }
  return value;
}

export function getFirebaseMobileConfig(): FirebaseMobileConfig {
  return {
    apiKey: readRequiredEnv("EXPO_PUBLIC_FIREBASE_API_KEY"),
    authDomain: readRequiredEnv("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: readRequiredEnv("EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: readRequiredEnv("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: readRequiredEnv("EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: readRequiredEnv("EXPO_PUBLIC_FIREBASE_APP_ID")
  };
}

export function getFirebaseMobileApp(): FirebaseApp {
  return getApps().length > 0 ? getApp() : initializeApp(getFirebaseMobileConfig());
}

export function getFirebaseMobileAuth(): Auth {
  return getAuth(getFirebaseMobileApp());
}

export function getFirebaseMobileFirestore(): Firestore {
  return getFirestore(getFirebaseMobileApp());
}
