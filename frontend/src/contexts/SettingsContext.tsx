import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AcademySettings } from '../types/settings';
import { useAuth } from './AuthContext';
import { getApiUrl } from '../lib/api';

interface SettingsContextType {
  settings: AcademySettings | null;
  loading: boolean;
  academyName: string;
  logoUrl?: string | null;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isAuthenticated, user, role } = useAuth();
  const [settings, setSettings] = useState<AcademySettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchSettings = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(getApiUrl('/settings'), {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch academy settings');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setSettings(result.data);
      }
    } catch (err: any) {
      console.error('[SettingsContext] Error fetching settings:', err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchSettings();
    } else {
      setSettings(null);
      setLoading(false);
    }
  }, [isAuthenticated, token, fetchSettings]);

  const isDemoHost = typeof window !== 'undefined' && (
    window.location.hostname.includes('effort-career') ||
    window.location.hostname.includes('demo') ||
    window.location.port === '3005'
  );
  const isDemo = isDemoHost || role === 'DEMO_ADMIN' || user?.isTrial || user?.role === 'DEMO_ADMIN';
  let academyName = 'Gurukul Sports Academy';
  if (isDemo) {
    academyName = 'Effort Career Classes';
  } else {
    academyName = settings?.academy_name || 'Gurukul Sports Academy';
  }

  const logoUrl = isDemo ? '/effort-career-logo.png' : (settings?.logo_url && !settings.logo_url.includes('effort-career') ? settings.logo_url : '/logo.png');

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        academyName,
        logoUrl,
        refreshSettings: fetchSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
