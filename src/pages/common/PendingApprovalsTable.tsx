/**
 * Shared Pending Approvals Table Component
 * 
 * Reusable component for displaying and managing pending user approvals.
 * Used by Developer, Owner, and Admin dashboards with different filtering options.
 * 
 * Location: src/pages/common/PendingApprovalsTable.tsx
 * Purpose: Shared approval management component
 */

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { UserData } from '../../lib/auth/authHelpers';
import { approveUser, rejectUser } from '../../lib/auth/approvalHelpers';
import Background from '../../components/layout/Background';
import Header from '../../components/layout/Header';
import { useNavigate } from 'react-router-dom';

type UserRole = 'owner' | 'admin' | 'worker';

interface PendingApprovalsTableProps {
  // Which roles to display (e.g., ['admin', 'worker'] for owner, ['worker'] for admin)
  allowedRoles: UserRole[];
  // Back navigation URL
  backUrl: string;
  // Page title
  title?: string;
  // Page description
  description?: string;
  // Whether to filter by current user's department
  filterByDepartment?: boolean;
  // Show email verification filter (developer sees verified only, others see all)
  requireEmailVerified?: boolean;
}

const PendingApprovalsTable: React.FC<PendingApprovalsTableProps> = ({
  allowedRoles,
  backUrl,
  title = 'ממתינים לאישור',
  description = 'משתמשים הממתינים לאישור',
  filterByDepartment = false,
  requireEmailVerified = false
}) => {
  const navigate = useNavigate();
  const [pendingUsers, setPendingUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [filter, setFilter] = useState<'all' | UserRole>(allowedRoles.length === 1 ? allowedRoles[0] : 'all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userDepartmentId, setUserDepartmentId] = useState<string | null>(null);

  // Get current user's department ID if needed
  useEffect(() => {
    if (!filterByDepartment) {
      setUserDepartmentId(''); // Not filtering by department
      return;
    }

    const fetchUserDepartment = async () => {
      if (!auth.currentUser) return;

      try {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserData;
          setUserDepartmentId(userData.departmentId || null);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserDepartment();
  }, [filterByDepartment]);

  // Real-time listener for pending users
  useEffect(() => {
    // Wait for department ID if filtering by department
    if (filterByDepartment && userDepartmentId === null) return;

    let q;
    
    if (filterByDepartment && userDepartmentId) {
      // Filter by department
      q = query(
        collection(db, 'users'),
        where('status', '==', 'pending'),
        where('departmentId', '==', userDepartmentId)
      );
    } else {
      // No department filter
      q = query(
        collection(db, 'users'),
        where('status', '==', 'pending')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users: UserData[] = [];
      
      snapshot.forEach((doc) => {
        const userData = doc.data() as UserData;
        
        // Filter by allowed roles
        if (!allowedRoles.includes(userData.role as UserRole)) {
          return;
        }

        // Filter by email verification if required
        if (requireEmailVerified && !userData.emailVerified) {
          return;
        }

        users.push(userData);
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
  }, [allowedRoles, userDepartmentId, filterByDepartment, requireEmailVerified]);

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
      case 'owner': return 'בעל/ת מחלקה';
      case 'admin': return 'מנהל/ת';
      case 'worker': return 'עובד/ת';
      default: return role;
    }
  };

  const getFilterCounts = () => {
    const counts: any = {
      all: pendingUsers.length
    };
    
    allowedRoles.forEach(role => {
      counts[role] = pendingUsers.filter(u => u.role === role).length;
    });

    return counts;
  };

  const counts = getFilterCounts();

  return (
    <div dir="rtl" className="relative flex-1 min-h-screen">
      <Background singleImage="/images/image_1.png" />
      <Header />
      
      <div className="relative z-10 min-h-screen py-8 pt-24">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate(backUrl)}
              className="text-white/80 hover:text-white mb-4 flex items-center gap-2"
            >
              ← חזרה למסך הראשי
            </button>
            <h1 className="text-4xl font-bold text-white drop-shadow-lg">
              {title}
            </h1>
            <p className="text-white/80 mt-2">
              {description}
            </p>
            {requireEmailVerified && (
              <p className="text-white/60 mt-1 text-sm">
                💡 טיפ: משתמשים יופיעו כאן רק לאחר שיאמתו את האימייל וינסו להתחבר למערכת
              </p>
            )}
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

          {/* Filter Tabs - only show if more than one role */}
          {allowedRoles.length > 1 && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2 mb-6 border border-white/20 inline-flex gap-2 flex-wrap">
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
              {allowedRoles.includes('owner') && (
                <button
                  onClick={() => setFilter('owner')}
                  className={`px-6 py-3 rounded-xl font-medium transition-all ${
                    filter === 'owner'
                      ? 'bg-white/20 text-white shadow-lg'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  בעלים ({counts.owner || 0})
                </button>
              )}
              {allowedRoles.includes('admin') && (
                <button
                  onClick={() => setFilter('admin')}
                  className={`px-6 py-3 rounded-xl font-medium transition-all ${
                    filter === 'admin'
                      ? 'bg-white/20 text-white shadow-lg'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  מנהלים ({counts.admin || 0})
                </button>
              )}
              {allowedRoles.includes('worker') && (
                <button
                  onClick={() => setFilter('worker')}
                  className={`px-6 py-3 rounded-xl font-medium transition-all ${
                    filter === 'worker'
                      ? 'bg-white/20 text-white shadow-lg'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  עובדים ({counts.worker || 0})
                </button>
              )}
            </div>
          )}

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
                  משתמשים יופיעו כאן לאחר שירשמו ויאמתו את האימייל
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5 border-b border-white/20">
                    <tr>
                      <th className="px-4 md:px-6 py-4 text-right text-white font-semibold">שם</th>
                      <th className="px-4 md:px-6 py-4 text-right text-white font-semibold">אימייל</th>
                      <th className="px-4 md:px-6 py-4 text-right text-white font-semibold">סטטוס אימות</th>
                      <th className="px-4 md:px-6 py-4 text-right text-white font-semibold">תפקיד</th>
                      {!filterByDepartment && (
                        <th className="px-4 md:px-6 py-4 text-right text-white font-semibold">מחלקה</th>
                      )}
                      <th className="px-4 md:px-6 py-4 text-right text-white font-semibold">תאריך</th>
                      <th className="px-4 md:px-6 py-4 text-center text-white font-semibold">פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.userId} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                        <td className="px-4 md:px-6 py-4 text-white">
                          {user.firstName} {user.lastName}
                        </td>
                        <td className="px-4 md:px-6 py-4 text-white/80 font-mono text-sm" dir="ltr">
                          {user.email}
                        </td>
                        <td className="px-4 md:px-6 py-4">
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
                        <td className="px-4 md:px-6 py-4 text-white">
                          {getRoleInHebrew(user.role)}
                        </td>
                        {!filterByDepartment && (
                          <td className="px-4 md:px-6 py-4 text-white">
                            {user.departmentName}
                            {user.customDepartmentName && (
                              <span className="text-yellow-400 text-sm mr-2">(חדש)</span>
                            )}
                          </td>
                        )}
                        <td className="px-4 md:px-6 py-4 text-white/70 text-sm">
                          {user.createdAt?.toDate?.()?.toLocaleDateString('he-IL') || 'N/A'}
                        </td>
                        <td className="px-4 md:px-6 py-4">
                          <div className="flex gap-2 justify-center flex-wrap">
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

export default PendingApprovalsTable;
