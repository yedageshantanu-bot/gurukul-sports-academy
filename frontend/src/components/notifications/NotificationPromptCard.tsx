import React, { useState, useEffect } from 'react';
import { BellRing, CheckCircle, ShieldAlert, Sparkles, Send } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../lib/api';

const VAPID_PUBLIC_KEY = 'BC2noxfQupMkGe4h2SYxU_JxRBntSyHWUrdtjukh73ajbEv91kgvb2axAhca8pzb-tjstxWO0rPJP405vjBD9pU';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const NotificationPromptCard: React.FC = () => {
  const { token } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isRequesting, setIsRequesting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [testSent, setTestSent] = useState(false);

  // Sync Push Subscription with Server
  const registerServerPushSubscription = async () => {
    if (!token || typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });
      }

      if (sub) {
        await fetch(getApiUrl('/student-portal/push-subscribe'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ subscription: sub }),
        });
        console.log('[NotificationPromptCard] Web Push subscription synced with backend server!');
      }
    } catch (err) {
      console.warn('[NotificationPromptCard] Could not register push subscription:', err);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
    } else {
      const current = Notification.permission;
      setPermission(current);
      if (current === 'granted') {
        registerServerPushSubscription();
      }
    }
  }, [token]);

  const triggerDeviceNotification = async (title: string, body: string) => {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, {
            body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            vibrate: [200, 100, 200],
            data: { url: '/student/dashboard' },
          } as any);
          return true;
        }
      }
    } catch (e) {
      console.warn('[NotificationPromptCard] ServiceWorker showNotification failed:', e);
    }

    try {
      new Notification(title, {
        body,
        icon: '/icon-192.png',
      });
      return true;
    } catch (e) {
      console.error('[NotificationPromptCard] Window Notification constructor failed:', e);
      return false;
    }
  };

  const handleRequestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    try {
      setIsRequesting(true);
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        setShowSuccessToast(true);
        await registerServerPushSubscription();
        await triggerDeviceNotification(
          'Gurukul Sports Academy 🥋',
          'Push notifications active! You will now receive instant attendance & class alerts.'
        );
        setTimeout(() => setShowSuccessToast(false), 5000);
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSendTestNotification = async () => {
    setTestSent(true);

    // 1. Trigger local service worker device notification with vibration
    await triggerDeviceNotification(
      '🥋 Gurukul Sports Academy Alert',
      'Test notification delivered! Your mobile app is receiving instant academy alerts.'
    );

    // 2. Trigger server-side push notification via backend WebPush
    if (token) {
      try {
        await fetch(getApiUrl('/student-portal/test-push'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (err) {
        console.warn('Server test-push call error:', err);
      }
    }

    setTimeout(() => setTestSent(false), 3000);
  };

  if (permission === 'unsupported') {
    return null;
  }

  // Already granted
  if (permission === 'granted') {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 sm:px-4 sm:py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300 shadow-sm">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-bold text-white">App Push Notifications Active</span>
          <span className="text-slate-400 text-[11px] hidden sm:inline">• Live alerts enabled for this device</span>
        </div>
        <button
          onClick={handleSendTestNotification}
          className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 border border-emerald-500/30 shadow-sm"
        >
          <Send className="w-3.5 h-3.5" />
          {testSent ? 'Notification Pop Dispatched! ✓' : 'Send Test Notification'}
        </button>
      </div>
    );
  }

  // Denied
  if (permission === 'denied') {
    return (
      <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-900/80 border border-amber-500/30 text-xs text-amber-200/90">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
        <div>
          <div className="font-bold text-white">Notifications Blocked in Browser</div>
          <div className="text-[11px] text-slate-300 mt-0.5">
            To receive urgent batch & attendance alerts, tap the lock/settings icon in your browser address bar and set Notifications to <strong className="text-amber-300">"Allow"</strong>.
          </div>
        </div>
      </div>
    );
  }

  // Default: Proactive Call to Action Card
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border border-blue-500/30 p-4 sm:p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 shadow-lg shadow-blue-500/20">
            <BellRing className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-white tracking-tight">
                Enable Academy Push Notifications
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Recommended
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Get instant alerts for <span className="text-white font-medium">attendance</span>, <span className="text-white font-medium">batch timings</span>, <span className="text-white font-medium">fee receipts</span>, and <span className="text-white font-medium">official announcements</span> directly on your phone.
            </p>
          </div>
        </div>

        <button
          onClick={handleRequestPermission}
          disabled={isRequesting}
          className="self-start sm:self-auto px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 border border-blue-400/40 flex items-center gap-2 transition-all active:scale-95 shrink-0"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          {isRequesting ? 'Requesting...' : 'Allow Notifications'}
        </button>
      </div>

      {showSuccessToast && (
        <div className="mt-3 py-2 px-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          Push notifications enabled successfully! Test notification sent to device.
        </div>
      )}
    </div>
  );
};
