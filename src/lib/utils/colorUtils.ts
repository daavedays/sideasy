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
 * Color palette for task assignments
 * Carefully selected for good contrast, readability, and visual appeal
 */
const TASK_COLOR_PALETTE = [
  // Blues
  '#3B82F6', // blue-500
  '#06B6D4', // cyan-500
  '#0EA5E9', // sky-500
  
  // Purples
  '#8B5CF6', // violet-500
  '#A855F7', // purple-500
  '#D946EF', // fuchsia-500
  
  // Greens
  '#10B981', // emerald-500
  '#14B8A6', // teal-500
  '#22C55E', // green-500
  
  // Oranges/Reds
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#F97316', // orange-500
  
  // Pinks
  '#EC4899', // pink-500
  '#FB7185', // rose-500
  
  // Others
  '#6366F1', // indigo-500
  '#84CC16', // lime-500
];

/**
 * Generate a consistent color for a task ID using hash function
 * Same task ID will always produce the same color
 * 
 * @param taskId - Unique task identifier
 * @returns Hex color string (e.g., "#3B82F6")
 */
export const generateTaskColor = (taskId: string): string => {
  // Simple hash function for consistent color selection
  let hash = 0;
  for (let i = 0; i < taskId.length; i++) {
    const char = taskId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use absolute value and modulo to get palette index
  const index = Math.abs(hash) % TASK_COLOR_PALETTE.length;
  
  return TASK_COLOR_PALETTE[index];
};

/**
 * Get background color class for task cell (with opacity for glassmorphism)
 * 
 * @param color - Hex color string
 * @returns Tailwind-compatible style object
 */
export const getTaskCellBackground = (color: string): React.CSSProperties => {
  return {
    backgroundColor: `${color}CC`, // 80% opacity
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

