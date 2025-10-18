import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import Background from '../../components/layout/Background';
import Header from '../../components/layout/Header';

/**
 * Developer Dashboard Component
 * 
 * Dashboard for developer with navigation cards and quick stats.
 * 
 * Location: src/pages/developer/DevDash.tsx
 * Purpose: Developer-specific dashboard page
 */

const DevDash: React.FC = () => {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [userName, setUserName] = useState('Developer');

  useEffect(() => {
    // Get pending users count (includes all pending, verified and unverified)
    const fetchPendingCount = async () => {
      const q = query(
        collection(db, 'users'),
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(q);
      setPendingCount(snapshot.size);
    };

    // Get user name
    const fetchUserName = async () => {
      if (auth.currentUser) {
        try {
          const userDocRef = doc(db, 'users', auth.currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setUserName(userData.firstName || 'Developer');
          }
        } catch (error) {
          console.error('Error fetching user:', error);
        }
      }
    };

    fetchPendingCount();
    fetchUserName();
  }, []);

  const navigationCards = [
    {
      title: 'ממתינים לאישור',
      description: 'אשר או דחה משתמשים חדשים',
      icon: '👥',
      badge: pendingCount > 0 ? `${pendingCount}` : null,
      onClick: () => navigate('/developer/pending-approvals'),
      color: 'from-purple-600 to-blue-600'
    },
    {
      title: 'ניהול מחלקות',
      description: 'צפה ונהל את כל המחלקות',
      icon: '🏢',
      onClick: () => alert('בקרוב!'),
      color: 'from-blue-600 to-cyan-600'
    },
    {
      title: 'משתמשים',
      description: 'צפה בכל המשתמשים במערכת',
      icon: '📊',
      onClick: () => alert('בקרוב!'),
      color: 'from-cyan-600 to-green-600'
    },
    {
      title: 'הגדרות',
      description: 'הגדרות מערכת ואבטחה',
      icon: '⚙️',
      onClick: () => alert('בקרוב!'),
      color: 'from-green-600 to-emerald-600'
    }
  ];

  return (
    <div dir="rtl" className="relative flex-1 min-h-screen">
      <Background singleImage="/images/image_1.png" />
      <Header />
      
      <div className="relative z-10 min-h-screen py-8 pt-24">
        <div className="container mx-auto px-4">
          {/* Welcome Header */}
          <div className="mb-12 text-center">
            <h1 className="text-5xl font-bold text-white drop-shadow-lg mb-4">
              שלום, {userName}!
            </h1>
            <p className="text-xl text-white/80">
              מה תרצה לעשות היום?
            </p>
          </div>

          {/* Navigation Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {navigationCards.map((card, index) => (
              <button
                key={index}
                onClick={card.onClick}
                className="relative bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl text-right group"
              >
                {/* Badge */}
                {card.badge && (
                  <div className="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
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

          {/* Quick Stats */}
          <div className="mt-12 max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                <p className="text-white/70 mb-2">משתמשים ממתינים</p>
                <p className="text-4xl font-bold text-white">{pendingCount}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                <p className="text-white/70 mb-2">מחלקות פעילות</p>
                <p className="text-4xl font-bold text-white">3</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                <p className="text-white/70 mb-2">סטטוס מערכת</p>
                <p className="text-2xl font-bold text-green-400">פעילה ✓</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Footer: quick links not in cards (developer) */}
      <div className="mt-8 max-w-4xl mx-auto bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
        <h2 className="text-xl font-bold text-white mb-4">קיצורי דרך</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <button onClick={() => navigate('/developer/pending-approvals')} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white border border-white/20">אישורים ממתינים</button>
        </div>
      </div>
    </div>
  );
};

export default DevDash;

