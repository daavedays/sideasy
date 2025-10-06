import React from 'react';

/**
 * Footer Component
 * 
 * Beautiful footer with copyright information and David Mirzoyan attribution.
 * Features Hebrew text with RTL support and glassmorphism design.
 * Only shows on non-authentication pages.
 * 
 * Location: src/components/footer.tsx
 * Purpose: Main footer for the application
 */

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white/10 backdrop-blur-md border-t border-white/20 mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand Section */}
          <div className="text-center md:text-right">
            <h3 className="text-2xl font-bold text-white mb-4 drop-shadow-lg">
              Sideasy
            </h3>
            <p className="text-white/80 text-sm leading-relaxed">
              מערכת ניהול משמרות מתקדמת
              <br />
              סידור עבודה בקליק
            </p>
          </div>

          {/* Quick Links */}
          <div className="text-center">
            <h4 className="text-white font-semibold mb-4">קישורים מהירים</h4>
            <div className="flex flex-col space-y-2">
              <a 
                href="/dashboard" 
                className="text-white/70 hover:text-white transition-colors duration-200 text-sm"
              >
                דשבורד
              </a>
              <a 
                href="#" 
                className="text-white/70 hover:text-white transition-colors duration-200 text-sm"
              >
                משמרות
              </a>
              <a 
                href="#" 
                className="text-white/70 hover:text-white transition-colors duration-200 text-sm"
              >
                עובדים
              </a>
              <a 
                href="#" 
                className="text-white/70 hover:text-white transition-colors duration-200 text-sm"
              >
                הגדרות
              </a>
            </div>
          </div>

          {/* Contact Info */}
          <div className="text-center md:text-left">
            <h4 className="text-white font-semibold mb-4">יצירת קשר</h4>
            <div className="space-y-2 text-sm text-white/70">
              <p>תמיכה טכנית זמינה 24/7</p>
              <p>support@sideasy.com</p>
              <p>+972-50-123-4567</p>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-white/20 mt-8 pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
            {/* Copyright */}
            <div className="text-center md:text-right">
              <p className="text-white/70 text-sm">
                © {currentYear} Sideasy. כל הזכויות שמורות.
              </p>
            </div>

            {/* Developer Attribution */}
            <div className="text-center md:text-left">
              <p className="text-white/70 text-sm">
                פותח על ידי{' '}
                <span className="text-white font-medium">
                  דוד מירזויאן
                </span>
              </p>
            </div>

            {/* Social Links */}
            <div className="flex items-center justify-center md:justify-start space-x-6 space-x-reverse">
              <a 
                href="#" 
                className="text-white/70 hover:text-white transition-colors duration-200 p-2 hover:bg-white/10 rounded-lg"
                aria-label="LinkedIn"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
              <a 
                href="#" 
                className="text-white/70 hover:text-white transition-colors duration-200 p-2 hover:bg-white/10 rounded-lg"
                aria-label="GitHub"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
              <a 
                href="#" 
                className="text-white/70 hover:text-white transition-colors duration-200 p-2 hover:bg-white/10 rounded-lg"
                aria-label="Email"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
