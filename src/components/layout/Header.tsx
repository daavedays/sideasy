import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

/**
 * Header Component
 * 
 * Transparent header with navigation and logout functionality.
 * Features Hebrew text with RTL support and glassmorphism design.
 * Only shows on non-authentication pages.
 * 
 * Location: src/components/layout/Header.tsx
 * Purpose: Main navigation header for the application
 */

interface UserData {
  firstName?: string;
  lastName?: string;
  role?: string;
}

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userData, setUserData] = useState<UserData | null>(null);

  // Don't show header on login/auth pages
  const isAuthPage = location.pathname === '/' || location.pathname === '/login';
  
  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.currentUser && !isAuthPage) {
        try {
          const userDocRef = doc(db, 'users', auth.currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setUserData(userDocSnap.data() as UserData);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    };

    fetchUserData();
  }, [isAuthPage]);

  if (isAuthPage) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleDashboardClick = () => {
    // Navigate based on role
    if (userData?.role === 'developer') {
      navigate('/developer');
    } else if (userData?.role === 'owner') {
      navigate('/owner');
    } else if (userData?.role === 'admin') {
      navigate('/admin');
    } else if (userData?.role === 'worker') {
      navigate('/worker');
    }
  };

  const getInitials = () => {
    if (userData?.firstName) {
      return userData.firstName.charAt(0);
    }
    return 'U';
  };

  const getUserDisplayName = () => {
    if (userData?.firstName && userData?.lastName) {
      return `${userData.firstName} ${userData.lastName}`;
    }
    return userData?.firstName || 'משתמש';
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/10 backdrop-blur-md border-b border-white/20 shadow-lg">
      <div className="container mx-auto px-4 py-0">
        <div className="flex items-center justify-between">
          {/* Logo/Brand */}
          <div className="flex items-center space-x-4 space-x-reverse">
            <div 
              className="cursor-pointer"
              onClick={handleDashboardClick}
            >
              <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                Sideasy
              </h1>
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-6 space-x-reverse">
            <button
              onClick={handleDashboardClick}
              className="text-white/90 hover:text-white font-medium transition-colors duration-200 hover:bg-white/10 px-3 py-2 rounded-lg"
            >
              דשבורד
            </button>
            <button
              className="text-white/90 hover:text-white font-medium transition-colors duration-200 hover:bg-white/10 px-3 py-2 rounded-lg"
            >
              משמרות
            </button>
            <button
              className="text-white/90 hover:text-white font-medium transition-colors duration-200 hover:bg-white/10 px-3 py-2 rounded-lg"
            >
              עובדים
            </button>
            <button
              className="text-white/90 hover:text-white font-medium transition-colors duration-200 hover:bg-white/10 px-3 py-2 rounded-lg"
            >
              הגדרות
            </button>
          </nav>

          {/* User Actions */}
          <div className="flex items-center space-x-4 space-x-reverse">
            {/* Notifications */}
            <button className="relative p-2 text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              {/* Notification badge */}
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                3
              </span>
            </button>

            {/* Profile Menu */}
            <div className="relative">
              <button 
                onClick={handleDashboardClick}
                className="flex items-center space-x-2 space-x-reverse text-white/90 hover:text-white hover:bg-white/10 px-3 py-2 rounded-lg transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">{getInitials()}</span>
                </div>
                <span className="hidden md:block font-medium">{getUserDisplayName()}</span>
              </button>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 backdrop-blur-sm border border-white/30 hover:border-white/50"
            >
              התנתק
            </button>

            {/* Mobile Menu Button */}
            <button className="md:hidden p-2 text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

