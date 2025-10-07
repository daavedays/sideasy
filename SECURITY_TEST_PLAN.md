# 🔐 SIDEASY SECURITY TEST PLAN

**Date**: October 7, 2025  
**Status**: Phase 9-10 Testing  
**Tester**: Developer

---

## 📋 OVERVIEW

This document outlines all security tests to verify:
- ✅ Department data isolation
- ✅ Role-based access control
- ✅ Authentication flows
- ✅ Firestore security rules
- ✅ Cross-department protection

---

## 🎯 TEST SCENARIOS

### 1. AUTHENTICATION FLOW TESTS

#### Test 1.1: Developer Login
- [ ] Navigate to `/login`
- [ ] Enter developer credentials
- [ ] Click "התחבר"
- [ ] **Expected**: Redirect to `/developer`
- [ ] **Verify**: Developer dashboard loads correctly
- [ ] **Verify**: Can see navigation cards

#### Test 1.2: Owner Signup (Pending State)
- [ ] Navigate to `/login`
- [ ] Click "עדיין אין לך חשבון? הירשם"
- [ ] Fill form:
  - First name: שם בדיקה
  - Last name: משפחה בדיקה
  - Email: test-owner@example.com
  - Password: TestPass123!
  - Role: בעל מחלקה
  - Department: שירותי קרקע
- [ ] Click "הירשם"
- [ ] **Expected**: Success message in Hebrew
- [ ] **Verify**: Email verification sent
- [ ] **Verify**: User document created in Firestore with `status: 'pending'`

#### Test 1.3: Pending User Login Blocked
- [ ] Try to login with test-owner@example.com
- [ ] **Expected**: Warning message "חשבונך ממתין לאישור"
- [ ] **Verify**: Not redirected to dashboard
- [ ] **Verify**: Stays on login page

#### Test 1.4: Developer Approval Flow
- [ ] Login as developer
- [ ] Navigate to "בקשות ממתינות לאישור"
- [ ] **Verify**: See test-owner@example.com in list
- [ ] **Verify**: See correct name, department, email
- [ ] Click "אשר" (Approve)
- [ ] **Expected**: Success message
- [ ] **Verify**: User removed from pending list
- [ ] **Verify**: User status in Firestore changed to 'approved'

#### Test 1.5: Approved Owner Login
- [ ] Logout from developer
- [ ] Login with test-owner@example.com
- [ ] **Expected**: Redirect to `/owner`
- [ ] **Verify**: Owner dashboard loads
- [ ] **Verify**: See correct department name
- [ ] **Verify**: See department stats

---

### 2. DEPARTMENT ISOLATION TESTS

#### Test 2.1: Owner Can Only See Own Department
- [ ] Login as Owner of שירותי קרקע
- [ ] **Verify**: Dashboard shows "שירותי קרקע" only
- [ ] **Verify**: Cannot see לוגיסטיקה data
- [ ] Check browser console for Firestore queries
- [ ] **Expected**: All queries include department filter

#### Test 2.2: Cross-Department Data Access Blocked
**Setup**: Create two owners in different departments
- Owner A: שירותי קרקע (departmentId: XXX)
- Owner B: לוגיסטיקה (departmentId: YYY)

**Test Steps**:
1. [ ] Login as Owner A
2. [ ] Open browser console
3. [ ] Try to manually query Owner B's department:
   ```javascript
   // This should FAIL
   firebase.firestore().collection('departments').doc('YYY').get()
   ```
4. [ ] **Expected**: Permission denied error
5. [ ] **Verify**: Cannot access other department's data

#### Test 2.3: Worker Collection Isolation
**Setup**: Create workers in both departments
- Worker A in שירותי קרקע
- Worker B in לוגיסטיקה

**Test Steps**:
1. [ ] Login as Owner of שירותי קרקע
2. [ ] Navigate to worker management (when implemented)
3. [ ] **Verify**: See only Worker A
4. [ ] **Verify**: Worker B not visible
5. [ ] Try manual query in console:
   ```javascript
   // This should FAIL
   firebase.firestore().collection('logistics-dept-id/workers').get()
   ```
6. [ ] **Expected**: Permission denied or empty results

---

### 3. ROLE-BASED ACCESS TESTS

#### Test 3.1: Developer Access
- [ ] Login as developer
- [ ] **Can Access**:
  - ✅ All departments
  - ✅ All users
  - ✅ Pending approvals
  - ✅ System settings (future)
- [ ] **Verify**: Can see all departments in Firestore
- [ ] **Verify**: Can approve/reject any user

#### Test 3.2: Owner Access
- [ ] Login as owner
- [ ] **Can Access**:
  - ✅ Own department data only
  - ✅ Department workers (when implemented)
  - ✅ Department schedules (when implemented)
  - ✅ Department statistics
- [ ] **Cannot Access**:
  - ❌ Other departments
  - ❌ Developer dashboard
  - ❌ User approval page
  - ❌ System-wide settings

#### Test 3.3: Route Protection
Test URL access directly:
- [ ] As Owner, try to access `/developer`
  - **Expected**: Redirect or "Unauthorized" message
- [ ] As Owner, try to access `/developer/pending-approvals`
  - **Expected**: Blocked
- [ ] As unauthenticated user, try to access `/owner`
  - **Expected**: Redirect to `/login`

---

### 4. FIRESTORE SECURITY RULES TESTS

#### Test 4.1: Users Collection Rules
**Test Read Access**:
```javascript
// As authenticated user
firebase.firestore().collection('users').doc(myUserId).get()
// Expected: SUCCESS

// Try to read another user's document
firebase.firestore().collection('users').doc(otherUserId).get()
// Expected: FAIL (permission denied)

// Try to list all users (as non-developer)
firebase.firestore().collection('users').get()
// Expected: SUCCESS (but app filters results)
```

**Test Write Access**:
```javascript
// As authenticated user, try to update own role
firebase.firestore().collection('users').doc(myUserId).update({
  role: 'developer'
})
// Expected: FAIL (cannot change role)

// As developer, update another user's status
firebase.firestore().collection('users').doc(userId).update({
  status: 'approved'
})
// Expected: SUCCESS
```

#### Test 4.2: Departments Collection Rules
```javascript
// As owner, try to read own department
firebase.firestore().collection('departments').doc(myDepartmentId).get()
// Expected: SUCCESS

// As owner, try to read another department
firebase.firestore().collection('departments').doc(otherDepartmentId).get()
// Expected: SUCCESS (read allowed, but UI filters)

// As owner, try to create new department
firebase.firestore().collection('departments').add({...})
// Expected: FAIL (only developer can create)

// As owner, try to delete own department
firebase.firestore().collection('departments').doc(myDepartmentId).delete()
// Expected: FAIL (only developer can delete)
```

#### Test 4.3: Department-Specific Collections
```javascript
// As owner, access own department's workers
firebase.firestore().collection(`${myDepartmentId}/workers`).get()
// Expected: SUCCESS

// As owner, access another department's workers
firebase.firestore().collection(`${otherDepartmentId}/workers`).get()
// Expected: Based on rules - should verify isolation
```

---

### 5. CUSTOM DEPARTMENT TESTS

#### Test 5.1: Create Custom Department
- [ ] Signup as new owner
- [ ] Select department: אחר
- [ ] Enter custom name: "מחלקת בדיקה"
- [ ] Submit signup
- [ ] Login as developer
- [ ] Approve the owner
- [ ] **Verify**: New department created in Firestore
- [ ] **Verify**: Department has auto-generated ID
- [ ] **Verify**: Department type is "custom"
- [ ] **Verify**: Owner linked to department

#### Test 5.2: Custom Department Isolation
- [ ] Login as owner of custom department
- [ ] **Verify**: Can only see custom department data
- [ ] **Verify**: Cannot see predefined departments
- [ ] **Verify**: Department name displays correctly

---

### 6. EMAIL VERIFICATION TESTS

#### Test 6.1: Unverified Email Blocked
- [ ] Create user account
- [ ] **Before** verifying email, check Firestore
- [ ] **Verify**: `emailVerified: false` in user document
- [ ] **Verify**: User does NOT appear in pending approvals
- [ ] Verify email through link
- [ ] **Verify**: `emailVerified: true` in Firestore
- [ ] **Verify**: User NOW appears in pending approvals

---

### 7. ERROR HANDLING TESTS

#### Test 7.1: Invalid Credentials
- [ ] Try to login with wrong password
- [ ] **Expected**: Clear error message in Hebrew
- [ ] **Verify**: No crash, no console errors

#### Test 7.2: Network Errors
- [ ] Disable network in browser dev tools
- [ ] Try to login
- [ ] **Expected**: Error message about connection
- [ ] Enable network
- [ ] **Verify**: App recovers gracefully

#### Test 7.3: Firestore Permission Errors
- [ ] Manually trigger permission error (try to access blocked data)
- [ ] **Expected**: Graceful error handling
- [ ] **Verify**: User sees friendly Hebrew error message
- [ ] **Verify**: App doesn't crash

---

## 🎯 ACCEPTANCE CRITERIA

All tests must pass before production:
- ✅ **Authentication**: All signup/login flows work correctly
- ✅ **Approval System**: Pending → Approved flow works end-to-end
- ✅ **Department Isolation**: No cross-department data leaks
- ✅ **Role-Based Access**: Each role can only access authorized features
- ✅ **Security Rules**: All Firestore rules prevent unauthorized access
- ✅ **Email Verification**: Only verified users appear in approvals
- ✅ **Error Handling**: All errors handled gracefully with Hebrew messages
- ✅ **UI/UX**: All pages responsive, Hebrew text correct, loading states work

---

## 📊 TEST RESULTS

| Test ID | Test Name | Status | Notes |
|---------|-----------|--------|-------|
| 1.1 | Developer Login | ⏳ Pending | |
| 1.2 | Owner Signup | ⏳ Pending | |
| 1.3 | Pending Login Block | ⏳ Pending | |
| 1.4 | Approval Flow | ⏳ Pending | |
| 1.5 | Approved Login | ⏳ Pending | |
| 2.1 | Own Dept Only | ⏳ Pending | |
| 2.2 | Cross-Dept Block | ⏳ Pending | |
| 2.3 | Worker Isolation | ⏳ Pending | |
| 3.1 | Developer Access | ⏳ Pending | |
| 3.2 | Owner Access | ⏳ Pending | |
| 3.3 | Route Protection | ⏳ Pending | |
| 4.1 | Users Rules | ⏳ Pending | |
| 4.2 | Departments Rules | ⏳ Pending | |
| 4.3 | Dept Collections | ⏳ Pending | |
| 5.1 | Custom Dept Create | ⏳ Pending | |
| 5.2 | Custom Dept Isolate | ⏳ Pending | |
| 6.1 | Email Verification | ⏳ Pending | |
| 7.1 | Invalid Creds | ⏳ Pending | |
| 7.2 | Network Errors | ⏳ Pending | |
| 7.3 | Permission Errors | ⏳ Pending | |

---

## 🚀 PRODUCTION READINESS CHECKLIST

Before deploying to production:

### Security:
- [ ] All security tests passed
- [ ] Firestore rules deployed and tested
- [ ] No exposed API keys in code
- [ ] `.env` file properly configured
- [ ] `serviceAccountKey.json` NOT in repo
- [ ] All sensitive files in `.gitignore`

### Functionality:
- [ ] Developer account created
- [ ] Predefined departments exist
- [ ] Approval flow works end-to-end
- [ ] Owner dashboard functional
- [ ] All navigation works
- [ ] Hebrew text displays correctly

### Performance:
- [ ] No console errors
- [ ] Loading states work
- [ ] Real-time updates work
- [ ] No memory leaks
- [ ] Build size reasonable

### Documentation:
- [ ] README updated
- [ ] Security rules documented
- [ ] Database structure documented
- [ ] Deployment process documented

---

**Last Updated**: October 7, 2025  
**Next Review**: Before production deployment
