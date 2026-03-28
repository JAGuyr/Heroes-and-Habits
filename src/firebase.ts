import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigJson from '../firebase-applet-config.json';

// Helper to get environment variable with fallback and sanitization
const getEnv = (key: string, fallback: string) => {
  const value = import.meta.env[`VITE_FIREBASE_${key}`] || import.meta.env[`FIREBASE_${key}`];
  return (value && value !== 'undefined' && value !== 'null' && value !== '') ? value : fallback;
};

const firebaseConfig = {
  apiKey: getEnv('API_KEY', firebaseConfigJson.apiKey),
  authDomain: getEnv('AUTH_DOMAIN', firebaseConfigJson.authDomain),
  projectId: getEnv('PROJECT_ID', firebaseConfigJson.projectId),
  storageBucket: getEnv('STORAGE_BUCKET', firebaseConfigJson.storageBucket),
  messagingSenderId: getEnv('MESSAGING_SENDER_ID', firebaseConfigJson.messagingSenderId),
  appId: getEnv('APP_ID', firebaseConfigJson.appId),
  firestoreDatabaseId: getEnv('DATABASE_ID', firebaseConfigJson.firestoreDatabaseId || '(default)')
};

// Debug logging to verify config source (safe to leave in as it doesn't log the actual keys)
const isUsingEnv = !!(import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.FIREBASE_API_KEY);
console.log(`[Firebase] Initialized using ${isUsingEnv ? 'Environment Variables' : 'JSON Config'}`);

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export const signIn = () => signInWithPopup(auth, googleProvider);
export const logOut = () => signOut(auth);
