import React from 'react';

/**
 * Button Component
 * 
 * Reusable button component with multiple variants and sizes.
 * Supports primary, secondary, and outline styles.
 * 
 * Location: src/components/ui/Button.tsx
 * Purpose: Reusable button component
 */

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'attention';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  className = '',
  ...props
}) => {
  const baseStyles = 'font-semibold rounded-xl transition-all duration-300 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantStyles = {
    primary: 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-lg',
    secondary: 'bg-white/20 backdrop-blur-sm text-white border border-white/30 hover:bg-white/30 hover:shadow-lg',
    outline: 'bg-transparent text-white border-2 border-white/50 hover:bg-white/10',
    ghost: 'bg-transparent text-white hover:bg-white/10',
    attention: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 border-2 border-blue-400/50 shadow-lg shadow-blue-500/30 animate-pulse'
  };
  
  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  };

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;

