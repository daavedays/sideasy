/**
 * Firebase Configuration
 * 
 * This file contains the Firebase client-side configuration for the Sideasy Scheduler app.
 * It initializes Firebase services including Authentication, Firestore, and Storage.
 * 
 * Location: src/config/firebase.ts
 * Purpose: Centralized Firebase client configuration
 * 
 * Note: This is a client-side configuration. For server-side operations,
 * use Firebase Admin SDK with environment variables.
 */

/// <reference types="vite/client" />

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase configuration object from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Export the app instance for any additional configurations
export default app;

