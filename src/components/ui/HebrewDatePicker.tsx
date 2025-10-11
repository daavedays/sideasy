/**
 * Hebrew Date Picker Component
 * 
 * Custom date picker with Hebrew labels and RTL support.
 * Sunday (א) appears on the RIGHT, Saturday (ש) on the LEFT.
 * Friday and Saturday have indigo background for clear distinction.
 * 
 * Location: src/components/ui/HebrewDatePicker.tsx
 * Purpose: Reusable Hebrew date picker for the app
 */

import React, { useState, useEffect, useRef } from 'react';

interface HebrewDatePickerProps {
  label: string;
  value: string; // YYYY-MM-DD format
  onChange: (date: string) => void;
  minDate?: string;
  maxDate?: string;
}

const HebrewDatePicker: React.FC<HebrewDatePickerProps> = ({
  label,
  value,
  onChange,
  minDate,
  maxDate
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const pickerRef = useRef<HTMLDivElement>(null);

  // Hebrew month names
  const hebrewMonths = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];

  // Hebrew day names - Sunday (א) first, Saturday (ש) last
  const hebrewDays = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format date for display (DD/MM/YYYY) - Israel timezone
  const formatDisplayDate = (dateString: string): string => {
    if (!dateString) return 'בחר תאריך';
    // Parse YYYY-MM-DD directly to avoid timezone conversion
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  // Get days in month
  const getDaysInMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  // Get first day of month (0 = Sunday, 6 = Saturday)
  const getFirstDayOfMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  // Navigate month
  const changeMonth = (delta: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1));
  };

  // Select date
  const selectDate = (day: number) => {
    // Create date in Israel timezone (no timezone conversion)
    const year = currentMonth.getFullYear();
    const month = (currentMonth.getMonth() + 1).toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    // Store as YYYY-MM-DD for input compatibility, but display as DD/MM/YYYY
    const dateString = `${year}-${month}-${dayStr}`;
    onChange(dateString);
    setIsOpen(false);
  };

  // Check if a day is a weekend (Friday=5, Saturday=6 in JS Date)
  const isWeekendDay = (dayOfWeek: number): boolean => {
    return dayOfWeek === 5 || dayOfWeek === 6;
  };

  // Render calendar days
  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days: (number | null)[] = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    // Check if date is selected
    const isSelected = (day: number): boolean => {
      if (!value) return false;
      // Parse date string directly to avoid timezone issues
      const [year, month, dayStr] = value.split('-').map(Number);
      return (
        dayStr === day &&
        month - 1 === currentMonth.getMonth() &&
        year === currentMonth.getFullYear()
      );
    };

    // Check if date is today
    const isToday = (day: number): boolean => {
      const today = new Date();
      return (
        today.getDate() === day &&
        today.getMonth() === currentMonth.getMonth() &&
        today.getFullYear() === currentMonth.getFullYear()
      );
    };

    return (
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          // Calculate day of week (0=Sunday, 6=Saturday)
          const dayOfWeek = index % 7;
          const isWeekend = day && isWeekendDay(dayOfWeek);
          
          return (
            <button
              key={index}
              onClick={() => day && selectDate(day)}
              disabled={!day}
              className={`
                h-10 rounded-lg text-sm font-medium transition-all duration-200
                ${!day ? 'invisible' : ''}
                ${isSelected(day || 0) 
                  ? 'bg-blue-600 text-white shadow-lg scale-110' 
                  : isToday(day || 0)
                  ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-400/50'
                  : isWeekend
                  ? 'bg-indigo-500/20 text-white hover:bg-indigo-500/30'
                  : 'bg-slate-700/30 text-white hover:bg-slate-600/50'
                }
                ${day ? 'cursor-pointer' : ''}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div ref={pickerRef} className="relative" dir="rtl">
      <label className="block text-white/80 mb-2 text-sm">{label}</label>
      
      {/* Date Input */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-800/70 text-white border-2 border-slate-600/50 hover:border-blue-400/50 focus:border-blue-500 rounded-xl p-3 text-right transition-all duration-200 flex items-center justify-between"
      >
        <span>{formatDisplayDate(value)}</span>
        <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className="absolute z-[9999] mt-2 w-full min-w-[320px] bg-slate-900 backdrop-blur-xl rounded-2xl p-4 border-2 border-slate-500/70 shadow-[0_20px_60px_rgba(0,0,0,0.9)]">
          {/* Month/Year Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => changeMonth(1)}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-white rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div className="text-white font-bold text-lg">
              {hebrewMonths[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </div>
            
            <button
              onClick={() => changeMonth(-1)}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>

          {/* Day Headers - Sunday (א) on right, Saturday (ש) on left */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {hebrewDays.map((day, index) => {
              // Friday (ו)=5, Saturday (ש)=6
              const isWeekendHeader = index === 5 || index === 6;
              return (
                <div
                  key={index}
                  className={`h-8 flex items-center justify-center font-bold text-sm ${
                    isWeekendHeader ? 'text-white/75' : 'text-white/60'
                  }`}
                >
                  {day}
                </div>
              );
            })}
          </div>

          {/* Calendar Grid */}
          {renderCalendar()}
        </div>
      )}
    </div>
  );
};

export default HebrewDatePicker;

