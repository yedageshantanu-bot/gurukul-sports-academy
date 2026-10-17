import React, { useState, useEffect } from 'react';
import { BellRing, CheckCircle, ShieldAlert, Sparkles } from 'lucide-react';

export const NotificationPromptCard: React.FC = () => {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isRequesting, setIsRequesting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
    } else {
      setPermission(Notification.permission);
    }
  }, []);

  const handleRequestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    try {
      setIsRequesting(true);
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        setShowSuccessToast(true);
        // Dispatch instant welcome notification
        try {
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'SHOW_NOTIFICATION',
              title: 'Gurukul Sports Academy 🥋',
              body: 'Push notifications are now active! You will receive instant academy updates.',
              icon: '/icon-192.png',
            });
          } else {
            new Notification('Gurukul Sports Academy 🥋', {
              body: 'Push notifications are now active! You will receive instant academy updates.',
              icon: '/icon-192.png',
            });
          }
        } catch (e) {
          console.warn('Could not trigger local notification:', e);
        }

        setTimeout(() => setShowSuccessToast(false), 5000);
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
    } finally {
      setIsRequesting(false);
    }
  };

  if (permission === 'unsupported') {
    return null;
  }

  // Already granted
  if (permission === 'granted') {
    return (
      <div className="flex items-center justify-between px-3.5 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">Push Notifications Active</span>
          <span className="text-slate-400 text-[11px] hidden sm:inline">• Instant alerts enabled for this device</span>
        </div>
        <button
          onClick={() => {
            try {
              new Notification('Gurukul Sports Academy 🥋', {
                body: 'Test notification delivered successfully! All systems active.',
                icon: '/icon-192.png',
              });
            } catch {}
          }}
          className="px-2.5 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 font-bold text-[11px] transition-colors"
        >
          Test Alert
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
          Push notifications enabled successfully!
        </div>
      )}
    </div>
  );
};
