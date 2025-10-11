/**
 * Worker Dashboard Component
 * 
 * Main dashboard for workers to view schedules, submit requests, and view statistics.
 * Coherent design with Owner/Admin dashboards - glassmorphism, Hebrew RTL, responsive.
 * 
 * Location: src/pages/worker/WorkerDash.tsx
 * Purpose: Worker dashboard with schedule viewing and personal stats
 */

import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../../config/firebase';
import { UserData } from '../../lib/auth/authHelpers';
import Background from '../../components/layout/Background';
import Header from '../../components/layout/Header';

interface DepartmentData {
  departmentId: string;
  name: string;
  ownerId: string;
  ownerName: string;
  adminCount: number;
  workerCount: number;
}

const WorkerDash: React.FC = () => {
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

  const navigationCards = [
    {
      title: 'לוח תורנויות',
      description: 'צפה בתורנויות שלך',
      icon: '📋',
      onClick: () => alert('בקרוב!'),
      color: 'from-purple-600 to-blue-600'
    },
    {
      title: 'מערכת הגשת בקשות',
      description: 'הגש בקשות להעדפות משמרות',
      icon: '✍️',
      onClick: () => navigate('/worker/preferences'),
      color: 'from-blue-600 to-cyan-600'
    },
    {
      title: 'צפה בתוכנית שבועית',
      description: 'צפה בתוכנית העבודה השבועית',
      icon: '📅',
      onClick: () => alert('בקרוב!'),
      color: 'from-cyan-600 to-teal-600'
    },
    {
      title: 'סטטיסטיקה',
      description: 'צפה בסטטיסטיקות שלך',
      icon: '📊',
      onClick: () => alert('בקרוב!'),
      color: 'from-teal-600 to-green-600'
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
      <Header />
      
      <div className="relative z-10 min-h-screen py-8 pt-24">
        <div className="container mx-auto px-4">
          {/* Welcome Header */}
          <div className="mb-8">
            <h1 className="text-5xl font-bold text-white drop-shadow-lg mb-2">
              שלום, {userData?.firstName}!
            </h1>
            <p className="text-xl text-white/80">
              ברוך הבא למחלקת {departmentData?.name || userData?.departmentName}
            </p>
          </div>

          {/* Department Info Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-white/20 mb-8">
            <h2 className="text-3xl font-bold text-white mb-6">פרטי המחלקה</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
              <div className="bg-white/5 rounded-xl p-4 md:p-6 text-center">
                <div className="text-4xl mb-2">🏢</div>
                <p className="text-white/70 mb-1 text-sm md:text-base">שם המחלקה</p>
                <p className="text-xl md:text-2xl font-bold text-white break-words">
                  {departmentData?.name || userData?.departmentName}
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 md:p-6 text-center">
                <div className="text-4xl mb-2">👥</div>
                <p className="text-white/70 mb-1 text-sm md:text-base">סה"כ עובדים</p>
                <p className="text-xl md:text-2xl font-bold text-white">
                  {departmentData?.workerCount || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Cards */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">מה תרצה לעשות?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {navigationCards.map((card, index) => (
                <button
                  key={index}
                  onClick={card.onClick}
                  className="relative bg-white/10 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl text-right group"
                >
                  {/* Icon */}
                  <div className="text-5xl md:text-6xl mb-4 group-hover:scale-110 transition-transform">
                    {card.icon}
                  </div>

                  {/* Title */}
                  <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
                    {card.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm md:text-base text-white/70">
                    {card.description}
                  </p>

                  {/* Gradient Border */}
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none`} />
                </button>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-white/20 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">סיכום מהיר</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white/5 rounded-xl p-4 md:p-6">
                <p className="text-white/70 mb-2 text-sm md:text-base">תורנויות החודש</p>
                <p className="text-3xl md:text-4xl font-bold text-white">0</p>
                <p className="text-white/50 text-xs md:text-sm mt-2">סה"כ תורנויות</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 md:p-6">
                <p className="text-white/70 mb-2 text-sm md:text-base">שעות עבודה</p>
                <p className="text-3xl md:text-4xl font-bold text-white">0</p>
                <p className="text-white/50 text-xs md:text-sm mt-2">החודש</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 md:p-6">
                <p className="text-white/70 mb-2 text-sm md:text-base">תורנות הבאה</p>
                <p className="text-xl md:text-2xl font-bold text-blue-400">טרם נקבע</p>
                <p className="text-white/50 text-xs md:text-sm mt-2">ממתין לסידור</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkerDash;

