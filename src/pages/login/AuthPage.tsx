import React, { useState } from 'react';
import AuthLayout from './AuthLayout';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';

/**
 * Main Authentication Page Component
 * 
 * This component handles the authentication UI with tabs for Login and Signup.
 * Features Hebrew text with RTL support and modern glassmorphism design.
 * 
 * Location: src/pages/firebase_auth/AuthPage.tsx
 * Purpose: Main authentication page with tab switching
 */

const AuthPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

  return (
    <div dir="rtl" className="min-h-screen">
      <AuthLayout>
        <div className="w-full max-w-md mx-auto">
          {/* App Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">
              sideasy
            </h1>
            <h2 className="text-xl text-white/90 font-medium drop-shadow-md">
              סידור עבודה בקליק
            </h2>
          </div>

          {/* Tab Navigation */}
          <div className="flex bg-white/10 backdrop-blur-sm rounded-2xl p-1 mb-6 border border-white/20">
            <button
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 ease-in-out ${
                activeTab === 'login'
                  ? 'bg-white/20 text-white shadow-lg'
                  : 'text-white/70 hover:text-white/90 hover:bg-white/5'
              }`}
            >
              כניסה
            </button>
            <button
              onClick={() => setActiveTab('signup')}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 ease-in-out ${
                activeTab === 'signup'
                  ? 'bg-white/20 text-white shadow-lg'
                  : 'text-white/70 hover:text-white/90 hover:bg-white/5'
              }`}
            >
              הרשמה
            </button>
          </div>

          {/* Form Container */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-2xl">
            {activeTab === 'login' ? <LoginForm /> : <SignupForm />}
          </div>
        </div>
      </AuthLayout>
    </div>
  );
};

export default AuthPage;
