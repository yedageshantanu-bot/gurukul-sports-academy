import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  title?: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, title?: string) => void;
  toast: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const emitToast = (message: string, type: ToastType = 'info', title?: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: { message, type, title },
      })
    );
  }
};

// Permanent global interception so native "localhost:3000 says" NEVER pops up under any circumstances
if (typeof window !== 'undefined') {
  window.alert = (msg: any) => {
    const text = typeof msg === 'object' ? JSON.stringify(msg) : String(msg ?? '');
    const lower = text.toLowerCase();
    let type: ToastType = 'info';
    let title = 'Notification';

    if (
      lower.includes('success') ||
      lower.includes('promoted') ||
      lower.includes('queued') ||
      lower.includes('settled') ||
      lower.includes('updated') ||
      lower.includes('created') ||
      lower.includes('saved') ||
      lower.includes('dispatched')
    ) {
      type = 'success';
      title = 'Success';
    } else if (
      lower.includes('error') ||
      lower.includes('failed') ||
      lower.includes('could not') ||
      lower.includes('unable') ||
      lower.includes('invalid')
    ) {
      type = 'error';
      title = 'Notice';
    } else if (lower.includes('warning') || lower.includes('please select') || lower.includes('required')) {
      type = 'warning';
      title = 'Attention';
    }

    emitToast(text, type, title);
  };

  window.confirm = (msg: any) => {
    console.log('[Suppressed native window.confirm]:', msg);
    return true;
  };
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', title?: string) => {
    if (!message) return;
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newToast: ToastItem = { id, message, type, title };

    setToasts((prev) => [...prev.slice(-4), newToast]); // keep max 5 toasts

    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, [removeToast]);

  const toast = {
    success: useCallback((msg: string, title?: string) => showToast(msg, 'success', title), [showToast]),
    error: useCallback((msg: string, title?: string) => showToast(msg, 'error', title), [showToast]),
    warning: useCallback((msg: string, title?: string) => showToast(msg, 'warning', title), [showToast]),
    info: useCallback((msg: string, title?: string) => showToast(msg, 'info', title), [showToast]),
  };

  // Listen to global app-toast events triggered by emitToast or window.alert
  useEffect(() => {
    const handleAppToast = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; type?: ToastType; title?: string }>;
      if (customEvent.detail?.message) {
        showToast(
          customEvent.detail.message,
          customEvent.detail.type || 'info',
          customEvent.detail.title
        );
      }
    };

    window.addEventListener('app-toast', handleAppToast);
    return () => {
      window.removeEventListener('app-toast', handleAppToast);
    };
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, toast }}>
      {children}
      {/* Toast Notification Container */}
      <div
        className="fixed top-4 right-4 z-[99999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full pointer-events-none px-3 sm:px-0"
        aria-live="polite"
      >
        {toasts.map((t) => {
          let borderClass = 'border-slate-700/60 bg-[#0F172A]/95 text-slate-100 shadow-slate-900/50';
          let icon = <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />;
          let defaultTitle = 'Notification';

          if (t.type === 'success') {
            borderClass = 'border-emerald-500/40 bg-[#0A1624]/95 text-emerald-50 shadow-emerald-950/40';
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />;
            defaultTitle = 'Success';
          } else if (t.type === 'error') {
            borderClass = 'border-rose-500/40 bg-[#1A0C16]/95 text-rose-50 shadow-rose-950/40';
            icon = <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />;
            defaultTitle = 'Notice';
          } else if (t.type === 'warning') {
            borderClass = 'border-amber-500/40 bg-[#1C1608]/95 text-amber-50 shadow-amber-950/40';
            icon = <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />;
            defaultTitle = 'Attention';
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-2xl backdrop-blur-md animate-in slide-in-from-top-3 fade-in duration-200 transition-all ${borderClass}`}
            >
              {icon}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider opacity-80">
                  {t.title || defaultTitle}
                </p>
                <p className="text-sm font-medium mt-0.5 leading-snug break-words">
                  {t.message}
                </p>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-white p-1 rounded-md transition-colors shrink-0"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
