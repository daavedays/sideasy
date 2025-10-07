import React from 'react';

/**
 * Owner Dashboard
 * 
 * Dashboard page for department owners.
 * 
 * Location: src/pages/owner/index.tsx
 * Purpose: Owner dashboard (placeholder)
 */

const OwnerDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 text-center max-w-2xl">
        <h1 className="text-4xl font-bold text-white mb-4" dir="rtl">דשבורד בעלים</h1>
        <p className="text-white/80 text-lg mb-6" dir="rtl">
          ניהול מחלקות, עובדים ולוחות זמנים
        </p>
        <div className="text-white/60">
          בקרוב...
        </div>
      </div>
    </div>
  );
};

export default OwnerDashboard;

