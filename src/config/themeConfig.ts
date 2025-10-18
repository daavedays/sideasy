/**
 * Theme Configuration
 * 
 * Global theme settings including colors, gradients, and UI styling.
 * Change ACTIVE_GRADIENT_OVERLAY to test different color schemes.
 * 
 * Location: src/config/themeConfig.ts
 * Purpose: Centralized theme configuration
 */

// ==========================================
// 🎨 GRADIENT OVERLAY OPTIONS
// ==========================================

/**
 * Gradient overlays for background images.
 * These are applied on top of background images to improve text readability
 * and create a cohesive visual theme.
 * 
 * Format: Tailwind gradient classes with opacity
 * - First color: top-left
 * - Middle color: center
 * - Last color: bottom-right
 */

export const GRADIENT_OVERLAYS = {
  // 🔥 WARM SUNSET - Complements orange/red sunset backgrounds
  // Best for: Military/aviation themes with warm sunset imagery
  warmSunset: 'bg-gradient-to-br from-orange-900/50 via-red-900/40 to-slate-900/60',
  
  // 🌊 DEEP MILITARY BLUE - Professional naval/aviation theme
  // Best for: Professional military applications
  deepBlue: 'bg-gradient-to-br from-slate-900/60 via-blue-900/50 to-navy-900/60',
  
  // 🪨 NEUTRAL CHARCOAL - Clean, doesn't compete with background
  // Best for: When you want the background image to shine through
  neutralCharcoal: 'bg-gradient-to-br from-slate-900/60 via-gray-800/50 to-zinc-900/60',
  
  // 🌅 DRAMATIC AMBER - Enhances fiery sunset feel
  // Best for: Dramatic, energetic feel
  dramaticAmber: 'bg-gradient-to-br from-amber-900/55 via-orange-900/45 to-slate-900/65',
  
  // 🌌 DEEP SPACE - Dark, mysterious
  // Best for: Night operations, space themes
  deepSpace: 'bg-gradient-to-br from-slate-900/70 via-indigo-950/60 to-black/70',
  
  // 💎 COOL STEEL - Modern, tech-focused
  // Best for: Modern, professional applications
  coolSteel: 'bg-gradient-to-br from-slate-800/55 via-cyan-900/45 to-slate-900/65',

  // 🟣 ORIGINAL PURPLE (OLD) - The original purple haze
  // Kept for reference/comparison
  originalPurple: 'bg-gradient-to-br from-purple-900/60 via-blue-900/50 to-indigo-900/60',
} as const;

// ==========================================
// ⚙️ ACTIVE THEME
// ==========================================

/**
 * 🎯 CHANGE THIS to test different color schemes!
 * 
 * Options:
 * - 'warmSunset' (RECOMMENDED for your current background)
 * - 'deepBlue'
 * - 'neutralCharcoal'
 * - 'dramaticAmber'
 * - 'deepSpace'
 * - 'coolSteel'
 * - 'originalPurple'
 */
export const ACTIVE_GRADIENT_OVERLAY: keyof typeof GRADIENT_OVERLAYS = 'neutralCharcoal';

/**
 * Helper function to get the active gradient overlay class
 */
export const getGradientOverlay = (): string => {
  return GRADIENT_OVERLAYS[ACTIVE_GRADIENT_OVERLAY];
};

// ==========================================
// 🎨 ADDITIONAL THEME SETTINGS
// ==========================================

/**
 * Card and UI element styling
 */
export const THEME = {
  // Glass morphism effect for cards
  card: {
    background: 'bg-white/10',
    backdrop: 'backdrop-blur-md',
    border: 'border border-white/20',
    rounded: 'rounded-2xl',
    hover: 'hover:bg-white/15',
  },
  
  // Text colors
  text: {
    primary: 'text-white',
    secondary: 'text-white/80',
    tertiary: 'text-white/70',
    muted: 'text-white/50',
  },
  
  // Transitions
  transition: {
    default: 'transition-all duration-300',
    fast: 'transition-all duration-150',
    slow: 'transition-all duration-500',
  },
} as const;

/**
 * Usage Example:
 * 
 * // In your component:
 * import { getGradientOverlay, THEME } from '@/config/themeConfig';
 * 
 * <div className={`${THEME.card.background} ${THEME.card.backdrop}`}>
 *   ...
 * </div>
 */

