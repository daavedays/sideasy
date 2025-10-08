/**
 * Owner Pending Approvals Page
 * 
 * Displays pending admins and workers for the owner's department
 * and allows owner to approve/reject them.
 * 
 * Location: src/pages/owner/OwnerPendingApprovals.tsx
 * Purpose: Department-specific user approval management
 */

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { UserData } from '../../lib/auth/authHelpers';
import { approveUser, rejectUser } from '../../lib/auth/approvalHelpers';
import Background from '../../components/layout/Background';
import { useNavigate } from 'react-router-dom';

type FilterRole = 'all' | 'admin' | 'worker';

const OwnerPendingApprovals: React.FC = () => {
  const navigate = useNavigate();
  const [pendingUsers, setPendingUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [filter, setFilter] = useState<FilterRole>('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [ownerDepartmentId, setOwnerDepartmentId] = useState<string | null>(null);

  // Get owner's department ID
  useEffect(() => {
    const fetchOwnerDepartment = async () => {
      if (!auth.currentUser) return;

      try {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserData;
          setOwnerDepartmentId(userData.departmentId || null);
        }
      } catch (error) {
        console.error('Error fetching owner data:', error);
      }
    };

    fetchOwnerDepartment();
  }, []);

  // Real-time listener for pending users in owner's department
  useEffect(() => {
    if (!ownerDepartmentId) return;

    const q = query(
      collection(db, 'users'),
      where('status', '==', 'pending'),
      where('departmentId', '==', ownerDepartmentId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users: UserData[] = [];
      
      snapshot.forEach((doc) => {
        const userData = doc.data() as UserData;
        // Only show admins and workers (not owners)
        if (userData.role === 'admin' || userData.role === 'worker') {
          users.push(userData);
        }
      });
      
      // Sort by createdAt
      users.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      
      setPendingUsers(users);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching pending users:', error);
      setMessage({ 
        type: 'error', 
        text: 'שגיאה בטעינת משתמשים. אנא רענן את הדף.' 
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ownerDepartmentId]);

  // Filter users by role
  useEffect(() => {
    if (filter === 'all') {
      setFilteredUsers(pendingUsers);
    } else {
      setFilteredUsers(pendingUsers.filter(user => user.role === filter));
    }
  }, [pendingUsers, filter]);

  const handleApprove = async (user: UserData) => {
    if (!auth.currentUser) return;
    
    setActionLoading(user.userId);
    setMessage(null);

    const result = await approveUser(user.userId, user, auth.currentUser.uid);
    
    if (result.success) {
      setMessage({ type: 'success', text: `${user.firstName} ${user.lastName} אושר בהצלחה!` });
    } else {
      setMessage({ type: 'error', text: result.message });
    }
    
    setActionLoading(null);
  };

  const handleReject = async (user: UserData) => {
    if (!auth.currentUser) return;
    
    if (!window.confirm(`האם אתה בטוח שברצונך לדחות את ${user.firstName} ${user.lastName}?`)) {
      return;
    }

    setActionLoading(user.userId);
    setMessage(null);

    const result = await rejectUser(user.userId, auth.currentUser.uid);
    
    if (result.success) {
      setMessage({ type: 'success', text: `${user.firstName} ${user.lastName} נדחה` });
    } else {
      setMessage({ type: 'error', text: result.message });
    }
    
    setActionLoading(null);
  };

  const getRoleInHebrew = (role: string) => {
    switch (role) {
      case 'admin': return 'מנהל/ת';
      case 'worker': return 'עובד/ת';
      default: return role;
    }
  };

  const getFilterCounts = () => {
    return {
      all: pendingUsers.length,
      admin: pendingUsers.filter(u => u.role === 'admin').length,
      worker: pendingUsers.filter(u => u.role === 'worker').length
    };
  };

  const counts = getFilterCounts();

  return (
    <div dir="rtl" className="relative flex-1 min-h-screen">
      <Background singleImage="/images/image_1.png" />
      
      <div className="relative z-10 min-h-screen py-8">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/owner')}
              className="text-white/80 hover:text-white mb-4 flex items-center gap-2"
            >
              ← חזרה למסך הראשי
            </button>
            <h1 className="text-4xl font-bold text-white drop-shadow-lg">
              ממתינים לאישור
            </h1>
            <p className="text-white/80 mt-2">
              מנהלים ועובדים הממתינים לאישור עבור המחלקה שלך. ניתן לאשר רק משתמשים שאימתו את האימייל.
            </p>
            <p className="text-white/60 mt-1 text-sm">
              💡 טיפ: סטטוס האימות מתעדכן אוטומטית כאשר משתמשים מנסים להתחבר לאחר אימות האימייל
            </p>
          </div>

          {/* Success/Error Message */}
          {message && (
            <div className={`mb-6 p-4 rounded-xl ${
              message.type === 'success'
                ? 'bg-green-500/20 border border-green-500/50'
                : 'bg-red-500/20 border border-red-500/50'
            }`}>
              <p className="text-white text-center">{message.text}</p>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2 mb-6 border border-white/20 inline-flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
                filter === 'all'
                  ? 'bg-white/20 text-white shadow-lg'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              הכל ({counts.all})
            </button>
            <button
              onClick={() => setFilter('admin')}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
                filter === 'admin'
                  ? 'bg-white/20 text-white shadow-lg'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              מנהלים ({counts.admin})
            </button>
            <button
              onClick={() => setFilter('worker')}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
                filter === 'worker'
                  ? 'bg-white/20 text-white shadow-lg'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              עובדים ({counts.worker})
            </button>
          </div>

          {/* Users Table */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-white">
                <p className="text-xl">טוען משתמשים...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-white">
                <p className="text-xl">אין משתמשים ממתינים לאישור</p>
                <p className="text-white/70 mt-2">
                  משתמשים יופיעו כאן לאחר שירשמו למחלקה שלך ויאמתו את האימייל
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5 border-b border-white/20">
                    <tr>
                      <th className="px-6 py-4 text-right text-white font-semibold">שם</th>
                      <th className="px-6 py-4 text-right text-white font-semibold">אימייל</th>
                      <th className="px-6 py-4 text-right text-white font-semibold">סטטוס אימות</th>
                      <th className="px-6 py-4 text-right text-white font-semibold">תפקיד</th>
                      <th className="px-6 py-4 text-right text-white font-semibold">תאריך</th>
                      <th className="px-6 py-4 text-center text-white font-semibold">פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.userId} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-white">
                          {user.firstName} {user.lastName}
                        </td>
                        <td className="px-6 py-4 text-white/80 font-mono text-sm" dir="ltr">
                          {user.email}
                        </td>
                        <td className="px-6 py-4">
                          {user.emailVerified ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/50 text-green-300 text-sm">
                              ✓ אומת
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 text-sm">
                              ⏳ ממתין לאימות
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-white">
                          {getRoleInHebrew(user.role)}
                        </td>
                        <td className="px-6 py-4 text-white/70 text-sm">
                          {user.createdAt?.toDate?.()?.toLocaleDateString('he-IL') || 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => handleApprove(user)}
                              disabled={actionLoading === user.userId || !user.emailVerified}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={!user.emailVerified ? 'המשתמש חייב לאמת את האימייל לפני אישור' : ''}
                            >
                              {actionLoading === user.userId ? 'מאשר...' : 'אשר'}
                            </button>
                            <button
                              onClick={() => handleReject(user)}
                              disabled={actionLoading === user.userId}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              דחה
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerPendingApprovals;
