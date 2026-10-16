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

let refreshPromise: Promise<string | null> | null = null;

/**
 * Server-side token refresh mutex.
 * Rotates access token via backend POST /api/auth/refresh without race conditions.
 */
export async function refreshTokenFromServer(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      let refreshToken: string | null = null;
      try {
        refreshToken = localStorage.getItem('gurukul_refresh_token');
      } catch {}

      if (!refreshToken) {
        // Fallback: check Supabase session if available
        try {
          const { data: { session } } = await supabase.auth.getSession();
          refreshToken = session?.refresh_token || null;
        } catch {}
      }

      if (!refreshToken) {
        return null;
      }

      const response = await fetch(getApiUrl('/auth/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(isDemoDomain ? { 'X-Demo-Mode': 'true' } : {}),
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const json = await response.json().catch(() => null);
        if (json?.success && json?.data) {
          const { token: newToken, refreshToken: newRefreshToken, user } = json.data;
          if (newToken) {
            try {
              localStorage.setItem('gurukul_access_token', newToken);
              if (newRefreshToken) {
                localStorage.setItem('gurukul_refresh_token', newRefreshToken);
              }
              if (user) {
                const updatedProfile = {
                  userId: user.id,
                  profileId: user.id,
                  email: user.email,
                  fullName: user.fullName,
                  role: user.role,
                  teacherId: user.teacherId,
                  isTrial: user.isTrial,
                  trialExpiresAt: user.trialExpiresAt,
                  daysRemaining: user.daysRemaining,
                };
                localStorage.setItem('gurukul_user_profile', JSON.stringify(updatedProfile));
              }
            } catch {}

            if (newRefreshToken) {
              supabase.auth.setSession({
                access_token: newToken,
                refresh_token: newRefreshToken,
              }).catch(() => {});
            }

            return newToken;
          }
        }
      } else if (response.status === 401 || response.status === 403) {
        // Refresh token was invalid, revoked, or trial ended
        try {
          localStorage.removeItem('gurukul_access_token');
          localStorage.removeItem('gurukul_refresh_token');
          localStorage.removeItem('gurukul_user_profile');
        } catch {}
        await supabase.auth.signOut().catch(() => {});
        return null;
      }
      return null;
    } catch (err) {
      console.warn('Network error while refreshing auth token:', err);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
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

  // Handle 401 (token expired or invalid) - bypass if calling auth endpoints directly
  if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    const newToken = await refreshTokenFromServer();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(url, {
        ...options,
        headers,
      });
    } else {
      // If refresh failed because refresh token is truly gone or revoked
      let hasStoredRefreshToken = false;
      try {
        hasStoredRefreshToken = Boolean(localStorage.getItem('gurukul_refresh_token'));
      } catch {}

      if (!hasStoredRefreshToken && typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
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
