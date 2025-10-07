import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { auth } from '../config/firebase';

/**
 * Authentication Context
 * 
 * Provides Firebase authentication state and methods throughout the app.
 * Manages user login, logout, and registration.
 * 
 * Location: src/context/AuthContext.tsx
 * Purpose: Global authentication state management
 */

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string): Promise<User> => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const value: AuthContextType = {
    currentUser,
    loading,
    signIn,
    signUp,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;

