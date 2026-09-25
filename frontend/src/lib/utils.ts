import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateString: string | Date): string {
  const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function normalizePhoneNumber(rawPhone: string | null | undefined): string {
  if (!rawPhone) return '';
  const cleaned = rawPhone.trim();
  if (!cleaned) return '';

  const hasLeadingPlus = cleaned.startsWith('+');
  let digits = cleaned.replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }

  if (hasLeadingPlus && digits.length >= 7 && digits.length <= 15) {
    return `+${digits}`;
  }

  if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }

  return hasLeadingPlus ? `+${digits}` : digits;
}

export function validatePhoneNumber(rawPhone: string | null | undefined, required: boolean = false): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  if (!rawPhone || !rawPhone.trim()) {
    if (required) {
      return { valid: false, normalized: '', error: 'Phone number is required.' };
    }
    return { valid: true, normalized: '' };
  }

  const normalized = normalizePhoneNumber(rawPhone);
  const digits = normalized.replace(/\D/g, '');

  if (digits.length < 7 || digits.length > 15) {
    return {
      valid: false,
      normalized,
      error: `Invalid phone length (${digits.length} digits). Enter a 10-digit number or international format (+91...).`,
    };
  }

  if (!normalized.startsWith('+')) {
    return {
      valid: false,
      normalized,
      error: 'Please enter a valid 10-digit number or include country code (e.g. +91 9404849500).',
    };
  }

  return { valid: true, normalized };
}
