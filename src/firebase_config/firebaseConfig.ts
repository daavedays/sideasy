/**
 * Firebase Configuration
 * 
 * This file contains the Firebase client-side configuration for the Sideasy Scheduler app.
 * It initializes Firebase services including Authentication, Firestore, and Storage.
 * 
 * Location: src/config/firebaseConfig.ts
 * Purpose: Centralized Firebase client configuration
 * 
 * Note: This is a client-side configuration. For server-side operations,
 * use Firebase Admin SDK with environment variables.
 */

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase configuration object
const firebaseConfig = {
  apiKey: "AIzaSyBEQ_gF71uyIgn3EcSHKDqS5ZYV-bcTF08",
  authDomain: "sideasy-scheduler.firebaseapp.com",
  projectId: "sideasy-scheduler",
  storageBucket: "sideasy-scheduler.firebasestorage.app",
  messagingSenderId: "979982395669",
  appId: "1:979982395669:web:ae6a41bbdc6f80288de11c"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Export the app instance for any additional configurations
export default app;

