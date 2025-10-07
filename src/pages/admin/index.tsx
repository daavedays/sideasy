import React from 'react';

/**
 * Admin Dashboard
 * 
 * Dashboard page for department administrators.
 * 
 * Location: src/pages/admin/index.tsx
 * Purpose: Admin dashboard (placeholder)
 */

const AdminDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 text-center max-w-2xl">
        <h1 className="text-4xl font-bold text-white mb-4" dir="rtl">דשבורד מנהל</h1>
        <p className="text-white/80 text-lg mb-6" dir="rtl">
          ניהול עובדים ולוחות זמנים במחלקה
        </p>
        <div className="text-white/60">
          בקרוב...
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

