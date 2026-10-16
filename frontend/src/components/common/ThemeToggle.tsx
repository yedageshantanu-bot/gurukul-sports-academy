import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../lib/utils';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className, showLabel = true }) => {
  const { setTheme, isDark } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme Mode Selection"
      className={cn(
        'inline-flex items-center p-1 rounded-xl transition-all duration-200',
        'bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-white/10 shadow-xs gap-1',
        className
      )}
    >
      {/* Faint Mode Button */}
      <button
        type="button"
        role="radio"
        aria-checked={!isDark}
        onClick={() => setTheme('faint')}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer select-none',
          'focus:outline-none focus:ring-2 focus:ring-orange-500/30',
          !isDark
            ? 'bg-white text-slate-900 font-bold shadow-sm border border-slate-200/80 scale-[1.02]'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
        )}
        title="Switch to Faint Mode (Soft light aesthetic theme)"
      >
        <Sun
          className={cn(
            'w-3.5 h-3.5 transition-transform duration-200',
            !isDark ? 'text-amber-500 scale-110' : 'text-slate-400'
          )}
        />
        {showLabel && (
          <span>
            <span className="hidden sm:inline">Faint Mode</span>
            <span className="sm:hidden">Faint</span>
          </span>
        )}
      </button>

      {/* Dark Mode Button */}
      <button
        type="button"
        role="radio"
        aria-checked={isDark}
        onClick={() => setTheme('dark')}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer select-none',
          'focus:outline-none focus:ring-2 focus:ring-orange-500/30',
          isDark
            ? 'bg-[#F97316] text-white font-bold shadow-sm shadow-orange-500/30 scale-[1.02]'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
        )}
        title="Switch to Dark Mode (Deep contrast dojo theme)"
      >
        <Moon
          className={cn(
            'w-3.5 h-3.5 transition-transform duration-200',
            isDark ? 'text-white scale-110' : 'text-slate-500'
          )}
        />
        {showLabel && (
          <span>
            <span className="hidden sm:inline">Dark Mode</span>
            <span className="sm:hidden">Dark</span>
          </span>
        )}
      </button>
    </div>
  );
};

