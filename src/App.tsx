import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AuthPage from './pages/login/AuthPage';
import Dashboard from './pages/common/dashboard';
import Header from './components/header';
import Footer from './components/footer';

/**
 * Main App Component
 * 
 * This is the root component of the Sideasy Scheduler application.
 * Firebase is initialized in main.tsx and available throughout the app.
 * 
 * Location: src/App.tsx
 * Purpose: Root application component with routing
 */

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<AuthPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;