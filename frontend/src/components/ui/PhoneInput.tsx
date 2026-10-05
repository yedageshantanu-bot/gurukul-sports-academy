import React from 'react';
import { cn } from '../../lib/utils';
import { CheckCircle2, Phone } from 'lucide-react';

export interface PhoneInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  autoFocus?: boolean;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  label,
  value,
  onChange,
  error,
  helperText,
  required,
  disabled,
  placeholder = '98765 43210',
  className,
  id,
  autoFocus,
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  // Extract only the local 10 digits for display in the input box
  const rawDigits = (value || '').replace(/\D/g, '');
  const displayDigits = rawDigits.length > 10 ? rawDigits.slice(-10) : rawDigits;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    let digits = text.replace(/\D/g, '');

    // If user pasted 12 digits starting with 91: e.g. 919876543210
    if (digits.length === 12 && digits.startsWith('91')) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }

    // Limit strictly to 10 digits
    const clean10 = digits.slice(0, 10);
    onChange(clean10);
  };

  const isComplete = displayDigits.length === 10;

  return (
    <div className={cn('w-full space-y-1.5 text-left', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-normal">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          <span className={cn(
            'text-[10.5px] font-mono transition-colors',
            isComplete ? 'text-emerald-500 font-bold' : 'text-slate-400'
          )}>
            {displayDigits.length}/10 digits
          </span>
        </div>
      )}

      <div
        className={cn(
          'flex h-10 w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs transition-all duration-150 overflow-hidden',
          'focus-within:ring-2 focus-within:ring-orange-500/20 dark:focus-within:ring-orange-500/30 focus-within:border-orange-500 dark:focus-within:border-orange-500',
          disabled && 'cursor-not-allowed bg-slate-50/80 dark:bg-slate-900/60 opacity-60',
          error && 'border-rose-400 dark:border-rose-500 focus-within:ring-rose-500/20 focus-within:border-rose-500 bg-rose-50/20 dark:bg-rose-950/20'
        )}
      >
        {/* Fixed Country Code Badge (+91) */}
        <div className="flex items-center gap-1.5 px-3 bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold select-none flex-shrink-0">
          <span className="text-sm">🇮🇳</span>
          <span className="font-mono tracking-wide">+91</span>
        </div>

        {/* 10-Digit Numeric Input Field */}
        <input
          id={inputId}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={10}
          value={displayDigits}
          onChange={handleChange}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className="flex-1 h-full bg-transparent px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
        />

        {/* Completeness Status Icon */}
        <div className="flex items-center pr-3 flex-shrink-0">
          {isComplete ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 animate-in fade-in" />
          ) : (
            <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
          )}
        </div>
      </div>

      {error && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>}
      {helperText && !error && <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>}
    </div>
  );
};
