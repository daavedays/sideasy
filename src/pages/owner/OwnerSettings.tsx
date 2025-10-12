/**
 * Owner Settings Page
 * 
 * Owner-exclusive settings page with:
 * - Task definitions (shared with Admin)
 * - Closing schedule configuration (Owner-only)
 * 
 * Location: src/pages/owner/OwnerSettings.tsx
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import Background from '../../components/layout/Background';
import Header from '../../components/layout/Header';
import Button from '../../components/ui/Button';
import { ClosingScheduleConfig, DEFAULT_CLOSING_CONFIG } from '../../types/closingSchedule.types';

const OwnerSettings: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // User data
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [departmentName, setDepartmentName] = useState<string>('');
  
  // Closing schedule configuration
  const [closingConfig, setClosingConfig] = useState<ClosingScheduleConfig>(DEFAULT_CLOSING_CONFIG);
  const [originalConfig, setOriginalConfig] = useState<ClosingScheduleConfig>(DEFAULT_CLOSING_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);

  // Get department ID and load configuration
  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;

      try {
        // Get user data
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setDepartmentId(userData.departmentId || null);
          setDepartmentName(userData.departmentName || '');
          
          // Load department configuration
          if (userData.departmentId) {
            const deptDocRef = doc(db, 'departments', userData.departmentId);
            const deptDoc = await getDoc(deptDocRef);
            
            if (deptDoc.exists()) {
              const deptData = deptDoc.data();
              const config = deptData.closingScheduleConfig || DEFAULT_CLOSING_CONFIG;
              
              setClosingConfig(config);
              setOriginalConfig(config);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setMessage({ type: 'error', text: 'שגיאה בטעינת נתונים' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Track changes
  useEffect(() => {
    const changed = 
      closingConfig.gapSlackWeeks !== originalConfig.gapSlackWeeks ||
      closingConfig.allowSingleReliefMin1 !== originalConfig.allowSingleReliefMin1 ||
      closingConfig.reliefMaxPerSchedule !== originalConfig.reliefMaxPerSchedule;
    
    setHasChanges(changed);
  }, [closingConfig, originalConfig]);

  // Save configuration
  const handleSave = async () => {
    if (!departmentId || !hasChanges) return;

    setSaving(true);
    setMessage(null);

    try {
      const deptRef = doc(db, 'departments', departmentId);
      
      await updateDoc(deptRef, {
        closingScheduleConfig: closingConfig,
        updatedAt: Timestamp.now(),
      });

      setOriginalConfig(closingConfig);
      setHasChanges(false);
      setMessage({ type: 'success', text: 'הגדרות נשמרו בהצלחה!' });
    } catch (error) {
      console.error('Error saving configuration:', error);
      setMessage({ type: 'error', text: 'שגיאה בשמירת הגדרות' });
    } finally {
      setSaving(false);
    }
  };

  // Reset to original
  const handleReset = () => {
    setClosingConfig(originalConfig);
    setHasChanges(false);
    setMessage(null);
  };

  // Reset to defaults
  const handleResetToDefaults = () => {
    setClosingConfig(DEFAULT_CLOSING_CONFIG);
    setMessage({ type: 'success', text: 'הגדרות אופסו לברירת מחדל' });
  };

  if (loading) {
    return (
      <div dir="rtl" className="relative flex-1 min-h-screen">
        <Background singleImage="/images/image_1.png" />
        <Header />
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <p className="text-white text-2xl">טוען...</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="relative flex-1 min-h-screen">
      <Background singleImage="/images/image_1.png" />
      <Header />
      
      <div className="relative z-10 min-h-screen py-8 pt-24">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <Button
              onClick={() => navigate('/owner')}
              className="mb-4 bg-slate-700 hover:bg-slate-600"
            >
              ← חזרה
            </Button>
            
            <h1 className="text-4xl font-bold text-white mb-2">
              הגדרות בעלים
            </h1>
            <p className="text-white/70">
              {departmentName}
            </p>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`mb-6 p-4 rounded-xl ${
                message.type === 'success'
                  ? 'bg-green-600/20 border border-green-500 text-green-300'
                  : 'bg-red-600/20 border border-red-500 text-red-300'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Closing Schedule Configuration */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden mb-6">
            <div className="p-6 border-b border-white/20">
              <h2 className="text-2xl font-bold text-white mb-2">
                הגדרות חישוב סגירות מיטבי
              </h2>
              <p className="text-white/60 text-sm">
                הגדרות אלו משפיעות על חישוב תאריכי הסגירה המיטביים לעובדים
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Gap Slack Weeks */}
              <div>
                <label className="block text-white mb-2 font-medium">
                  גמישות במרווח סגירות (שבועות)
                </label>
                <p className="text-white/60 text-sm mb-3">
                  מספר שבועות נוספים מעבר למרווח המינימלי. ברירת מחדל: 0 (מרווח קפדני)
                </p>
                <input
                  type="number"
                  min="0"
                  max="4"
                  value={closingConfig.gapSlackWeeks}
                  onChange={(e) => setClosingConfig({
                    ...closingConfig,
                    gapSlackWeeks: Math.max(0, Math.min(4, parseInt(e.target.value) || 0))
                  })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-white/40"
                />
              </div>

              {/* Allow Single Relief Min1 */}
              <div>
                <label className="flex items-center space-x-3 space-x-reverse cursor-pointer">
                  <input
                    type="checkbox"
                    checked={closingConfig.allowSingleReliefMin1}
                    onChange={(e) => setClosingConfig({
                      ...closingConfig,
                      allowSingleReliefMin1: e.target.checked
                    })}
                    className="w-5 h-5 rounded border-white/20 bg-white/10 checked:bg-blue-600"
                  />
                  <div>
                    <span className="text-white font-medium">
                      אפשר סגירות חירום
                    </span>
                    <p className="text-white/60 text-sm mt-1">
                      מאפשר הוספת סגירת חירום במקרים קיצוניים כאשר הפער = 2n-1
                    </p>
                  </div>
                </label>
              </div>

              {/* Relief Max Per Schedule */}
              <div className={!closingConfig.allowSingleReliefMin1 ? 'opacity-50 pointer-events-none' : ''}>
                <label className="block text-white mb-2 font-medium">
                  מקסימום סגירות חירום לתקופה
                </label>
                <p className="text-white/60 text-sm mb-3">
                  מספר מקסימלי של סגירות חירום שניתן להוסיף בתקופה אחת
                </p>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={closingConfig.reliefMaxPerSchedule}
                  onChange={(e) => setClosingConfig({
                    ...closingConfig,
                    reliefMaxPerSchedule: Math.max(0, Math.min(5, parseInt(e.target.value) || 0))
                  })}
                  disabled={!closingConfig.allowSingleReliefMin1}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-white/40 disabled:opacity-50"
                />
              </div>

              {/* Info Box */}
              <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-300 text-sm leading-relaxed">
                  <strong>📌 הסבר:</strong> הגדרות אלו מוגדרות ברמת המחלקה ומשפיעות על כל חישובי הסגירות המיטביות.
                  שינויים יכנסו לתוקף בשמירה הבאה של לוח תורנות ראשי.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-4 justify-center">
            {hasChanges && (
              <>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 px-8 py-3 disabled:opacity-50"
                >
                  {saving ? '⏳ שומר...' : '💾 שמור הגדרות'}
                </Button>
                <Button
                  onClick={handleReset}
                  disabled={saving}
                  className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 px-8 py-3 disabled:opacity-50"
                >
                  ↩️ בטל שינויים
                </Button>
              </>
            )}
            
            <Button
              onClick={handleResetToDefaults}
              disabled={saving}
              className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 px-8 py-3 disabled:opacity-50"
            >
              🔄 אפס לברירת מחדל
            </Button>

            <Button
              onClick={() => navigate('/owner/settings/tasks')}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 px-8 py-3"
            >
              📋 ניהול משימות
            </Button>
          </div>

          {/* Unsaved changes warning */}
          {hasChanges && (
            <div className="mt-6 text-center">
              <p className="text-yellow-300 text-sm">
                ⚠️ יש לך שינויים שלא נשמרו
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OwnerSettings;

