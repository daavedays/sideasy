import React from 'react';

/**
 * Worker Dashboard
 * 
 * Dashboard page for workers to view their schedules.
 * 
 * Location: src/pages/worker/index.tsx
 * Purpose: Worker dashboard (placeholder)
 */

const WorkerDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 text-center max-w-2xl">
        <h1 className="text-4xl font-bold text-white mb-4" dir="rtl">דשבורד עובד</h1>
        <p className="text-white/80 text-lg mb-6" dir="rtl">
          צפייה במשמרות ובלוח הזמנים שלך
        </p>
        <div className="text-white/60">
          בקרוב...
        </div>
      </div>
    </div>
  );
};

export default WorkerDashboard;

