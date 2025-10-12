import React from 'react';

/**
 * Modal Component
 * 
 * Reusable modal/dialog component with backdrop and glassmorphism design.
 * Supports custom header, body, and footer content.
 * 
 * Location: src/components/ui/Modal.tsx
 * Purpose: Reusable modal component
 */

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  dynamicHeight?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  dynamicHeight = false
}) => {
  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${dynamicHeight ? 'items-start' : ''}`}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className={`relative w-full ${sizeStyles[size]} ${dynamicHeight ? 'max-h-[90vh] overflow-y-auto' : ''} bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl`}>
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between p-6 border-b border-white/20">
            <h3 className="text-2xl font-semibold text-white">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        
        {/* Body */}
        <div className="p-6">
          {children}
        </div>
        
        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-4 p-6 border-t border-white/20">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;

