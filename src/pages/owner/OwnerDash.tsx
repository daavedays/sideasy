/**
 * Owner Dashboard Component
 * 
 * Main dashboard for department owners with navigation cards and department stats.
 * 
 * Location: src/pages/owner/OwnerDash.tsx
 * Purpose: Owner dashboard with department overview
 */

import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../../config/firebase';
// import { REALTIME_LISTENERS_ENABLED } from '../../config/appConfig';
import { UserData } from '../../lib/auth/authHelpers';
import Background from '../../components/layout/Background';

interface DepartmentData {
  departmentId: string;
  name: string;
  ownerId: string;
  ownerName: string;
  adminCount: number;
  workerCount: number;
}

const OwnerDash: React.FC = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [departmentData, setDepartmentData] = useState<DepartmentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;

      try {
        // Get user data
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const user = userDoc.data() as UserData;
          setUserData(user);

          // Get department data
          if (user.departmentId) {
            const deptDocRef = doc(db, 'departments', user.departmentId);
            const deptDoc = await getDoc(deptDocRef);
            
            if (deptDoc.exists()) {
              setDepartmentData(deptDoc.data() as DepartmentData);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ספירת אישורים ממתינים הועברה ל-Header הגלובלי

  const navigationCards = [
    {
      title: 'ניהול עובדים',
      description: 'הוסף, ערוך וצפה בעובדי המחלקה',
      icon: '👥',
      onClick: () => navigate('/owner/manage-workers'),
      color: 'from-blue-600 to-cyan-600',
      badge: null
    },
    {
      title: 'תורנות ראשית',
      description: 'יצירה ועריכה של לוח משמרות ראשי',
      icon: '📅',
      onClick: () => navigate('/owner/primary-tasks'),
      color: 'from-indigo-600 to-purple-600',
      badge: null
    },
    {
      title: 'הגדרות משימות',
      description: 'נהל משימות משניות וראשיות למחלקה',
      icon: '⚙️',
      onClick: () => navigate('/owner/settings'),
      color: 'from-cyan-600 to-green-600',
      badge: null
    },
    {
      title: 'סטטיסטיקות',
      description: 'צפה בסטטיסטיקות מחלקה',
      icon: '📊',
      onClick: () => navigate('/owner/statistics'),
      color: 'from-green-600 to-emerald-600',
      badge: null
    }
  ];

  if (loading) {
    return (
      <div dir="rtl" className="relative flex-1 min-h-screen">
        <Background singleImage="/images/image_1.png" />
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <div className="text-white text-2xl">טוען...</div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="relative flex-1 min-h-screen">
      <Background singleImage="/images/image_1.png" />
      
      
      <div className="relative z-10 min-h-screen py-8 pt-24">
        <div className="container mx-auto px-4">
          {/* Welcome Header */}
          <div className="mb-8">
            <h1 className="text-5xl font-bold text-white drop-shadow-lg mb-2">
              שלום, {userData?.firstName}
            </h1>
            <p className="text-xl text-white/80">
              ברוך הבא למחלקת {departmentData?.name || userData?.departmentName}
            </p>
          </div>

          {/* Navigation Cards (moved above department info) */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">מה תרצה לעשות?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {navigationCards.map((card, index) => (
                <button
                  key={index}
                  onClick={card.onClick}
                  className="relative bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl text-right group"
                >
                  {/* Icon */}
                  <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">
                    {card.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">{card.title}</h3>
                  <p className="text-white/70">{card.description}</p>
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none`} />
                </button>
              ))}
            </div>
          </div>

          {/* Department Info Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 mb-8">
            <h2 className="text-3xl font-bold text-white mb-6">פרטי המחלקה</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/5 rounded-xl p-6 text-center">
                <div className="text-4ל mb-2">🏢</div>
                <p className="text-white/70 mb-1">שם המחלקה</p>
                <p className="text-2ל font-bold text-white">
                  {departmentData?.name || userData?.departmentName}
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-6 text-center">
                <div className="text-4ל mb-2">👤</div>
                <p className="text-white/70 mb-1">מנהלים</p>
                <p className="text-2ל font-bold text-white">
                  {departmentData?.adminCount || 0}
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-6 text-center">
                <div className="text-4ל mb-2">👥</div>
                <p className="text-white/70 mb-1">עובדים</p>
                <p className="text-2ל font-bold text-white">
                  {departmentData?.workerCount || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">סיכום מהיר</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/5 rounded-xl p-6">
                <p className="text-white/70 mb-2">סידורים פעילים</p>
                <p className="text-4xl font-bold text-white">0</p>
                <p className="text-white/50 text-sm mt-2">החודש</p>
              </div>
              <div className="bg-white/5 rounded-xl p-6">
                <p className="text-white/70 mb-2">שעות עבודה</p>
                <p className="text-4xl font-bold text-white">0</p>
                <p className="text-white/50 text-sm mt-2">החודש</p>
              </div>
              <div className="bg-white/5 rounded-xl p-6">
                <p className="text-white/70 mb-2">סטטוס מחלקה</p>
                <p className="text-2xl font-bold text-green-400">פעילה ✓</p>
                <p className="text-white/50 text-sm mt-2">מוכן לעבודה</p>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Footer: quick links not in cards */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 mt-8">
          <h2 className="text-xl font-bold text-white mb-4">קיצורי דרך</h2>
          <div className="flex flex-wrap gap-3 text-sm">
            <button onClick={() => navigate('/owner/pending-approvals')} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white border border-white/20">אישורים ממתינים</button>
            <button onClick={() => navigate('/owner/primary-tasks/table-view')} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white border border-white/20">טבלת תורנות ראשית</button>
            <button onClick={() => navigate('/owner/settings/tasks')} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white border border-white/20">הגדרות משימות</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerDash;
