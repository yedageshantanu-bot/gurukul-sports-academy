/**
 * Phone number normalization and validation utilities for Academy CRM.
 * Standardizes primary parent WhatsApp numbers and student contact numbers
 * to E.164 international format (+[country_code][number]).
 */

export interface PhoneValidationResult {
  valid: boolean;
  normalized: string;
  error?: string;
}

export function normalizePhoneNumber(rawPhone: string | null | undefined): string {
  if (!rawPhone) return '';

  let cleaned = rawPhone.trim();
  if (!cleaned) return '';

  const hasLeadingPlus = cleaned.startsWith('+');
  let digits = cleaned.replace(/\D/g, '');

  // Strip leading 0 if 11 digits (e.g., 09404849500 -> 9404849500 Indian mobile)
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // 10-digit Indian standard mobile -> +91XXXXXXXXXX
  if (digits.length === 10) {
    return `+91${digits}`;
  }

  // 12-digit starting with 91 (India) -> +91XXXXXXXXXX
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }

  // International numbers with explicit '+' prefix and standard length (7 to 15 digits)
  if (hasLeadingPlus && digits.length >= 7 && digits.length <= 15) {
    return `+${digits}`;
  }

  // Numbers without '+' but 11-15 digits
  if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }

  // Return digits with + if available, or original cleaned
  return hasLeadingPlus ? `+${digits}` : digits;
}

export function validatePhoneNumber(
  rawPhone: string | null | undefined,
  required: boolean = false
): PhoneValidationResult {
  if (!rawPhone || !rawPhone.trim()) {
    if (required) {
      return {
        valid: false,
        normalized: '',
        error: 'Phone number is required.',
      };
    }
    return {
      valid: true,
      normalized: '',
    };
  }

  const normalized = normalizePhoneNumber(rawPhone);
  const digits = normalized.replace(/\D/g, '');

  // E.164 requires 7 to 15 digits (ITU-T recommendation E.164)
  if (digits.length < 7 || digits.length > 15) {
    return {
      valid: false,
      normalized,
      error: `Invalid phone number length (${digits.length} digits). Expected 10 digits for India or 7-15 digits with country code.`,
    };
  }

  // Must start with + when normalized
  if (!normalized.startsWith('+')) {
    return {
      valid: false,
      normalized,
      error: 'Invalid phone format. Please include a 10-digit number or international code (e.g. +91 9404849500).',
    };
  }

  return {
    valid: true,
    normalized,
  };
}
