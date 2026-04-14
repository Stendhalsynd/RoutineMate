import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

function readRequiredEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required Firebase environment variable: ${key}`);
  }
  return value;
}

export function getFirebaseWebConfig(): FirebaseWebConfig {
  const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim();

  return {
    apiKey: readRequiredEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: readRequiredEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: readRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: readRequiredEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: readRequiredEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: readRequiredEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
    ...(measurementId ? { measurementId } : {})
  };
}

export function getFirebaseWebApp(): FirebaseApp {
  return getApps().length > 0 ? getApp() : initializeApp(getFirebaseWebConfig());
}

export function getFirebaseWebAuth(): Auth {
  return getAuth(getFirebaseWebApp());
}

export function getFirebaseWebFirestore(): Firestore {
  return getFirestore(getFirebaseWebApp());
}
