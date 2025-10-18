import { BrowserRouter as Router, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { signOut } from 'firebase/auth';
import { AuthProvider } from './context/AuthContext';
import { RoleProvider, useRoleContext } from './context/RoleContext';
import { DepartmentProvider } from './context/DepartmentContext';
import { AppRouter } from './routes/AppRouter';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import { auth } from './config/firebase';
import { UserRole } from './config/appConfig';
import Button from './components/ui/Button';

/**
 * Main App Component
 * 
 * This is the root component of the Sideasy Scheduler application.
 * Firebase is initialized in main.tsx and available throughout the app.
 * 
 * The app is wrapped with context providers for authentication, roles, and departments.
 * 
 * Location: src/App.tsx
 * Purpose: Root application component with routing and context providers
 */

function RoleChangeGate() {
  const { userRole, loading } = useRoleContext();
  const [mustLogout, setMustLogout] = useState(false);
  const [processing, setProcessing] = useState(false);
  const previousRoleRef = useRef<UserRole | null>(null);
  const lastUidRef = useRef<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    const uid = auth.currentUser?.uid || null;

    // If user changes (logout/login), reset tracking and treat next role as fresh
    if (uid !== lastUidRef.current) {
      lastUidRef.current = uid;
      previousRoleRef.current = userRole || null;
      setMustLogout(false);
      return;
    }

    if (!userRole) return;

    // First role seen for this uid in this session
    if (!previousRoleRef.current) {
      previousRoleRef.current = userRole;
      return;
    }

    // Role changed for the same uid → force logout gate
    if (previousRoleRef.current !== userRole) {
      setMustLogout(true);
    }
  }, [userRole, loading]);

  // If user is no longer authenticated (role becomes null), hide the gate
  useEffect(() => {
    if (loading) return;
    if (!userRole) {
      setMustLogout(false);
      previousRoleRef.current = null;
      lastUidRef.current = null;
    }
  }, [userRole, loading]);

  const handleLogout = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      await signOut(auth);
    } catch {}
    // Hard redirect as a fallback to avoid any router/z-index issues
    window.location.replace('/login');
  };

  if (!mustLogout || !userRole) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl p-8 text-center">
        <div className="text-5xl mb-4">🔄</div>
        <h2 className="text-3xl font-bold text-white mb-2">עדכון הרשאות הושלם</h2>
        <p className="text-white/80 mb-6">
          התפקיד שלך עודכן על ידי המנהל. כדי להמשיך, נבצע התנתקות מהירה ואז תוכל להתחבר מחדש.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={handleLogout} disabled={processing} fullWidth>
            {processing ? 'מתנתק...' : 'התנתקות והתחברות מחדש'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <RoleProvider>
          <DepartmentProvider>
            <div className="min-h-screen flex flex-col">
              <Header />
              {/* Non-dismissible gate shown if role changes mid-session */}
              <RoleChangeGate />
              <main className="flex-1">
                <AppRouter />
              </main>
              <Footer />
            </div>
          </DepartmentProvider>
        </RoleProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
