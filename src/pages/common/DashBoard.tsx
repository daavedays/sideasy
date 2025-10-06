import React from 'react';
import Background from '../../components/Background';

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
    <div dir="rtl" className="relative flex-1">
      {/* Background Component */}
      <Background singleImage="/images/image_1.png" />
      
      {/* Dashboard Content */}
      <div className="relative z-10 flex-1">
          <div className="container mx-auto px-4 py-8 pt-24">
            {/* Header */}
            <header className="text-center mb-12">
              <h1 className="text-5xl font-bold text-white mb-4 drop-shadow-lg">
                Sideasy
              </h1>
              <h2 className="text-2xl text-white/90 mb-2 font-medium drop-shadow-md">
                סידור עבודה בקליק
              </h2>
              <p className="text-lg text-white/80 drop-shadow-sm">
                מערכת ניהול משמרות מתקדמת
              </p>
            </header>
            
            {/* Main Content */}
            <main className="max-w-4xl mx-auto">
          {/* Welcome Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20 mb-8">
            <div className="text-center">
              <h3 className="text-3xl font-bold text-white mb-4 drop-shadow-lg">
                ברוכים הבאים לדשבורד!
              </h3>
              <p className="text-lg text-white/90 mb-6 drop-shadow-sm">
                כאן תוכלו לנהל את המשמרות, העובדים והזמנים שלכם
              </p>
              
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 text-white border border-white/30 shadow-lg">
                  <h4 className="text-2xl font-bold mb-2 drop-shadow-sm">120</h4>
                  <p className="text-white/90 drop-shadow-sm">עובדים פעילים</p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 text-white border border-white/30 shadow-lg">
                  <h4 className="text-2xl font-bold mb-2 drop-shadow-sm">45</h4>
                  <p className="text-white/90 drop-shadow-sm">משמרות השבוע</p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 text-white border border-white/30 shadow-lg">
                  <h4 className="text-2xl font-bold mb-2 drop-shadow-sm">8</h4>
                  <p className="text-white/90 drop-shadow-sm">מחלקות</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 shadow-lg">
                  צור משמרת חדשה
                </button>
                <button className="bg-white/20 backdrop-blur-sm text-white px-8 py-3 rounded-xl font-semibold border border-white/30 hover:bg-white/30 hover:shadow-lg transition-all duration-300 transform hover:scale-105">
                  ניהול עובדים
                </button>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="text-center">
            <a 
              href="/login" 
              className="inline-flex items-center text-white/80 hover:text-white transition-colors duration-200 font-medium bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20 hover:bg-white/20"
            >
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              חזור לעמוד הכניסה
            </a>
          </div>
            </main>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
