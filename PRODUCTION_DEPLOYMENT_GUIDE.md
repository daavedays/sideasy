# 🚀 SIDEASY SCHEDULER - PRODUCTION DEPLOYMENT GUIDE

**Project**: Sideasy Scheduler  
**Domain**: sideasy.org  
**Date**: October 7, 2025  
**Status**: Ready for Production

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### 1. Environment Setup
```bash
# Verify .env file exists and has correct values
cat .env

# Required variables:
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=sideasy-scheduler.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sideasy-scheduler
VITE_FIREBASE_STORAGE_BUCKET=sideasy-scheduler.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### 2. Security Check
- [ ] `.env` file NOT committed to Git
- [ ] `serviceAccountKey.json` NOT in repo
- [ ] All sensitive files in `.gitignore`
- [ ] Firestore security rules published
- [ ] No console.log statements with sensitive data
- [ ] No hardcoded credentials

### 3. Code Quality
```bash
# Run linter
npm run lint

# Check for TypeScript errors
npx tsc --noEmit

# Verify no critical errors
```

### 4. Firestore Setup
- [ ] Developer account created manually
- [ ] Predefined departments created:
  - שירותי קרקע (Ground Support)
  - לוגיסטיקה (Logistics)
  - מרפאה (Medical)
- [ ] Department IDs stored in `departmentIds.ts`
- [ ] Security rules deployed and tested

---

## 🔧 BUILD PROCESS

### Step 1: Clean Build
```bash
# Remove old build files
rm -rf dist

# Install dependencies (if needed)
npm install

# Run build
npm run build
```

### Step 2: Test Build Locally
```bash
# Preview production build
npm run preview

# Open browser to http://localhost:4173
# Test all major flows:
# - Login as developer
# - View pending approvals
# - Login as owner
# - Check dashboard loads
```

### Step 3: Verify Build Output
```bash
# Check dist folder
ls -la dist/

# Verify files:
# - index.html
# - assets/ (JS and CSS bundles)
# - favicon.ico
# - images/
# - logos/
```

---

## 🌐 FIREBASE DEPLOYMENT

### Step 1: Login to Firebase
```bash
firebase login
```

### Step 2: Initialize (if first time)
```bash
firebase init

# Select:
# - Hosting
# - Firestore
# - Use existing project: sideasy-scheduler
# - Public directory: dist
# - Single-page app: Yes
# - Set up automatic builds: No
```

### Step 3: Deploy to Firebase
```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy hosting
firebase deploy --only hosting

# Or deploy both
firebase deploy
```

### Step 4: Verify Deployment
```bash
# Firebase will output the hosting URL:
# Hosting URL: https://sideasy-scheduler.web.app

# Visit the URL and test:
# - Login works
# - Dashboard loads
# - No console errors
```

---

## 🔗 CUSTOM DOMAIN SETUP

### Step 1: Add Domain in Firebase Console
1. Go to: https://console.firebase.google.com/project/sideasy-scheduler/hosting/sites
2. Click "Add custom domain"
3. Enter: `sideasy.org`
4. Follow instructions to add DNS records

### Step 2: Configure DNS
Add these records to your DNS provider:

**A Records** (for root domain):
```
Type: A
Name: @
Value: [IP provided by Firebase]
TTL: 3600
```

**CNAME Records** (for www):
```
Type: CNAME
Name: www
Value: sideasy-scheduler.web.app
TTL: 3600
```

**TXT Record** (for verification):
```
Type: TXT
Name: @
Value: [Verification code from Firebase]
TTL: 3600
```

### Step 3: Wait for DNS Propagation
- DNS changes can take 24-48 hours
- Check status in Firebase Console
- Once connected, Firebase auto-provisions SSL certificate

---

## 🧪 POST-DEPLOYMENT TESTING

### Critical Tests:
1. **Authentication**
   - [ ] Developer login works
   - [ ] Owner signup works
   - [ ] Email verification sent
   - [ ] Approval flow works
   - [ ] Approved owner can login

2. **Security**
   - [ ] Cannot access `/developer` as owner
   - [ ] Cannot access `/owner` as unauthenticated
   - [ ] Firestore rules prevent unauthorized access

3. **UI/UX**
   - [ ] Hebrew text displays correctly
   - [ ] All images load
   - [ ] Responsive on mobile
   - [ ] Loading states work
   - [ ] Error messages display

4. **Performance**
   - [ ] Page loads in <3 seconds
   - [ ] No console errors
   - [ ] Real-time updates work
   - [ ] Navigation smooth

---

## 🐛 TROUBLESHOOTING

### Issue: White Screen After Deployment
**Solution**:
1. Check browser console for errors
2. Verify `.env` variables are correct
3. Check Firebase config in `firebase.ts`
4. Ensure `dist/index.html` exists
5. Clear browser cache

### Issue: 404 on Page Refresh
**Solution**:
This is expected for single-page apps. Firebase should redirect all routes to `index.html`.

Check `firebase.json`:
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### Issue: Firestore Permission Denied
**Solution**:
1. Go to Firebase Console → Firestore → Rules
2. Verify rules are published (green "Published" status)
3. Check rules match `firestore.rules` file
4. Test rules in Firebase Console

### Issue: Authentication Not Working
**Solution**:
1. Check Firebase Console → Authentication
2. Verify Email/Password is enabled
3. Check authorized domains include your custom domain
4. Verify `.env` has correct auth domain

---

## 📊 MONITORING

### Firebase Console:
- **Authentication**: https://console.firebase.google.com/project/sideasy-scheduler/authentication/users
- **Firestore**: https://console.firebase.google.com/project/sideasy-scheduler/firestore/data
- **Hosting**: https://console.firebase.google.com/project/sideasy-scheduler/hosting/sites

### Check Daily:
- [ ] Number of active users
- [ ] Firestore read/write counts
- [ ] Any error logs
- [ ] Authentication success rate

### Set Up Alerts:
1. Go to Firebase Console → Project Settings → Integrations
2. Enable Cloud Logging
3. Set up alerts for:
   - High error rates
   - Quota limits reached
   - Security rule violations

---

## 🔄 UPDATE PROCESS

### For Code Changes:
```bash
# 1. Make changes locally
# 2. Test thoroughly
npm run dev

# 3. Build
npm run build

# 4. Preview
npm run preview

# 5. Deploy
firebase deploy --only hosting

# 6. Test live site
```

### For Security Rules Changes:
```bash
# 1. Edit firestore.rules locally
# 2. Test in Firebase Console (Rules Playground)
# 3. Deploy
firebase deploy --only firestore:rules

# 4. Verify rules published
```

### For Database Changes:
⚠️ **CAUTION**: Always backup before making schema changes!

```bash
# Backup Firestore (in Firebase Console):
# 1. Go to Firestore → Import/Export
# 2. Export entire database
# 3. Save export to Cloud Storage

# Then make changes carefully
```

---

## 🔐 SECURITY MAINTENANCE

### Monthly Tasks:
- [ ] Review Firestore security rules
- [ ] Check for unauthorized access attempts
- [ ] Update dependencies: `npm update`
- [ ] Review Firebase usage quotas
- [ ] Backup Firestore database

### Quarterly Tasks:
- [ ] Full security audit
- [ ] Review user roles and permissions
- [ ] Update Firebase SDK if needed
- [ ] Performance optimization review

---

## 📞 SUPPORT CONTACTS

**Developer**: David Mirzoyan  
**Email**: daavedays@gmail.com  
**Firebase Project**: sideasy-scheduler  
**Domain**: sideasy.org

**Firebase Support**:
- Console: https://console.firebase.google.com/project/sideasy-scheduler
- Documentation: https://firebase.google.com/docs

---

## 📝 DEPLOYMENT LOG

| Date | Version | Changes | Deployed By | Status |
|------|---------|---------|-------------|--------|
| 2025-10-07 | 1.0.0 | Initial production deployment | David | ⏳ Pending |

---

**Last Updated**: October 7, 2025  
**Next Review**: After first production deployment
