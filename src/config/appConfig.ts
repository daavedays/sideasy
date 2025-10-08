/**
 * Application Configuration
 * 
 * Centralized configuration for Firestore collections, app constants,
 * and other application-wide settings.
 * 
 * Location: src/config/appConfig.ts
 * Purpose: Application constants and configuration
 */

// Firestore Collection Names
export const COLLECTIONS = {
  USERS: 'users',
  DEPARTMENTS: 'departments',
  SCHEDULES: 'schedules',
  SHIFTS: 'shifts',
  NOTIFICATIONS: 'notifications'
} as const;

// User Roles
export const USER_ROLES = {
  DEVELOPER: 'developer',
  OWNER: 'owner',
  ADMIN: 'admin',
  WORKER: 'worker'
} as const;

// User Status
export const USER_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended'
} as const;

// Shift Types
export const SHIFT_TYPES = {
  MORNING: 'morning',
  AFTERNOON: 'afternoon',
  EVENING: 'evening',
  NIGHT: 'night'
} as const;

// Qualification Levels
export const QUALIFICATION_LEVELS = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4
} as const;

// App Settings
export const APP_SETTINGS = {
  APP_NAME: 'Sideasy',
  APP_TAGLINE: 'סידור עבודה בקליק',
  DEFAULT_LOCALE: 'he',
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  SUPPORTED_IMAGE_FORMATS: ['image/jpeg', 'image/png', 'image/webp']
} as const;

// Route Paths
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  DEVELOPER: '/developer',
  OWNER: '/owner',
  ADMIN: '/admin',
  WORKER: '/worker'
} as const;

// Export types for TypeScript
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
export type UserStatus = typeof USER_STATUS[keyof typeof USER_STATUS];
export type ShiftType = typeof SHIFT_TYPES[keyof typeof SHIFT_TYPES];
export type QualificationLevel = typeof QUALIFICATION_LEVELS[keyof typeof QUALIFICATION_LEVELS];

