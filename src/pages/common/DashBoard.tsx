import React from 'react';
import Background from '../../components/layout/Background';

/**
 * Dashboard Component
 * 
 * Hebrew dashboard component with modern styling and RTL support.
 * This will be replaced with the full dashboard functionality later.
 * 
 * Location: src/pages/common/dashboard.tsx
 * Purpose: Hebrew dashboard component with Tailwind styling
 */

const Dashboard: React.FC = () => {
  return (
    <div dir="rtl" className="relative flex-1 min-h-screen">
      {/* Background Component */}
      <Background singleImage="/images/image_1.png" />
      
      {/* Dashboard Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen">
        <div className="container mx-auto px-4 py-8">
          {/* Welcome Message */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-12 shadow-2xl border border-white/20 text-center max-w-2xl mx-auto">
            <h1 className="text-5xl font-bold text-white drop-shadow-lg mb-4">
              ברוכים הבאים!
            </h1>
            <p className="text-2xl text-white/80 drop-shadow-sm">
              Sideasy - מערכת ניהול משמרות מתקדמת
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
