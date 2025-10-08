import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleBasedRoute } from './RoleBasedRoute';
import { USER_ROLES } from '../config/appConfig';

// Pages
import AuthPage from '../pages/login/AuthPage';
import DeveloperRouter from '../pages/developer/DeveloperRouter';
import OwnerRouter from '../pages/owner/OwnerRouter';
import { AdminRouter } from '../pages/admin';

/**
 * App Router
 * 
 * Main routing configuration for the application.
 * Handles all route definitions and access control.
 * 
 * Location: src/routes/AppRouter.tsx
 * Purpose: Centralized routing configuration
 */

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<AuthPage />} />
      <Route path="/login" element={<AuthPage />} />

      {/* Role-Based Routes */}
      <Route
        path="/developer/*"
        element={
          <ProtectedRoute>
            <RoleBasedRoute allowedRoles={[USER_ROLES.DEVELOPER]}>
              <DeveloperRouter />
            </RoleBasedRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/owner/*"
        element={
          <ProtectedRoute>
            <RoleBasedRoute allowedRoles={[USER_ROLES.OWNER]}>
              <OwnerRouter />
            </RoleBasedRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/*"
        element={
          <ProtectedRoute>
            <RoleBasedRoute allowedRoles={[USER_ROLES.ADMIN]}>
              <AdminRouter />
            </RoleBasedRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/worker/*"
        element={
          <ProtectedRoute>
            <RoleBasedRoute allowedRoles={[USER_ROLES.WORKER]}>
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-white text-2xl">Worker Dashboard (Coming Soon)</div>
              </div>
            </RoleBasedRoute>
          </ProtectedRoute>
        }
      />

      {/* Catch all - redirect to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default AppRouter;

