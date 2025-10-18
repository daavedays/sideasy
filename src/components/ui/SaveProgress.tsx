/**
 * SaveProgress (Glassmorphism)
 * Reusable status indicator for multi-phase saves with glowing animation.
 */

import React from 'react';

type Phase = 'writingSchedule' | 'updatingLedgers' | 'updatingStats' | 'done' | 'idle';

interface SaveProgressProps {
  visible: boolean;
  phase: Phase;
  processed?: number;
  total?: number;
  className?: string;
}

const SaveProgress: React.FC<SaveProgressProps> = ({ visible, phase, processed = 0, total = 0, className }) => {
  if (!visible || phase === 'idle' || phase === 'done') return null;

  const message = (() => {
    if (phase === 'writingSchedule') return '...שומר';
    if (phase === 'updatingLedgers') {
      const suffix = total > 0 ? ` (${processed}/${total})` : '';
      return `מעדכן נתוני עובדים${suffix}`;
    }
    if (phase === 'updatingStats') return 'מעדכן נתונים סטטיסטיים';
    return '';
  })();

  return (
    <div className={`w-full mt-3`} dir="rtl">
      <div
        className={`
          relative px-4 py-3 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md
          text-white shadow-lg shadow-blue-500/20
          ${className || ''}
        `}
      >
        <div className="flex items-center gap-3">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_12px_2px_rgba(59,130,246,0.6)]"
            aria-hidden
          />
          <span className="font-semibold">
            {message}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SaveProgress;


