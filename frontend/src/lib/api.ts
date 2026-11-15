import { supabase } from './supabase';

/**
 * Returns the normalized API base URL (e.g. 'https://gurukul-sports-backend-ll86.onrender.com/api' or '/api').
 * Guarantees that production web traffic (e.g. on Cloudflare Pages or custom domains) is NEVER routed
 * back to the static file server, but correctly directed to the Render Express API backend.
 */
export function getApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

  // If in browser on any non-localhost host (Cloudflare Pages, custom domain, preview)
  if (
    typeof window !== 'undefined' &&
    !window.location.hostname.includes('localhost') &&
    !window.location.hostname.includes('127.0.0.1')
  ) {
    if (envUrl && (envUrl.startsWith('http://') || envUrl.startsWith('https://'))) {
      return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;
    }
    // Remote client without full backend URL -> route directly to live Render backend
    return 'https://gurukul-sports-backend-ll86.onrender.com/api';
  }

  // Local development
  if (envUrl) {
    if (envUrl.endsWith('/api')) return envUrl;
    return `${envUrl}/api`;
  }
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

/**
 * Checks if a JWT string is expired or about to expire within bufferSeconds.
 */
export function isJwtExpired(token: string, bufferSeconds: number = 45): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return false;
    return Date.now() >= (payload.exp * 1000) - (bufferSeconds * 1000);
  } catch {
    return false;
  }
}

let refreshPromise: Promise<string | null> | null = null;

/**
 * Server-side & Supabase hybrid token refresh mutex.
 * Rotates access token without race conditions and notifies the entire app.
 */
export async function refreshTokenFromServer(_force = false): Promise<string | null> {
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

      // 1. Primary: Rotate token via backend /api/auth/refresh if refresh token is available
      if (refreshToken) {
        try {
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

                // Dispatch global event so React components & AuthContext update token immediately
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(
                    new CustomEvent('gurukul:token_refreshed', {
                      detail: { token: newToken, refreshToken: newRefreshToken },
                    })
                  );
                }

                return newToken;
              }
            }
          }
        } catch (serverErr) {
          console.warn('[apiClient] Backend refresh call error, falling back to Supabase client refresh:', serverErr);
        }
      }

      // 2. Secondary Fallback: Direct Supabase client refreshSession
      try {
        const { data: sbData, error: sbErr } = await supabase.auth.refreshSession();
        if (!sbErr && sbData?.session?.access_token) {
          const newToken = sbData.session.access_token;
          const newRefresh = sbData.session.refresh_token;

          try {
            localStorage.setItem('gurukul_access_token', newToken);
            if (newRefresh) {
              localStorage.setItem('gurukul_refresh_token', newRefresh);
            }
          } catch {}

          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('gurukul:token_refreshed', {
                detail: { token: newToken, refreshToken: newRefresh },
              })
            );
          }

          return newToken;
        }
      } catch (sbRefreshErr) {
        console.warn('[apiClient] Supabase refreshSession error:', sbRefreshErr);
      }

      // 3. Tertiary Fallback: Check if Supabase already has an active valid session
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token && !isJwtExpired(session.access_token, 10)) {
          try {
            localStorage.setItem('gurukul_access_token', session.access_token);
            if (session.refresh_token) {
              localStorage.setItem('gurukul_refresh_token', session.refresh_token);
            }
          } catch {}
          return session.access_token;
        }
      } catch {}

      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Returns a guaranteed valid (non-expired) access token.
 * Proactively refreshes the token if expired or expiring within 45 seconds.
 */
export async function getValidAccessToken(): Promise<string | null> {
  let token: string | null = null;
  try {
    token = localStorage.getItem('gurukul_access_token');
  } catch {}

  // If token is missing, check Supabase session
  if (!token) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token || null;
      if (token) {
        try {
          localStorage.setItem('gurukul_access_token', token);
          if (session?.refresh_token) {
            localStorage.setItem('gurukul_refresh_token', session.refresh_token);
          }
        } catch {}
      }
    } catch {}
  }

  // If token exists but is expired or close to expiry, proactively refresh before making any call!
  if (token && isJwtExpired(token, 45)) {
    const refreshed = await refreshTokenFromServer();
    if (refreshed) {
      return refreshed;
    }
  }

  return token;
}

/**
 * Drop-in wrapper around native fetch that handles automatic Bearer token injection,
 * proactive token expiry refresh, and 401 retry.
 */
export async function authFetch(
  input: string | URL | Request,
  init: RequestInit = {}
): Promise<Response> {
  const token = await getValidAccessToken();

  const headers = new Headers(init.headers || {});
  if (isDemoDomain) {
    headers.set('X-Demo-Mode', 'true');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response = await fetch(input, {
    ...init,
    headers,
  });

  // Handle 401: Token might have been revoked or invalidated on server
  const urlStr = typeof input === 'string' ? input : (input as any).url || '';
  if (
    response.status === 401 &&
    !urlStr.includes('/auth/login') &&
    !urlStr.includes('/auth/refresh')
  ) {
    const newToken = await refreshTokenFromServer(true);
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      response = await fetch(input, {
        ...init,
        headers,
      });
    }
  }

  return response;
}

/**
 * Universal JSON API Client for Gurukul CRM
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getValidAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (isDemoDomain) {
    headers['X-Demo-Mode'] = 'true';
  }

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = getApiUrl(endpoint);

  let response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 (token expired or invalid) - bypass if calling auth endpoints directly
  if (
    response.status === 401 &&
    !endpoint.includes('/auth/login') &&
    !endpoint.includes('/auth/refresh')
  ) {
    const newToken = await refreshTokenFromServer(true);
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(url, {
        ...options,
        headers,
      });
    } else {
      console.warn(`[apiClient] Request to ${endpoint} returned 401; preserving persistent session.`);
    }
  }

  // Gracefully handle empty or non-JSON responses
  const text = await response.text();
  let json: any = {};
  if (text && text.trim().length > 0) {
    try {
      json = JSON.parse(text);
    } catch {
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}: ${text.slice(0, 100)}`);
      }
      return text as unknown as T;
    }
  }

  if (!response.ok) {
    const errorMsg = json?.error?.message || json?.message || `HTTP ${response.status} Error`;
    throw new Error(errorMsg);
  }

  return (json?.data !== undefined ? json.data : json) as T;
}
