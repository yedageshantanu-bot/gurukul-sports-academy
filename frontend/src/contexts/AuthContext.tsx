import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';
import { AuthContextType, Role, UserProfile } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isExpiredParam = typeof window !== 'undefined' && window.location.search.includes('expired=1');

  const [token, setToken] = useState<string | null>(() => {
    if (isExpiredParam) {
      try {
        localStorage.removeItem('gurukul_access_token');
        localStorage.removeItem('gurukul_user_profile');
      } catch {}
      return null;
    }
    try {
      return localStorage.getItem('gurukul_access_token');
    } catch {
      return null;
    }
  });

  const [profile, setProfile] = useState<UserProfile | null>(() => {
    if (isExpiredParam) return null;
    try {
      const cached = localStorage.getItem('gurukul_user_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<any | null>(() => {
    if (isExpiredParam) return null;
    try {
      const cached = localStorage.getItem('gurukul_user_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        return { id: parsed.userId, email: parsed.email };
      }
      return null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (isExpiredParam) return false;
    try {
      return !localStorage.getItem('gurukul_access_token');
    } catch {
      return false;
    }
  });

  // Fetch backend profile using verified Supabase JWT with metadata fallback
  const fetchBackendProfile = async (accessToken: string, userObj?: any): Promise<UserProfile | null> => {
    try {
      const controller = new AbortController();
      const fetchTimer = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(getApiUrl('/auth/me'), {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }).finally(() => clearTimeout(fetchTimer));

      if (response.ok) {
        const json = await response.json().catch(() => null);
        if (json?.success && json?.data) {
          return json.data as UserProfile;
        }
      } else if (response.status === 401) {
        const { data: refreshData } = await supabase.auth.refreshSession().catch(() => ({ data: null }));
        if (refreshData?.session?.access_token) {
          return fetchBackendProfile(refreshData.session.access_token, refreshData.session.user);
        } else {
          try {
            localStorage.removeItem('gurukul_access_token');
            localStorage.removeItem('gurukul_user_profile');
          } catch {}
          await supabase.auth.signOut().catch(() => {});
          return null;
        }
      } else if (response.status === 403) {
        const errJson = await response.json().catch(() => null);
        if (errJson?.code === 'TRIAL_EXPIRED' || errJson?.message?.includes('trial has ended')) {
          await supabase.auth.signOut().catch(() => {});
          throw new Error('Your 3-day trial has ended. Please contact us to continue using Academy CRM.');
        }
      }
    } catch (err: any) {
      if (err.message?.includes('trial has ended')) {
        throw err;
      }
      console.warn('Backend profile endpoint not available; falling back to Supabase auth metadata.');
    }

    // Direct fallback from Supabase user session / metadata (essential for Cloudflare Pages preview)
    const activeUser = userObj || user;
    if (activeUser) {
      const meta = activeUser.user_metadata || {};
      const role = (meta.role || (activeUser.email?.includes('teacher') ? 'TEACHER' : 'ADMIN')) as Role;
      const fullName = meta.full_name || (role === 'ADMIN' ? 'Academy Administrator' : 'Lead Instructor');

      return {
        userId: activeUser.id,
        profileId: activeUser.id,
        email: activeUser.email || '',
        fullName,
        role,
        teacherId: meta.teacherId || (role === 'TEACHER' ? activeUser.id : undefined),
      };
    }

    return null;
  };

  // Initialize session on mount and listen to auth changes (Session Persistence)
  useEffect(() => {
    let isMounted = true;

    // Safety fallback: Never keep loading screen up for more than 2.5s
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 2500);

    const initializeAuth = async () => {
      try {
        if (isExpiredParam) {
          try {
            localStorage.removeItem('gurukul_access_token');
            localStorage.removeItem('gurukul_user_profile');
          } catch {}
          if (isMounted) {
            setUser(null);
            setProfile(null);
            setToken(null);
            setLoading(false);
          }
          return;
        }

        const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));

        let tokenToVerify = session?.access_token;
        let activeUser = session?.user;

        if (!tokenToVerify) {
          try {
            const cachedToken = localStorage.getItem('gurukul_access_token');
            if (cachedToken) {
              tokenToVerify = cachedToken;
            }
          } catch {}
        }

        if (!tokenToVerify) {
          if (isMounted) {
            setUser(null);
            setProfile(null);
            setToken(null);
            setLoading(false);
          }
          return;
        }

        if (isMounted) {
          setToken(tokenToVerify);
          if (activeUser) setUser(activeUser);
        }

        const backendProfile = await fetchBackendProfile(tokenToVerify, activeUser);
        if (isMounted) {
          if (backendProfile) {
            setProfile(backendProfile);
            setUser({ id: backendProfile.userId, email: backendProfile.email });
            try {
              localStorage.setItem('gurukul_access_token', tokenToVerify);
              localStorage.setItem('gurukul_user_profile', JSON.stringify(backendProfile));
            } catch {}
          } else {
            // Token verification failed or expired - reset session cleanly
            try {
              localStorage.removeItem('gurukul_access_token');
              localStorage.removeItem('gurukul_user_profile');
            } catch {}
            setUser(null);
            setProfile(null);
            setToken(null);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        if (isMounted) {
          setLoading(false);
        }
      } finally {
        clearTimeout(safetyTimeout);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session) {
          setUser(session.user);
          setToken(session.access_token);
          const backendProfile = await fetchBackendProfile(session.access_token, session.user);
          if (backendProfile) {
            setProfile(backendProfile);
            try {
              localStorage.setItem('gurukul_user_profile', JSON.stringify(backendProfile));
            } catch {}
          }
        } else {
          // If session is null, do NOT wipe user if we have a valid cached token in localStorage!
          const cachedToken = localStorage.getItem('gurukul_access_token');
          if (!cachedToken) {
            setUser(null);
            setProfile(null);
            setToken(null);
            try {
              localStorage.removeItem('gurukul_user_profile');
            } catch {}
          }
        }
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ role: Role }> => {
    setLoading(true);
    try {
      // 1. Primary: Use backend /api/auth/login endpoint (verified fast & robust)
      try {
        const response = await fetch(getApiUrl('/auth/login'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        if (response.ok) {
          const json = await response.json();
          if (json?.success && json?.data) {
            const { token: jwtToken, refreshToken, user: authUser } = json.data;
            if (jwtToken) {
              setToken(jwtToken);
              try {
                localStorage.setItem('gurukul_access_token', jwtToken);
              } catch {}
              setUser({ id: authUser.id, email: authUser.email });

              const userProf: UserProfile = {
                userId: authUser.id,
                profileId: authUser.id,
                email: authUser.email,
                fullName: authUser.fullName,
                role: authUser.role,
                teacherId: authUser.teacherId,
                isTrial: authUser.isTrial,
                daysRemaining: authUser.daysRemaining,
              };
              setProfile(userProf);
              try {
                localStorage.setItem('gurukul_user_profile', JSON.stringify(userProf));
              } catch {}

              // Sync session with Supabase client in background
              if (refreshToken) {
                supabase.auth.setSession({
                  access_token: jwtToken,
                  refresh_token: refreshToken,
                }).catch(() => {});
              }

              return { role: userProf.role };
            }
          }
        } else {
          const errJson = await response.json().catch(() => ({}));
          const errMsg = errJson?.error?.message || errJson?.message;
          if (errMsg && (response.status === 401 || response.status === 403)) {
            throw new Error(errMsg);
          }
        }
      } catch (backendErr: any) {
        if (
          backendErr.message?.includes('Invalid email') ||
          backendErr.message?.includes('deactivated') ||
          backendErr.message?.includes('trial')
        ) {
          throw backendErr;
        }
        console.warn('Backend login endpoint unavailable; attempting direct Supabase login.', backendErr);
      }

      // 2. Direct Supabase Auth Fallback
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.session) {
        throw new Error(error?.message || 'Invalid email or password.');
      }

      setUser(data.user);
      setToken(data.session.access_token);

      const backendProfile = await fetchBackendProfile(data.session.access_token, data.user);
      if (!backendProfile) {
        await supabase.auth.signOut().catch(() => {});
        throw new Error('User profile record not found or inactive. Contact the administrator.');
      }

      setProfile(backendProfile);
      try {
        localStorage.setItem('gurukul_user_profile', JSON.stringify(backendProfile));
      } catch {}
      return { role: backendProfile.role };
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      localStorage.removeItem('gurukul_access_token');
      localStorage.removeItem('gurukul_user_profile');
      await supabase.auth.signOut();
      await fetch(getApiUrl('/auth/logout'), { method: 'POST' }).catch(() => {});
    } finally {
      setUser(null);
      setProfile(null);
      setToken(null);
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const value: AuthContextType = {
    user,
    profile,
    role: profile?.role || null,
    token,
    loading,
    isAuthenticated: !!user && !!profile,
    login,
    logout,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
