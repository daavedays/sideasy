import React, { useState } from 'react';
import { signUp } from '../../lib/auth/authHelpers';

/**
 * Signup Form Component
 * 
 * This component renders the signup form with all required fields
 * and handles user registration with Firebase Auth and Firestore.
 * 
 * Location: src/pages/login/SignupForm.tsx
 * Purpose: Signup form with full authentication logic
 */

const SignupForm: React.FC = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: '',
    department: '',
    customDepartment: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCustomDepartment, setShowCustomDepartment] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Show custom department field if "other" is selected
    if (name === 'department') {
      setShowCustomDepartment(value === 'other');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    
    // Validation
    if (!formData.firstName || !formData.lastName || !formData.email || 
        !formData.password || !formData.role || !formData.department) {
      setMessage({ type: 'error', text: 'אנא מלא את כל השדות' });
      return;
    }
    
    if (formData.department === 'other' && !formData.customDepartment) {
      setMessage({ type: 'error', text: 'אנא הזן שם מחלקה' });
      return;
    }
    
    if (formData.password.length < 8) {
      setMessage({ type: 'error', text: 'הסיסמה חייבת להכיל לפחות 8 תווים' });
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await signUp(
        formData.email,
        formData.password,
        formData.firstName,
        formData.lastName,
        formData.role as 'owner' | 'admin' | 'worker',
        formData.department,
        formData.customDepartment || undefined
      );
      
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        // Clear form
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          role: '',
          department: '',
          customDepartment: ''
        });
        setShowCustomDepartment(false);
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'שגיאה בהרשמה. אנא נסה שוב' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="text-center">
        <h3 className="text-2xl font-semibold text-white mb-2">
          הצטרפו אלינו
        </h3>
        <p className="text-white/80 text-sm">
          צרו חשבון חדש והתחילו לעבוד
        </p>
      </div>

      {/* Success/Error Message */}
      {message && (
        <div className={`p-4 rounded-xl ${
          message.type === 'success' 
            ? 'bg-green-500/20 border border-green-500/50' 
            : 'bg-red-500/20 border border-red-500/50'
        }`}>
          <p className="text-white text-sm text-center">{message.text}</p>
        </div>
      )}

      {/* Signup Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name Fields Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* First Name */}
          <div className="space-y-2">
            <label htmlFor="firstName" className="block text-sm font-medium text-white/90">
              שם פרטי
            </label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="הכנס שם פרטי"
              required
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
            />
          </div>

          {/* Last Name */}
          <div className="space-y-2">
            <label htmlFor="lastName" className="block text-sm font-medium text-white/90">
              שם משפחה
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="הכנס שם משפחה"
              required
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
            />
          </div>
        </div>

        {/* Role Field */}
        <div className="space-y-2">
          <label htmlFor="role" className="block text-sm font-medium text-white/90">
            תפקיד
          </label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
          >
            <option value="" className="bg-gray-800 text-white">
              בחר תפקיד
            </option>
            <option value="owner" className="bg-gray-800 text-white">
              בעל/ת מחלקה
            </option>
            <option value="admin" className="bg-gray-800 text-white">
              מנהל/ת
            </option>
            <option value="worker" className="bg-gray-800 text-white">
              עובד/ת
            </option>
          </select>
        </div>

        {/* Department Field */}
        <div className="space-y-2">
          <label htmlFor="department" className="block text-sm font-medium text-white/90">
            מחלקה
          </label>
          <select
            id="department"
            name="department"
            value={formData.department}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
          >
            <option value="" className="bg-gray-800 text-white">
              בחר מחלקה
            </option>
            <option value="ground_support" className="bg-gray-800 text-white">
              שירותי קרקע
            </option>
            <option value="logistics" className="bg-gray-800 text-white">
              לוגיסטיקה
            </option>
            <option value="medical" className="bg-gray-800 text-white">
              מרפאה
            </option>
            <option value="other" className="bg-gray-800 text-white">
              אחר
            </option>
          </select>
        </div>

        {/* Custom Department Field (shown when "other" is selected) */}
        {showCustomDepartment && (
          <div className="space-y-2">
            <label htmlFor="customDepartment" className="block text-sm font-medium text-white/90">
              שם מחלקה מותאם
            </label>
            <input
              type="text"
              id="customDepartment"
              name="customDepartment"
              value={formData.customDepartment}
              onChange={handleChange}
              placeholder="הכנס שם מחלקה"
              required
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
            />
          </div>
        )}

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
            placeholder="הכנס סיסמה (לפחות 8 תווים)"
            required
            minLength={8}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
            dir="ltr"
          />
        </div>

        {/* Terms and Conditions */}
        <div className="flex items-start text-sm">
          <input
            type="checkbox"
            id="terms"
            name="terms"
            className="rounded border-white/20 bg-white/10 text-white focus:ring-white/30 focus:ring-offset-0 mr-3 mt-1"
          />
          <label htmlFor="terms" className="text-white/80 leading-relaxed">
            אני מסכים ל
            <button
              type="button"
              className="text-white hover:text-white/90 underline mx-1"
            >
              תנאי השימוש
            </button>
            ו
            <button
              type="button"
              className="text-white hover:text-white/90 underline mx-1"
            >
              מדיניות הפרטיות
            </button>
          </label>
        </div>

        {/* Signup Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-300 transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          {loading ? 'מתבצעת הרשמה...' : 'הירשם'}
        </button>
      </form>

    </div>
  );
};

export default SignupForm;
