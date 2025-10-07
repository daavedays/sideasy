import { USER_ROLES, UserRole } from '../../config/appConfig';

/**
 * Role Utilities
 * 
 * Helper functions for role-based access control.
 * Provides role checking and permission utilities.
 * 
 * Location: src/lib/auth/roles.ts
 * Purpose: Role-based access control utilities
 */

export const canManageUsers = (role: UserRole): boolean => {
  return role === USER_ROLES.DEVELOPER || role === USER_ROLES.OWNER || role === USER_ROLES.ADMIN;
};

export const canManageSchedules = (role: UserRole): boolean => {
  return role === USER_ROLES.DEVELOPER || role === USER_ROLES.OWNER || role === USER_ROLES.ADMIN;
};

export const canManageDepartments = (role: UserRole): boolean => {
  return role === USER_ROLES.DEVELOPER || role === USER_ROLES.OWNER;
};

export const canApproveUsers = (role: UserRole): boolean => {
  return role === USER_ROLES.DEVELOPER || role === USER_ROLES.OWNER || role === USER_ROLES.ADMIN;
};

export const canViewStatistics = (role: UserRole): boolean => {
  return role === USER_ROLES.DEVELOPER || role === USER_ROLES.OWNER || role === USER_ROLES.ADMIN;
};

export const getRoleDisplayName = (role: UserRole): string => {
  const roleNames: Record<UserRole, string> = {
    developer: 'מפתח',
    owner: 'בעלים',
    admin: 'מנהל',
    worker: 'עובד'
  };
  return roleNames[role] || role;
};

export const getRoleLevel = (role: UserRole): number => {
  const roleLevels: Record<UserRole, number> = {
    developer: 4,
    owner: 3,
    admin: 2,
    worker: 1
  };
  return roleLevels[role] || 0;
};

export const hasHigherRole = (role1: UserRole, role2: UserRole): boolean => {
  return getRoleLevel(role1) > getRoleLevel(role2);
};

