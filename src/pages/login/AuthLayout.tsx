import React from 'react';
import Background from '../../components/Background';

/**
 * Authentication Layout Component
 * 
 * This component provides the background slideshow and overall layout
 * for authentication pages. Features smooth transitions between images
 * with opacity and blur effects.
 * 
 * Location: src/pages/firebase_auth/AuthLayout.tsx
 * Purpose: Background slideshow and authentication layout wrapper
 */

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Component with slideshow */}
      <Background />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
