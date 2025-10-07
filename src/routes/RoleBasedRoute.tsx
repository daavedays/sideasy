import React from 'react';
import { Navigate } from 'react-router-dom';
import { useRoleContext } from '../context/RoleContext';
import { UserRole } from '../config/appConfig';

/**
 * Role-Based Route Component
 * 
 * Wrapper component that requires specific user roles.
 * Redirects to dashboard if user doesn't have required role.
 * 
 * Location: src/routes/RoleBasedRoute.tsx
 * Purpose: Role-based access control for routes
 */

interface RoleBasedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  requireApproval?: boolean;
}

export const RoleBasedRoute: React.FC<RoleBasedRouteProps> = ({ 
  children, 
  allowedRoles,
  requireApproval = true 
}) => {
  const { userRole, isApproved, loading } = useRoleContext();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="text-white text-2xl">טוען...</div>
      </div>
    );
  }

  // Check if user has required role
  if (!userRole || !allowedRoles.includes(userRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Check approval status if required
  if (requireApproval && !isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">ממתין לאישור</h2>
          <p className="text-white/80">חשבונך ממתין לאישור מהמנהל. אנא המתן...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default RoleBasedRoute;

