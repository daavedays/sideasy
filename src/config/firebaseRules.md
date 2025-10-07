# Firebase Security Rules

This document contains the Firestore security rules for the Sideasy Scheduler application.

## Overview

The security rules ensure that:
- Only authenticated users can access the database
- Users can only read/write data based on their role
- Developers have full access
- Owners can manage their departments
- Admins can manage users and schedules within their department
- Workers can only read their own schedules

## Firestore Rules (Draft)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isDeveloper() {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'developer';
    }
    
    function isOwner() {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'owner';
    }
    
    function isAdmin() {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    function isWorker() {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'worker';
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isDeveloper() || isOwner() || isAdmin() || request.auth.uid == userId;
      allow delete: if isDeveloper() || isOwner();
    }
    
    // Departments collection
    match /departments/{departmentId} {
      allow read: if isAuthenticated();
      allow write: if isDeveloper() || isOwner();
    }
    
    // Schedules collection
    match /schedules/{scheduleId} {
      allow read: if isAuthenticated();
      allow write: if isDeveloper() || isOwner() || isAdmin();
    }
    
    // Statistics collection
    match /statistics/{statId} {
      allow read: if isAuthenticated();
      allow write: if isDeveloper() || isOwner() || isAdmin();
    }
  }
}
```

## Storage Rules (Draft)

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        request.resource.size < 5 * 1024 * 1024 && // 5MB max
        request.resource.contentType.matches('image/.*');
    }
  }
}
```

