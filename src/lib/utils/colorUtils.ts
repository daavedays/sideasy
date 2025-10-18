/**
 * Color Utilities for Primary Task Assignments
 * 
 * Generates consistent, visually distinct colors for task assignments.
 * Each unique task ID gets a consistent color across the entire schedule.
 * 
 * Location: src/lib/utils/colorUtils.ts
 * Purpose: Dynamic color generation for task visualization
 */

/**
 * Glassmorphism-friendly pastel palette (light, soft, high legibility)
 * Used as a fallback if we don't generate via HSL.
 */
const TASK_COLOR_PALETTE = [
  // Pastel Blues / Cyans
  '#A7C5FF', '#AEE9FF', '#B8E1FF', '#C7D2FE', '#BFE3FF',
  // Pastel Purples
  '#D5C6FF', '#E0C3FC', '#CBB2FF', '#E8D5FF', '#D9C2FF',
  // Pastel Greens / Teals
  '#BFF7D0', '#C3F0E6', '#C8F8DC', '#BDE6E3', '#D1F5E0',
  // Pastel Oranges / Yellows
  '#FFE0B2', '#FFE8A3', '#FFD8B1', '#FFE6C7', '#FFE3A8',
  // Pastel Reds / Pinks / Roses
  '#FFC7D1', '#FFCDD5', '#FFD1E8', '#FFBFD6', '#FFCFE1',
  // Others
  '#CFF1FF', '#D7F7FF', '#D2F4EA', '#E3F2FF', '#E6E9FF',
  '#D8F0FF', '#EFD9FF', '#F1E0FF', '#FBE0FF', '#F9E6FF'
];

/**
 * Convert HSL to HEX (pastel generation helper)
 */
const hslToHex = (h: number, s: number, l: number): string => {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
};

/**
 * Generate a consistent color for a task ID using hash function
 * Same task ID will always produce the same color
 * 
 * @param taskId - Unique task identifier
 * @returns Hex color string (e.g., "#3B82F6")
 */
export const generateTaskColor = (taskId: string): string => {
  // Stable hash from id
  let hash = 0;
  for (let i = 0; i < taskId.length; i++) {
    hash = (hash << 5) - hash + taskId.charCodeAt(i);
    hash |= 0;
  }

  // Generate a pastel color using HSL for wide variance and glassmorph look
  // Hue from 0..359 based on hash, Saturation 65-75, Lightness 78-85
  const hue = Math.abs(hash) % 360;
  const sat = 35; // slightly stronger saturation for readability
  const lig = 55; // darker pastel for better text contrast
  const pastelHex = hslToHex(hue, sat, lig);

  // Safety: if something goes wrong, fallback to palette
  if (!/^#[0-9a-fA-F]{6}$/.test(pastelHex)) {
    const index = Math.abs(hash) % TASK_COLOR_PALETTE.length;
    return TASK_COLOR_PALETTE[index];
  }
  return pastelHex;
};

/**
 * Get background color class for task cell (with opacity for glassmorphism)
 * 
 * @param color - Hex color string
 * @returns Tailwind-compatible style object
 */
export const getTaskCellBackground = (color: string): React.CSSProperties => {
  return {
    backgroundColor: `${color}CC`, // ~80% opacity for glassmorphism and readability
    borderColor: `${color}`,
  };
};

/**
 * Get hover background color for task cell
 * 
 * @param color - Hex color string
 * @returns Tailwind-compatible style object
 */
export const getTaskCellHoverBackground = (color: string): React.CSSProperties => {
  return {
    backgroundColor: `${color}E6`, // 90% opacity
  };
};

/**
 * Color for custom tasks (user-created, not from taskDefinitions)
 */
export const CUSTOM_TASK_COLOR = '#94A3B8'; // slate-400

/**
 * Color for admin section background
 */
export const ADMIN_SECTION_GRADIENT = 'from-orange-600/20 to-amber-600/20';

/**
 * Color for empty cells
 */
export const EMPTY_CELL_COLOR = 'bg-slate-800/50';

/**
 * Color for weekend cells (if needed in future)
 */
export const WEEKEND_CELL_OVERLAY = 'ring-1 ring-indigo-500/30';

/**
 * Generate a map of task IDs to colors for legend display
 * 
 * @param taskIds - Array of unique task IDs
 * @returns Map of taskId -> color
 */
export const generateTaskColorMap = (taskIds: string[]): Map<string, string> => {
  const colorMap = new Map<string, string>();
  
  taskIds.forEach(taskId => {
    colorMap.set(taskId, generateTaskColor(taskId));
  });
  
  return colorMap;
};

/**
 * Get text color based on background color for contrast
 * Uses luminance calculation to determine if white or black text is better
 * 
 * @param hexColor - Background color in hex format
 * @returns 'text-white' or 'text-black'
 */
export const getContrastTextColor = (hexColor: string): string => {
  // Remove # if present
  const hex = hexColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white for dark backgrounds, black for light backgrounds
  return luminance > 0.5 ? 'text-black' : 'text-white';
};

/**
 * Lighten a hex color by a percentage
 * Used for hover effects
 * 
 * @param hexColor - Color in hex format
 * @param percent - Percentage to lighten (0-100)
 * @returns Lightened hex color
 */
export const lightenColor = (hexColor: string, percent: number): string => {
  const hex = hexColor.replace('#', '');
  const num = parseInt(hex, 16);
  
  const r = Math.min(255, Math.floor(((num >> 16) + percent * 2.55)));
  const g = Math.min(255, Math.floor((((num >> 8) & 0x00FF) + percent * 2.55)));
  const b = Math.min(255, Math.floor(((num & 0x0000FF) + percent * 2.55)));
  
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

/**
 * Darken a hex color by a percentage
 * Used for border effects
 * 
 * @param hexColor - Color in hex format
 * @param percent - Percentage to darken (0-100)
 * @returns Darkened hex color
 */
export const darkenColor = (hexColor: string, percent: number): string => {
  const hex = hexColor.replace('#', '');
  const num = parseInt(hex, 16);
  
  const r = Math.max(0, Math.floor(((num >> 16) - percent * 2.55)));
  const g = Math.max(0, Math.floor((((num >> 8) & 0x00FF) - percent * 2.55)));
  const b = Math.max(0, Math.floor(((num & 0x0000FF) - percent * 2.55)));
  
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

/**
 * Get continuation arrow styling for multi-week tasks
 */
export const CONTINUATION_ARROW = '→';

/**
 * Get continuation arrow with color
 * 
 * @param color - Task color
 * @returns Styled arrow component props
 */
export const getContinuationArrowStyle = (color: string): React.CSSProperties => {
  return {
    color: color,
    fontSize: '1.25rem',
    fontWeight: 'bold',
  };
};

