import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Header Component
 * 
 * Transparent header with navigation and logout functionality.
 * Features Hebrew text with RTL support and glassmorphism design.
 * Only shows on non-authentication pages.
 * 
 * Location: src/components/header.tsx
 * Purpose: Main navigation header for the application
 */

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show header on login/auth pages
  const isAuthPage = location.pathname === '/' || location.pathname === '/login';
  
  if (isAuthPage) {
    return null;
  }

  const handleLogout = () => {
    // TODO: Implement actual logout functionality
    navigate('/login');
  };

  const handleDashboardClick = () => {
    navigate('/dashboard');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/10 backdrop-blur-md border-b border-white/20 shadow-lg">
      <div className="container mx-auto px-4 py-4">
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
              <button className="flex items-center space-x-2 space-x-reverse text-white/90 hover:text-white hover:bg-white/10 px-3 py-2 rounded-lg transition-all duration-200">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">ד</span>
                </div>
                <span className="hidden md:block font-medium">דוד מירזויאן</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
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
