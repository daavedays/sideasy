import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RoleProvider } from './context/RoleContext';
import { DepartmentProvider } from './context/DepartmentContext';
import { AppRouter } from './routes/AppRouter';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';

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

function App() {
  return (
    <Router>
      <AuthProvider>
        <RoleProvider>
          <DepartmentProvider>
            <div className="min-h-screen flex flex-col">
              <Header />
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
