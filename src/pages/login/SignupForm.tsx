import React, { useMemo, useState, useEffect, useRef } from 'react';
import { signUp } from '../../lib/auth/authHelpers';
import { getAllDepartments, Department } from '../../lib/firestore/departments';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

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
  const [roleOpen, setRoleOpen] = useState(false);
  const roleDetailsRef = useRef<HTMLDetailsElement>(null);
  
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          <Input label="שם פרטי" id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} placeholder="הכנס שם פרטי" required />

          {/* Last Name */}
          <Input label="שם משפחה" id="lastName" name="lastName" value={formData.lastName} onChange={handleChange} placeholder="הכנס שם משפחה" required />
        </div>

        {/* Role Field - custom dropdown (owner/worker only) */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-white/90">תפקיד</label>
          <details ref={roleDetailsRef} open={roleOpen} className="group bg-white/10 border border-white/20 rounded-xl">
            <summary
              className="list-none px-4 py-3 text-white/90 cursor-pointer rounded-xl flex items-center justify-between"
              onClick={(e) => { e.preventDefault(); setRoleOpen(v => !v); }}
            >
              <span>{formData.role === '' ? 'בחר תפקיד' : formData.role === 'owner' ? 'בעל/ת מחלקה' : 'עובד/ת'}</span>
              <span className="text-white/70">▾</span>
            </summary>
            <div className="px-2 pb-2">
              {[
                { id: 'owner', label: 'בעל/ת מחלקה' },
                { id: 'worker', label: 'עובד/ת' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { setFormData(prev => ({ ...prev, role: opt.id })); setRoleOpen(false); roleDetailsRef.current && (roleDetailsRef.current.open = false); }}
                  className={`w-full text-right px-3 py-2 rounded-lg hover:bg-white/10 text-white ${formData.role === opt.id ? 'bg-white/10 border border-white/20' : 'border border-transparent'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </details>
        </div>

        {/* Department Field */}
        <div className="space-y-2 relative" ref={dropdownRef}>
          <label htmlFor="departmentSearch" className="block text-sm font-medium text-white/90">
            מחלקה
          </label>
          
          <Input
            id="departmentSearch"
            value={departmentInput}
            onChange={handleDepartmentInputChange}
            onFocus={handleDepartmentInputFocus}
            placeholder="הקלד שם מחלקה..."
            disabled={!formData.role}
            autoComplete="off"
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
        <Input label="כתובת אימייל" id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="הכנס כתובת אימייל" dir="ltr" required />

        {/* Password Field */}
        <Input label="סיסמה" id="password" name="password" type="password" value={formData.password} onChange={handleChange} placeholder="הכנס סיסמה (לפחות 8 תווים)" required minLength={8} dir="ltr" />

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
        <Button type="submit" fullWidth blink={!loading && !!formData.role && !!departmentInput && !!formData.firstName && !!formData.lastName && !!formData.email && formData.password.length >= 8} disabled={loading}>
          {loading ? 'מתבצעת הרשמה...' : 'הירשם'}
        </Button>
      </form>

    </div>
  );
};

export default SignupForm;
