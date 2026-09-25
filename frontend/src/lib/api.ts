import { supabase } from './supabase';

/**
 * Returns the normalized API base URL (e.g. 'https://academy-crm-backend.onrender.com/api' or '/api').
 * Ensures /api is included cleanly without duplication.
 */
export function getApiBaseUrl(): string {
  // If explicitly specified in environment, use that
  const rawBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  if (rawBase) {
    if (rawBase.endsWith('/api')) return rawBase;
    return `${rawBase}/api`;
  }
  // If running in production browser on Cloudflare Pages or custom domain, route directly to Render backend
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    return 'https://gurukul-sports-backend.onrender.com/api';
  }
  // Default to relative /api for local dev proxy
  return '/api';
}

export const isDemoDomain = typeof window !== 'undefined' && (
  window.location.hostname.includes('demo') ||
  window.location.port === '3005'
);

export const API_BASE = getApiBaseUrl();

/**
 * Resolves an endpoint path to a full API URL.
 * Automatically handles leading slashes and prevents duplicate /api prefixes.
 */
export function getApiUrl(endpoint: string = ''): string {
  const base = getApiBaseUrl();
  let cleanEndpoint = endpoint.trim();
  if (cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.slice(4);
  } else if (cleanEndpoint === '/api') {
    cleanEndpoint = '';
  }
  if (!cleanEndpoint) return base;
  if (!cleanEndpoint.startsWith('/')) {
    cleanEndpoint = `/${cleanEndpoint}`;
  }
  return `${base}${cleanEndpoint}`;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  let token: string | null | undefined = null;
  try {
    token = localStorage.getItem('gurukul_access_token');
  } catch {
    // Ignore localStorage errors
  }

  if (!token) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token;
    } catch {
      // Fallback
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (isDemoDomain) {
    headers['X-Demo-Mode'] = 'true';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = getApiUrl(endpoint);

  let response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 (token expired or invalid)
  if (response.status === 401) {
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshData.session?.access_token) {
        token = refreshData.session.access_token;
        headers['Authorization'] = `Bearer ${token}`;
        response = await fetch(url, {
          ...options,
          headers,
        });
      } else {
        // Stale or revoked token from previous instance
        try {
          localStorage.removeItem('gurukul_access_token');
          localStorage.removeItem('gurukul_user_profile');
        } catch {}
        await supabase.auth.signOut().catch(() => {});
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.replace('/login?expired=1');
          return {} as T;
        }
      }
    } catch {
      try {
        localStorage.removeItem('gurukul_access_token');
        localStorage.removeItem('gurukul_user_profile');
      } catch {}
      await supabase.auth.signOut().catch(() => {});
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.replace('/login?expired=1');
        return {} as T;
      }
    }
  }

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = json.error?.message || json.message || `HTTP ${response.status} Error`;
    throw new Error(errorMsg);
  }

  return (json.data !== undefined ? json.data : json) as T;
}
