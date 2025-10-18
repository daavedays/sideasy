import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, onSnapshot, getDocs, orderBy } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { REALTIME_LISTENERS_ENABLED } from '../../config/appConfig';
import { useRoleContext } from '../../context/RoleContext';

/**
 * Header Component
 * 
 * Transparent header with navigation and logout functionality.
 * Features Hebrew text with RTL support and glassmorphism design.
 * Only shows on non-authentication pages.
 * 
 * Location: src/components/layout/Header.tsx
 * Purpose: Main navigation header for the application
 */

interface UserData {
  firstName?: string;
  lastName?: string;
  role?: 'developer' | 'owner' | 'admin' | 'worker';
  departmentId?: string | null;
}

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const roleCtx = useRoleContext();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [scheduleNotificationsCount, setScheduleNotificationsCount] = useState(0);
  const isDashboardRoute = ['/developer', '/owner', '/admin', '/worker'].includes(location.pathname);

  // Don't show header on login/auth pages
  const isAuthPage = location.pathname === '/' || location.pathname === '/login';
  
  useEffect(() => {
    if (isAuthPage) return;
    // Prefer RoleContext for live updates; fallback fetch if missing
    if (roleCtx?.userData) {
      setUserData(roleCtx.userData as any);
      return;
    }
    (async () => {
      if (!auth.currentUser) return;
      try {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setUserData(userDocSnap.data() as UserData);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    })();
  }, [isAuthPage, roleCtx?.userData]);

  // Real-time pending approvals counter for developer/owner/admin
  useEffect(() => {
    if (!userData?.role) return;

    // Build role-based query
    let approvalsQuery: any = null;
    if (userData.role === 'developer') {
      approvalsQuery = query(
        collection(db, 'users'),
        where('status', '==', 'pending')
      );
    } else if ((userData.role === 'admin' || userData.role === 'owner') && userData.departmentId) {
      approvalsQuery = query(
        collection(db, 'users'),
        where('status', '==', 'pending'),
        where('departmentId', '==', userData.departmentId)
      );
    } else {
      setPendingApprovalsCount(0);
      return;
    }

    let unsubscribe = () => {};
    const computeCount = (docs: Array<any>) => {
      const count = docs.filter((d: any) => {
        const u = (d.data ? d.data() : d) as any;
        if (userData.role === 'admin') return u.role === 'worker';
        if (userData.role === 'owner') return u.role === 'worker' || u.role === 'admin';
        // developer sees all pending
        return true;
      }).length;
      setPendingApprovalsCount(count);
    };

    if (REALTIME_LISTENERS_ENABLED) {
      unsubscribe = onSnapshot(approvalsQuery, (snapshot: any) => {
        computeCount(snapshot.docs as any[]);
      }, (error: any) => {
        console.error('Error fetching pending approvals:', error);
      });
    } else {
      (async () => {
        try {
          const snap = await getDocs(approvalsQuery);
          computeCount(snap.docs);
        } catch (e) {
          console.error('Error counting pending approvals:', e);
        }
      })();
    }

    return () => unsubscribe();
  }, [userData?.departmentId, userData?.role]);

  // Real-time notifications (combined schedule published) for owner/admin/worker
  useEffect(() => {
    if (!userData?.role || !userData?.departmentId) return;

    const notifQuery = query(
      collection(db, 'departments', userData.departmentId, 'notifications'),
      orderBy('createdAt', 'desc')
    );

    let unsubscribe = () => {};
    const computeCount = (docs: Array<any>) => {
      const uid = auth.currentUser?.uid;
      let count = 0;
      docs.forEach((d: any) => {
        const data = (d.data ? d.data() : d) as any;
        if (data?.type !== 'combined_schedule_published') return;
        const readBy: string[] = Array.isArray(data.readBy) ? data.readBy : [];
        if (uid && !readBy.includes(uid)) count += 1;
      });
      setScheduleNotificationsCount(count);
    };

    if (REALTIME_LISTENERS_ENABLED) {
      unsubscribe = onSnapshot(notifQuery, (snapshot: any) => {
        computeCount(snapshot.docs as any[]);
      }, (error: any) => {
        console.error('Error fetching notifications:', error);
      });
    } else {
      (async () => {
        try {
          const snap = await getDocs(notifQuery);
          computeCount(snap.docs);
        } catch (e) {
          console.error('Error counting notifications:', e);
        }
      })();
    }

    return () => unsubscribe();
  }, [userData?.departmentId, userData?.role]);

  if (isAuthPage) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleDashboardClick = () => {
    // Navigate based on role
    if (userData?.role === 'developer') {
      navigate('/developer');
    } else if (userData?.role === 'owner') {
      navigate('/owner');
    } else if (userData?.role === 'admin') {
      navigate('/admin');
    } else if (userData?.role === 'worker') {
      navigate('/worker');
    }
  };

  const handleShiftsClick = () => {
    if (userData?.role === 'owner') {
      navigate('/owner/primary-tasks');
    } else if (userData?.role === 'admin') {
      navigate('/admin/primary-tasks');
    } else if (userData?.role === 'worker') {
      // For workers, shifts currently not implemented; go to dashboard
      navigate('/worker');
    }
  };

  const handleWorkersClick = () => {
    if (userData?.role === 'owner') {
      navigate('/owner/manage-workers');
    } else if (userData?.role === 'admin') {
      navigate('/admin/manage-workers');
    }
  };

  const handleSettingsClick = () => {
    if (userData?.role === 'owner') {
      navigate('/owner/settings');
    } else if (userData?.role === 'admin') {
      navigate('/admin/settings');
    } else if (userData?.role === 'worker') {
      navigate('/worker/preferences');
    }
  };

  const handleApprovalsClick = () => {
    if (userData?.role === 'owner') {
      navigate('/owner/pending-approvals');
    } else if (userData?.role === 'admin') {
      navigate('/admin/pending-approvals');
    } else if (userData?.role === 'developer') {
      navigate('/developer/pending-approvals');
    }
  };

  const getInitials = () => {
    if (userData?.firstName) {
      return userData.firstName.charAt(0);
    }
    return 'U';
  };

  const getUserDisplayName = () => {
    if (userData?.firstName && userData?.lastName) {
      return `${userData.firstName} ${userData.lastName}`;
    }
    return userData?.firstName || 'משתמש';
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/10 backdrop-blur-md border-b border-white/20 shadow-lg">
      <div className="container mx-auto px-4 py-0">
        <div className="flex items-center justify-between">
          {/* Left actions (RTL: appears on left visually) */}
          <div className="flex items-center space-x-2 space-x-reverse">
            {/* Back Button (hidden on dashboard routes) */}
            {!isDashboardRoute && (
              <button
                onClick={handleBack}
                className="p-2 text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
                aria-label="חזרה"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Logo/Brand (hidden on dashboard routes – shown on opposite corner) */}
            {!isDashboardRoute && (
              <div 
                className="cursor-pointer"
                onClick={handleDashboardClick}
              >
                <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                  Sideasy
                </h1>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-6 space-x-reverse">
            <button
              onClick={handleDashboardClick}
              className="text-white/90 hover:text-white font-medium transition-colors duration-200 hover:bg-white/10 px-3 py-2 rounded-lg"
            >
              דשבורד
            </button>
            <button
              onClick={handleShiftsClick}
              className="text-white/90 hover:text-white font-medium transition-colors duration-200 hover:bg-white/10 px-3 py-2 rounded-lg"
            >
              משמרות
            </button>
            {userData?.role !== 'worker' && (
              <button
                onClick={handleWorkersClick}
                className="text-white/90 hover:text-white font-medium transition-colors duration-200 hover:bg-white/10 px-3 py-2 rounded-lg"
              >
                עובדים
              </button>
            )}
            <button
              onClick={handleSettingsClick}
              className="text-white/90 hover:text-white font-medium transition-colors duration-200 hover:bg-white/10 px-3 py-2 rounded-lg"
            >
              הגדרות
            </button>
            {(userData?.role === 'owner' || userData?.role === 'admin' || userData?.role === 'developer') && (
              <button
                onClick={handleApprovalsClick}
                className="relative text-white/90 hover:text-white font-medium transition-colors duration-200 hover:bg-white/10 px-3 py-2 rounded-lg"
              >
                אישורים
                {pendingApprovalsCount > 0 && (
                  <span className="absolute -top-2 -left-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 px-1.5 flex items-center justify-center">
                    {pendingApprovalsCount}
                  </span>
                )}
              </button>
            )}
          </nav>

          {/* User Actions */}
          <div className="flex items-center space-x-4 space-x-reverse">
            {/* Logo/Brand on dashboard routes placed on the opposite corner */}
            {isDashboardRoute && (
              <div 
                className="cursor-pointer"
                onClick={handleDashboardClick}
              >
                <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                  Sideasy
                </h1>
              </div>
            )}
            {/* Notifications (owner/admin only) */}
            {(userData?.role === 'owner' || userData?.role === 'admin' || userData?.role === 'developer' || userData?.role === 'worker') && (
              <button
                onClick={() => {
                  if (userData?.role === 'worker') {
                    navigate('/worker/combined-schedule');
                    return;
                  }
                  handleApprovalsClick();
                }}
                className="relative p-2 text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
                aria-label="התראות"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                {(pendingApprovalsCount > 0 || scheduleNotificationsCount > 0) && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 min-w-[1.25rem] px-1.5 flex items-center justify-center">
                    {userData?.role === 'worker' ? scheduleNotificationsCount : (pendingApprovalsCount + scheduleNotificationsCount)}
                  </span>
                )}
              </button>
            )}

            {/* Profile Menu */}
            <div className="relative">
              <button 
                onClick={handleDashboardClick}
                className="flex items-center space-x-2 space-x-reverse text-white/90 hover:text-white hover:bg-white/10 px-3 py-2 rounded-lg transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">{getInitials()}</span>
                </div>
                <span className="hidden md:block font-medium">{getUserDisplayName()}</span>
              </button>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 backdrop-blur-sm border border-white/30 hover:border-white/50"
            >
              התנתק
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(v => !v)}
              className="md:hidden p-2 text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
              aria-label="תפריט"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white/10 backdrop-blur-md border-t border-white/20">
          <div className="container mx-auto px-4 py-2 flex flex-col space-y-1">
            <button onClick={() => { setIsMobileMenuOpen(false); handleDashboardClick(); }} className="text-white/90 text-right w-full hover:text-white hover:bg-white/10 px-3 py-2 rounded-lg">דשבורד</button>
            <button onClick={() => { setIsMobileMenuOpen(false); handleShiftsClick(); }} className="text-white/90 text-right w-full hover:text-white hover:bg-white/10 px-3 py-2 rounded-lg">משמרות</button>
            {userData?.role !== 'worker' && (
              <button onClick={() => { setIsMobileMenuOpen(false); handleWorkersClick(); }} className="text-white/90 text-right w-full hover:text-white hover:bg-white/10 px-3 py-2 rounded-lg">עובדים</button>
            )}
            <button onClick={() => { setIsMobileMenuOpen(false); handleSettingsClick(); }} className="text-white/90 text-right w-full hover:text-white hover:bg-white/10 px-3 py-2 rounded-lg">הגדרות</button>
            {(userData?.role === 'owner' || userData?.role === 'admin') && (
              <button onClick={() => { setIsMobileMenuOpen(false); handleApprovalsClick(); }} className="relative text-white/90 text-right w-full hover:text-white hover:bg-white/10 px-3 py-2 rounded-lg">
                אישורים
                {pendingApprovalsCount > 0 && (
                  <span className="absolute top-1 left-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 px-1.5 flex items-center justify-center">
                    {pendingApprovalsCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;

