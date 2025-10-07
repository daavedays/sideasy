import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn } from '../../lib/auth/authHelpers';
import { getDashboardRoute } from '../../lib/auth/authHelpers';

/**
 * Login Form Component
 * 
 * This component renders the login form and handles user authentication.
 * 
 * Location: src/pages/login/LoginForm.tsx
 * Purpose: Login form with full authentication logic
 */

const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    
    // Validation
    if (!formData.email || !formData.password) {
      setMessage({ type: 'error', text: 'אנא הזן אימייל וסיסמה' });
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await signIn(formData.email, formData.password);
      
      if (result.success && result.userData) {
        setMessage({ type: 'success', text: result.message });
        
        // Redirect to appropriate dashboard based on role
        const dashboardRoute = getDashboardRoute(result.userData.role);
        
        // Small delay to show success message
        setTimeout(() => {
          navigate(dashboardRoute);
        }, 500);
        
      } else if (result.needsApproval) {
        setMessage({ type: 'warning', text: result.message });
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'שגיאה בהתחברות. אנא נסה שוב' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="text-center">
        <h3 className="text-2xl font-semibold text-white mb-2">
          ברוכים הבאים
        </h3>
        <p className="text-white/80 text-sm">
          התחברו לחשבון שלכם
        </p>
      </div>

      {/* Success/Error/Warning Message */}
      {message && (
        <div className={`p-4 rounded-xl ${
          message.type === 'success' 
            ? 'bg-green-500/20 border border-green-500/50' 
            : message.type === 'warning'
            ? 'bg-yellow-500/20 border border-yellow-500/50'
            : 'bg-red-500/20 border border-red-500/50'
        }`}>
          <p className="text-white text-sm text-center">{message.text}</p>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-white/90">
            כתובת אימייל
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="הכנס כתובת אימייל"
            required
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
            dir="ltr"
          />
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-white/90">
            סיסמה
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="הכנס סיסמה"
            required
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
            dir="ltr"
          />
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center text-white/80">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-white/20 bg-white/10 text-white focus:ring-white/30 focus:ring-offset-0 mr-2"
            />
            זכור אותי
          </label>
          <button
            type="button"
            className="text-white/80 hover:text-white transition-colors duration-200"
            onClick={() => setMessage({ type: 'warning', text: 'פיצ\'ר זה יהיה זמין בקרוב' })}
          >
            שכחת סיסמה?
          </button>
        </div>

        {/* Login Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-300 transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          {loading ? 'מתחבר...' : 'התחבר'}
        </button>
      </form>

    </div>
  );
};

export default LoginForm;
