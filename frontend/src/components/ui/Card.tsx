import React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  hoverEffect?: boolean;
  accent?: 'orange' | 'indigo' | 'purple' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'none';
}

export const Card: React.FC<CardProps> = ({ 
  className, 
  hover = false,
  hoverEffect = false,
  accent = 'none',
  children, 
  ...props 
}) => {
  const isHover = hover || hoverEffect;
  const accentBorders = {
    none: '',
    orange: 'border-t-4 border-t-orange-500',
    indigo: 'border-t-4 border-t-orange-500',
    purple: 'border-t-4 border-t-purple-600',
    emerald: 'border-t-4 border-t-emerald-500',
    amber: 'border-t-4 border-t-amber-500',
    rose: 'border-t-4 border-t-rose-500',
    cyan: 'border-t-4 border-t-cyan-500',
  };

  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-card transition-all duration-200 overflow-hidden text-slate-800 dark:text-slate-100',
        isHover && 'hover:shadow-card-hover hover:border-slate-300/80 dark:hover:border-slate-700 hover:-translate-y-0.5',
        accentBorders[accent],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return (
    <div className={cn('px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4', className)} {...props}>
      {children}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, children, ...props }) => {
  return (
    <h3 className={cn('text-base font-semibold text-slate-900 dark:text-white tracking-tight flex items-center gap-2', className)} {...props}>
      {children}
    </h3>
  );
};

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, children, ...props }) => {
  return (
    <p className={cn('text-xs text-slate-500 dark:text-slate-400 mt-0.5', className)} {...props}>
      {children}
    </p>
  );
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return (
    <div className={cn('p-6', className)} {...props}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return (
    <div className={cn('px-6 py-3.5 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between', className)} {...props}>
      {children}
    </div>
  );
};
