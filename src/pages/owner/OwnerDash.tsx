/**
 * Owner Dashboard Component
 * 
 * Main dashboard for department owners with navigation cards and department stats.
 * 
 * Location: src/pages/owner/OwnerDash.tsx
 * Purpose: Owner dashboard with department overview
 */

import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
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

const OwnerDash: React.FC = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [departmentData, setDepartmentData] = useState<DepartmentData | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
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

  // Real-time listener for pending approvals (admins and workers for this department)
  useEffect(() => {
    if (!userData?.departmentId) return;

    const q = query(
      collection(db, 'users'),
      where('status', '==', 'pending'),
      where('departmentId', '==', userData.departmentId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Count only admins and workers (not owners)
      const count = snapshot.docs.filter(doc => {
        const user = doc.data() as UserData;
        return user.role === 'admin' || user.role === 'worker';
      }).length;
      
      setPendingCount(count);
    }, (error) => {
      console.error('Error fetching pending users:', error);
    });

    return () => unsubscribe();
  }, [userData?.departmentId]);

  const navigationCards = [
    {
      title: 'בקשות ממתינות לאישור',
      description: 'אשר או דחה מנהלים ועובדים חדשים',
      icon: '✋',
      badge: pendingCount > 0 ? `${pendingCount}` : null,
      onClick: () => navigate('/owner/pending-approvals'),
      color: 'from-purple-600 to-pink-600'
    },
    {
      title: 'ניהול עובדים',
      description: 'הוסף, ערוך וצפה בעובדי המחלקה',
      icon: '👥',
      onClick: () => alert('בקרוב!'),
      color: 'from-blue-600 to-cyan-600'
    },
    {
      title: 'הגדרות',
      description: 'נהל הגדרות מחלקה וחשבון',
      icon: '⚙️',
      onClick: () => alert('בקרוב!'),
      color: 'from-cyan-600 to-green-600'
    },
    {
      title: 'סטטיסטיקות',
      description: 'צפה בסטטיסטיקות מחלקה',
      icon: '📊',
      onClick: () => alert('בקרוב!'),
      color: 'from-green-600 to-emerald-600'
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
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 mb-8">
            <h2 className="text-3xl font-bold text-white mb-6">פרטי המחלקה</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/5 rounded-xl p-6 text-center">
                <div className="text-4xl mb-2">🏢</div>
                <p className="text-white/70 mb-1">שם המחלקה</p>
                <p className="text-2xl font-bold text-white">
                  {departmentData?.name || userData?.departmentName}
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-6 text-center">
                <div className="text-4xl mb-2">👤</div>
                <p className="text-white/70 mb-1">מנהלים</p>
                <p className="text-2xl font-bold text-white">
                  {departmentData?.adminCount || 0}
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-6 text-center">
                <div className="text-4xl mb-2">👥</div>
                <p className="text-white/70 mb-1">עובדים</p>
                <p className="text-2xl font-bold text-white">
                  {departmentData?.workerCount || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Cards */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">מה תרצה לעשות?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {navigationCards.map((card, index) => (
                <button
                  key={index}
                  onClick={card.onClick}
                  className="relative bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl text-right group"
                >
                  {/* Badge */}
                  {card.badge && (
                    <div className="absolute top-4 left-4 bg-red-500 text-white text-sm font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
                      {card.badge}
                    </div>
                  )}

                  {/* Icon */}
                  <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">
                    {card.icon}
                  </div>

                  {/* Title */}
                  <h3 className="text-2xl font-bold text-white mb-2">
                    {card.title}
                  </h3>

                  {/* Description */}
                  <p className="text-white/70">
                    {card.description}
                  </p>

                  {/* Gradient Border */}
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none`} />
                </button>
              ))}
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
      </div>
    </div>
  );
};

export default OwnerDash;
