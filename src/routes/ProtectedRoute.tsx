import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Protected Route Component
 * 
 * Wrapper component that requires authentication.
 * Redirects to login if user is not authenticated.
 * 
 * Location: src/routes/ProtectedRoute.tsx
 * Purpose: Authentication guard for routes
 */

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="text-white text-2xl">טוען...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

