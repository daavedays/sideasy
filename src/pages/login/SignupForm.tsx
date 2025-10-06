import React from 'react';

/**
 * Signup Form Component
 * 
 * This component renders the signup form with all required fields
 * (first name, last name, department, email, password), social login buttons,
 * and Hebrew text with RTL support.
 * 
 * Location: src/pages/firebase_auth/SignupForm.tsx
 * Purpose: Signup form UI component
 */

const SignupForm: React.FC = () => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // No functionality - UI only
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="text-center">
        <h3 className="text-2xl font-semibold text-white mb-2">
          הצטרפו אלינו
        </h3>
        <p className="text-white/80 text-sm">
          צרו חשבון חדש והתחילו לעבוד
        </p>
      </div>

      {/* Signup Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name Fields Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* First Name */}
          <div className="space-y-2">
            <label htmlFor="firstName" className="block text-sm font-medium text-white/90">
              שם פרטי
            </label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              placeholder="הכנס שם פרטי"
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
            />
          </div>

          {/* Last Name */}
          <div className="space-y-2">
            <label htmlFor="lastName" className="block text-sm font-medium text-white/90">
              שם משפחה
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              placeholder="הכנס שם משפחה"
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
            />
          </div>
        </div>

        {/* Department Field */}
        <div className="space-y-2">
          <label htmlFor="department" className="block text-sm font-medium text-white/90">
            מחלקה
          </label>
          <select
            id="department"
            name="department"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
          >
            <option value="" className="bg-gray-800 text-white">
              בחר מחלקה
            </option>
            <option value="management" className="bg-gray-800 text-white">
              ניהול
            </option>
            <option value="hr" className="bg-gray-800 text-white">
              משאבי אנוש
            </option>
            <option value="operations" className="bg-gray-800 text-white">
              תפעול
            </option>
            <option value="customer-service" className="bg-gray-800 text-white">
              שירות לקוחות
            </option>
            <option value="maintenance" className="bg-gray-800 text-white">
              תחזוקה
            </option>
          </select>
        </div>

        {/* Email Field */}
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-white/90">
            כתובת אימייל
          </label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="הכנס כתובת אימייל"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
            dir="ltr"
          />
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-white/90">
            סיסמה
          </label>
          <input
            type="password"
            id="password"
            name="password"
            placeholder="הכנס סיסמה (לפחות 8 תווים)"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
            dir="ltr"
          />
        </div>

        {/* Terms and Conditions */}
        <div className="flex items-start text-sm">
          <input
            type="checkbox"
            id="terms"
            name="terms"
            className="rounded border-white/20 bg-white/10 text-white focus:ring-white/30 focus:ring-offset-0 mr-3 mt-1"
          />
          <label htmlFor="terms" className="text-white/80 leading-relaxed">
            אני מסכים ל
            <button
              type="button"
              className="text-white hover:text-white/90 underline mx-1"
            >
              תנאי השימוש
            </button>
            ו
            <button
              type="button"
              className="text-white hover:text-white/90 underline mx-1"
            >
              מדיניות הפרטיות
            </button>
          </label>
        </div>

        {/* Signup Button */}
        <button
          type="submit"
          className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-300 transform hover:scale-[1.02] shadow-lg"
        >
          הירשם
        </button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/20" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-transparent text-white/70">
            או הירשם באמצעות
          </span>
        </div>
      </div>

      {/* Social Login Buttons */}
      <div className="flex space-x-4 space-x-reverse">
        {/* Google Button */}
        <button
          type="button"
          className="flex-1 flex items-center justify-center py-3 px-4 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-300 backdrop-blur-sm"
        >
          <svg className="w-5 h-5 ml-2" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span className="text-white font-medium">Google</span>
        </button>

        {/* Facebook Button */}
        <button
          type="button"
          className="flex-1 flex items-center justify-center py-3 px-4 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-300 backdrop-blur-sm"
        >
          <svg className="w-5 h-5 ml-2" viewBox="0 0 24 24" fill="#1877F2">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          <span className="text-white font-medium">Facebook</span>
        </button>
      </div>
    </div>
  );
};

export default SignupForm;
