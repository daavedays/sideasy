import React from 'react';

/**
 * Input Component
 * 
 * Reusable input component with label support and glassmorphism design.
 * Supports text, email, password, and other HTML5 input types.
 * 
 * Location: src/components/ui/Input.tsx
 * Purpose: Reusable form input component
 */

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="space-y-2">
      {label && (
        <label 
          htmlFor={inputId} 
          className="block text-sm font-medium text-white/90"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-4 py-3 rounded-xl bg-white/10 border ${
          error ? 'border-red-400' : 'border-white/20'
        } text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all duration-300 backdrop-blur-sm ${className}`}
        {...props}
      />
      {error && (
        <p className="text-red-400 text-sm mt-1">{error}</p>
      )}
    </div>
  );
};

export default Input;

