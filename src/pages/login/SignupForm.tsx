import React, { useState, useEffect, useRef } from 'react';
import { signUp } from '../../lib/auth/authHelpers';
import { getAllDepartments, Department } from '../../lib/firestore/departments';

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
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentInput, setDepartmentInput] = useState('');
  const [filteredDepartments, setFilteredDepartments] = useState<Department[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Ref for dropdown to handle click outside
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch all departments on component mount
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const allDepts = await getAllDepartments();
        setDepartments(allDepts);
      } catch (error) {
        console.error('Error fetching departments:', error);
      }
    };

    fetchDepartments();
  }, []);

  // Filter departments as user types
  useEffect(() => {
    if (!departmentInput.trim()) {
      setFilteredDepartments([]);
      return;
    }

    const searchTerm = departmentInput.toLowerCase().trim();
    const filtered = departments.filter(dept => 
      dept.name.toLowerCase().includes(searchTerm)
    );
    
    setFilteredDepartments(filtered);
  }, [departmentInput, departments]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        // Close dropdown but keep the input value
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDepartmentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDepartmentInput(value);
    setShowDropdown(value.trim().length > 0); // Show dropdown only if there's text
    // Clear selection when user types
    setFormData(prev => ({ ...prev, department: '', customDepartment: '' }));
  };

  const handleDepartmentInputFocus = () => {
    // Show dropdown when input is focused and has text
    if (departmentInput.trim().length > 0) {
      setShowDropdown(true);
    }
  };

  const handleDepartmentSelect = (dept: Department, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setDepartmentInput(dept.name);
    setFormData(prev => ({ 
      ...prev, 
      department: dept.id || '',
      customDepartment: ''
    }));
    // Hide dropdown after selection
    setShowDropdown(false);
    setFilteredDepartments([]);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    
    // Validation
    if (!formData.firstName || !formData.lastName || !formData.email || 
        !formData.password || !formData.role) {
      setMessage({ type: 'error', text: 'אנא מלא את כל השדות הנדרשים' });
      return;
    }

    if (!departmentInput.trim()) {
      setMessage({ type: 'error', text: 'אנא הזן שם מחלקה' });
      return;
    }
    
    if (formData.password.length < 8) {
      setMessage({ type: 'error', text: 'הסיסמה חייבת להכיל לפחות 8 תווים' });
      return;
    }
    
    // Determine final department ID and custom name
    let finalDepartmentId = formData.department;
    let finalCustomDepartmentName = formData.customDepartment;
    
    // Check if department exists
    const exactMatch = departments.find(d => d.name.toLowerCase() === departmentInput.toLowerCase());
    
    if (!exactMatch) {
      // Department doesn't exist
      if (formData.role === 'owner') {
        // Owner can create new department
        finalDepartmentId = 'other';
        finalCustomDepartmentName = departmentInput;
      } else {
        setMessage({ 
          type: 'error', 
          text: 'מחלקה זו לא קיימת. רק בעלי מחלקות יכולים ליצור מחלקות חדשות.' 
        });
        return;
      }
    } else {
      // Department exists - use its ID
      finalDepartmentId = exactMatch.id || '';
      finalCustomDepartmentName = '';
    }
    
    if (!finalDepartmentId) {
      setMessage({ type: 'error', text: 'אנא בחר מחלקה תקינה' });
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
        finalDepartmentId,
        finalCustomDepartmentName || undefined
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
        setDepartmentInput('');
        setShowDropdown(false);
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
        <div className="space-y-2 relative" ref={dropdownRef}>
          <label htmlFor="departmentSearch" className="block text-sm font-medium text-white/90">
            מחלקה
          </label>
          
          <input
            type="text"
            id="departmentSearch"
            value={departmentInput}
            onChange={handleDepartmentInputChange}
            onFocus={handleDepartmentInputFocus}
            placeholder="הקלד שם מחלקה..."
            disabled={!formData.role}
            autoComplete="off"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-300 backdrop-blur-sm disabled:opacity-50"
          />
          
          {/* Dropdown list with glassmorphism design */}
          {showDropdown && departmentInput && departmentInput.trim().length > 0 && (
            <div 
              className="absolute w-full bg-gray-900/95 backdrop-blur-xl border border-white/30 rounded-xl mt-2 max-h-60 overflow-y-auto z-50 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200"
              style={{
                animation: 'slideDown 0.2s ease-out'
              }}
            >
              {filteredDepartments.length > 0 ? (
                filteredDepartments.map((dept) => (
                  <div
                    key={dept.id}
                    onClick={(e) => handleDepartmentSelect(dept, e)}
                    onMouseDown={(e) => e.preventDefault()}
                    className="px-4 py-3 hover:bg-gradient-to-r hover:from-purple-600/30 hover:to-blue-600/30 cursor-pointer text-white text-right transition-all duration-200 border-b border-white/10 last:border-b-0 first:rounded-t-xl last:rounded-b-xl active:scale-[0.98]"
                  >
                    <span className="font-medium">{dept.name}</span>
                  </div>
                ))
              ) : (
                <div className={`px-4 py-3 text-right text-sm rounded-xl ${
                  formData.role === 'owner' ? 'text-green-400/80' : 'text-red-400/80'
                }`}>
                  {formData.role === 'owner' 
                    ? '✨ לא נמצאה מחלקה קיימת. תיווצר מחלקה חדשה בשם זה'
                    : '❌ מחלקה לא נמצאה. רק בעלי מחלקות יכולים ליצור מחלקות חדשות'}
                </div>
              )}
            </div>
          )}
          
          {!formData.role && (
            <p className="text-xs text-white/60">אנא בחר תפקיד תחילה</p>
          )}
          
          {formData.role && formData.role !== 'owner' && (
            <p className="text-xs text-white/60 mt-1">
              💡 עליך לבחור מחלקה קיימת מהרשימה
            </p>
          )}
          
          {formData.role === 'owner' && (
            <p className="text-xs text-green-400/60 mt-1">
              ✨ כבעל מחלקה, תוכל ליצור מחלקה חדשה או לבחור קיימת
            </p>
          )}
        </div>

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
