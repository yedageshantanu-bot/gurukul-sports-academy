import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../lib/utils';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className, showLabel = true }) => {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      role="group"
      aria-label="Theme selection"
      className={cn(
        'inline-flex items-center p-0.5 rounded-xl transition-all duration-200',
        'bg-slate-200/80 dark:bg-slate-800/90 border border-slate-300/80 dark:border-slate-700/80 shadow-xs gap-0.5',
        className
      )}
    >
      {/* Light Mode Button */}
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/40',
          !isDark
            ? 'bg-white text-amber-700 font-bold shadow-xs border border-slate-200/80'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
        )}
        title="Choose Light Mode"
        aria-pressed={!isDark}
      >
        <Sun className={cn('w-3.5 h-3.5 transition-transform duration-200', !isDark ? 'text-amber-500 scale-110' : 'text-slate-400')} />
        {showLabel && <span>Light</span>}
      </button>

      {/* Dark Mode Button */}
      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/40',
          isDark
            ? 'bg-indigo-600 text-white font-bold shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/50'
        )}
        title="Choose Dark Mode"
        aria-pressed={isDark}
      >
        <Moon className={cn('w-3.5 h-3.5 transition-transform duration-200', isDark ? 'text-amber-300 scale-110' : 'text-slate-500')} />
        {showLabel && <span>Dark</span>}
      </button>
    </div>
  );
};

