import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

type FirebaseAdminConfig = {
  projectId: string;
  storageBucket?: string;
  clientEmail?: string;
  privateKey?: string;
};

function readRequiredEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required Firebase environment variable: ${key}`);
  }
  return value;
}

function normalizePrivateKey(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.replace(/\\n/g, "\n");
}

export function getFirebaseAdminConfig(): FirebaseAdminConfig {
  const projectId = readRequiredEnv("FIREBASE_PROJECT_ID");
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  return {
    projectId,
    ...(storageBucket ? { storageBucket } : {}),
    ...(clientEmail ? { clientEmail } : {}),
    ...(privateKey ? { privateKey } : {})
  };
}

export function getFirebaseAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  const config = getFirebaseAdminConfig();
  const runningWithEmulator = !!process.env.FIRESTORE_EMULATOR_HOST || !!process.env.FIREBASE_AUTH_EMULATOR_HOST;

  if (config.clientEmail && config.privateKey) {
    return initializeApp({
      credential: cert({
        projectId: config.projectId,
        clientEmail: config.clientEmail,
        privateKey: config.privateKey
      }),
      projectId: config.projectId,
      ...(config.storageBucket ? { storageBucket: config.storageBucket } : {})
    });
  }

  if (runningWithEmulator) {
    return initializeApp({
      projectId: config.projectId,
      ...(config.storageBucket ? { storageBucket: config.storageBucket } : {})
    });
  }

  throw new Error(
    "Firebase admin credentials are not configured. Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or use the Firestore/Auth emulators."
  );
}

export function getFirebaseAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminFirestore(): Firestore {
  return getFirestore(getFirebaseAdminApp());
}
