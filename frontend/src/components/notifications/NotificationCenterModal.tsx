import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  X, 
  CheckCheck, 
  CreditCard, 
  Megaphone, 
  ShieldAlert, 
  UserCheck, 
  ExternalLink, 
  Smartphone, 
  CheckCircle2 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../lib/api';

export interface InAppNotification {
  id: string;
  type: 'ABSENCE' | 'ANNOUNCEMENT' | 'FEES' | 'ATTENDANCE' | 'SYSTEM';
  title: string;
  message: string;
  date: string;
  createdAt: string;
  priority?: string;
  actionUrl?: string;
  actionText?: string;
}

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  onUnreadCountChange,
}) => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'ALL' | 'ABSENCE' | 'ANNOUNCEMENT' | 'FEES' | 'ATTENDANCE'>('ALL');
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('gurukul_read_notifications');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const { data: notifications = [], isLoading, refetch } = useQuery<InAppNotification[]>({
    queryKey: ['student-in-app-notifications'],
    queryFn: async () => {
      const res = await fetch(getApiUrl('/student-portal/notifications'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!token,
    staleTime: 30 * 1000,
  });

  // Calculate unread count
  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  useEffect(() => {
    if (onUnreadCountChange) {
      onUnreadCountChange(unreadCount);
    }
  }, [unreadCount, onUnreadCountChange]);

  const markAsRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem('gurukul_read_notifications', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    const next = new Set(allIds);
    setReadIds(next);
    try {
      localStorage.setItem('gurukul_read_notifications', JSON.stringify(allIds));
    } catch {}
  };

  const handleNotificationClick = (item: InAppNotification) => {
    markAsRead(item.id);
    if (item.actionUrl) {
      onClose();
      navigate(item.actionUrl);
    }
  };

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === 'ALL') return true;
    return item.type === activeTab;
  });

  const getCategoryMeta = (type: string) => {
    switch (type) {
      case 'ABSENCE':
        return {
          icon: ShieldAlert,
          color: 'text-rose-400',
          bg: 'bg-rose-500/15 border-rose-500/30',
          pill: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          label: 'Absence Alert',
        };
      case 'ANNOUNCEMENT':
        return {
          icon: Megaphone,
          color: 'text-amber-400',
          bg: 'bg-amber-500/15 border-amber-500/30',
          pill: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          label: 'Notice',
        };
      case 'FEES':
        return {
          icon: CreditCard,
          color: 'text-purple-400',
          bg: 'bg-purple-500/15 border-purple-500/30',
          pill: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
          label: 'Fee Receipt',
        };
      case 'ATTENDANCE':
        return {
          icon: UserCheck,
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/15 border-emerald-500/30',
          pill: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          label: 'Attendance',
        };
      default:
        return {
          icon: Bell,
          color: 'text-blue-400',
          bg: 'bg-blue-500/15 border-blue-500/30',
          pill: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
          label: 'Academy',
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800/90 flex items-center justify-between bg-slate-900/95 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm md:text-base font-bold text-white leading-tight">Notification Center</h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-sm">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">Alerts, absences & academy updates</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 flex items-center gap-1 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Mark read</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close notifications panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="px-4 py-2.5 border-b border-slate-800/70 bg-slate-950/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'ABSENCE', label: 'Absences ⚠️' },
            { id: 'ANNOUNCEMENT', label: 'Notices 📢' },
            { id: 'FEES', label: 'Receipts 🧾' },
            { id: 'ATTENDANCE', label: 'Attendance 🥋' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 border border-blue-400/40'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notifications Scroll List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 divide-y divide-slate-800/40">
          {isLoading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-slate-800/50 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/60 mx-auto flex items-center justify-center text-slate-500">
                <CheckCircle2 className="w-6 h-6 text-emerald-400/60" />
              </div>
              <h3 className="text-sm font-bold text-slate-200">All Caught Up!</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                No notifications in this category right now. New alerts will show up here instantly.
              </p>
            </div>
          ) : (
            filteredNotifications.map((item) => {
              const meta = getCategoryMeta(item.type);
              const Icon = meta.icon;
              const isRead = readIds.has(item.id);
              const formattedTime = item.createdAt
                ? new Date(item.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Recent';

              return (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`pt-2.5 first:pt-0 cursor-pointer group`}
                >
                  <div
                    className={`p-3 rounded-2xl transition-all border ${
                      isRead
                        ? 'bg-slate-950/40 border-slate-800/60 opacity-80 hover:opacity-100 hover:border-slate-700'
                        : 'bg-slate-900/90 border-slate-700/80 shadow-md hover:border-blue-500/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl ${meta.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                        <Icon className={`w-4 h-4 ${meta.color}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${meta.pill}`}>
                            {meta.label}
                          </span>
                          <span className="text-[10px] text-slate-500 flex items-center gap-1.5 shrink-0">
                            {!isRead && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
                            {formattedTime}
                          </span>
                        </div>

                        <h4 className="text-xs md:text-sm font-bold text-white group-hover:text-blue-300 transition-colors leading-tight">
                          {item.title}
                        </h4>

                        <p className="text-xs text-slate-300 mt-1 leading-relaxed line-clamp-3">
                          {item.message}
                        </p>

                        {item.actionText && (
                          <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-blue-400 group-hover:text-blue-300">
                            <span>{item.actionText}</span>
                            <ExternalLink className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info: Web Push Status */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-3.5 h-3.5 text-blue-400" />
            <span>PWA Mobile Alerts Active</span>
          </div>
          <button
            onClick={() => refetch()}
            className="text-xs text-blue-400 hover:underline font-medium"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};
