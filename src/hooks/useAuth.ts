import { useAuthContext } from '../context/AuthContext';

/**
 * useAuth Hook
 * 
 * Custom hook that wraps Firebase Auth operations.
 * Provides easy access to authentication methods and current user state.
 * 
 * Location: src/hooks/useAuth.ts
 * Purpose: Simplified authentication hook
 */

export const useAuth = () => {
  const { currentUser, loading, signIn, signUp, signOut } = useAuthContext();

  return {
    user: currentUser,
    loading,
    signIn,
    signUp,
    signOut,
    isAuthenticated: !!currentUser
  };
};

export default useAuth;

