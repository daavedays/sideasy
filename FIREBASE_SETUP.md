# Firebase Setup Documentation

## Overview
This document provides comprehensive information about the Firebase integration in the Sideasy Scheduler application.

## Project Structure

```
src/
├── config/
│   └── firebaseConfig.ts          # Firebase client configuration
├── components/
│   ├── admin/                     # Admin-specific components
│   ├── common/                    # Shared components
│   ├── owner/                     # Owner-specific components
│   └── worker/                    # Worker-specific components
├── main.tsx                       # App entry point with Firebase init
└── App.tsx                        # Root application component
```

## Files and Their Purposes

### 1. `src/config/firebaseConfig.ts`
**Purpose**: Centralized Firebase client-side configuration
**Contains**:
- Firebase app initialization
- Authentication service setup
- Firestore database setup
- Storage service setup
- Export of all Firebase services for use throughout the app

**Key Exports**:
- `auth`: Firebase Authentication service
- `db`: Firestore database instance
- `storage`: Firebase Storage service
- `app`: Firebase app instance (default export)

### 2. `src/main.tsx`
**Purpose**: Application entry point
**Contains**:
- Firebase configuration import (ensures Firebase is initialized before app starts)
- React app rendering setup

### 3. `src/App.tsx`
**Purpose**: Root application component
**Contains**:
- Basic app layout and styling
- Welcome message and ready state

## Firebase Services Configured

### Authentication (`auth`)
- **Purpose**: User authentication and authorization
- **Usage**: Import `{ auth }` from `../config/firebaseConfig`
- **Common operations**: Sign in, sign up, sign out, user state management

### Firestore Database (`db`)
- **Purpose**: NoSQL document database for app data
- **Usage**: Import `{ db }` from `../config/firebaseConfig`
- **Common operations**: CRUD operations on collections and documents

### Storage (`storage`)
- **Purpose**: File storage for images, documents, etc.
- **Usage**: Import `{ storage }` from `../config/firebaseConfig`
- **Common operations**: Upload, download, delete files

## Configuration Details

### Firebase Project
- **Project ID**: sideasy-scheduler
- **Auth Domain**: sideasy-scheduler.firebaseapp.com
- **Storage Bucket**: sideasy-scheduler.firebasestorage.app

### Security Rules (Recommended)
```javascript
// Firestore Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to authenticated users only
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}

// Storage Rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Firebase Integration Status

✅ **Firebase Configuration**: Properly configured with your credentials
✅ **Build Process**: TypeScript compilation and Vite build working correctly  
✅ **Bundle Size**: Optimized (391KB gzipped)
✅ **Clean Structure**: TypeScript-only files, no duplicates or test files

## Environment Variables (Optional)

If you want to use environment variables instead of hardcoded values:

1. Create a `.env` file in the root directory
2. Add your Firebase config as environment variables:
   ```
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

3. Update `firebaseConfig.ts` to use environment variables:
   ```typescript
   const firebaseConfig = {
     apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
     authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
     projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
     storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
     messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
     appId: import.meta.env.VITE_FIREBASE_APP_ID
   };
   ```

## Common Usage Patterns

### Using Authentication
```typescript
import { auth } from '../config/firebaseConfig';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

// Sign in
await signInWithEmailAndPassword(auth, email, password);

// Sign up
await createUserWithEmailAndPassword(auth, email, password);
```

### Using Firestore
```typescript
import { db } from '../config/firebaseConfig';
import { collection, addDoc, getDocs } from 'firebase/firestore';

// Add document
await addDoc(collection(db, 'users'), { name: 'John', email: 'john@example.com' });

// Get documents
const querySnapshot = await getDocs(collection(db, 'users'));
```

### Using Storage
```typescript
import { storage } from '../config/firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Upload file
const storageRef = ref(storage, 'images/photo.jpg');
await uploadBytes(storageRef, file);

// Get download URL
const downloadURL = await getDownloadURL(storageRef);
```

## Troubleshooting

### Common Issues

1. **Firebase connection fails**
   - Check if Firebase project exists and is active
   - Verify API keys are correct
   - Ensure Firestore is enabled in Firebase console

2. **Permission denied errors**
   - Check Firestore security rules
   - Ensure user is authenticated for protected operations

3. **Build errors**
   - Make sure all Firebase dependencies are installed
   - Check TypeScript configuration

### Debug Mode
Enable Firebase debug logging by adding to your browser console:
```javascript
localStorage.setItem('firebase:debug', '*');
```

## Project Status

✅ **Firebase Integration Complete**: Firebase is properly configured and tested
✅ **Clean Project Structure**: All test files and duplicate .js files removed
✅ **TypeScript Only**: Project now uses only TypeScript files (.tsx/.ts)
✅ **Ready for Development**: Clean slate with Firebase services available

## Next Steps

1. **Implement authentication**: Set up user sign-in/sign-up flows
2. **Create data models**: Define Firestore collections and documents  
3. **Add security rules**: Implement proper Firestore and Storage security rules
4. **Error handling**: Add comprehensive error handling for Firebase operations
5. **Build features**: Start implementing your scheduling application features

## Dependencies

- `firebase`: ^10.7.1 - Firebase JavaScript SDK
- `dotenv`: ^16.3.1 - Environment variable management

## Notes

- This setup is for client-side Firebase only (no backend/server)
- All Firebase operations run in the browser
- Security rules in Firebase console control data access
- Consider implementing proper error boundaries for production use
