import React, { Suspense, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, Calendar, CreditCard, Megaphone, Settings, LogOut, Award, Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { InstallPwaPrompt } from '../pwa/InstallPwaPrompt';
import { TableSkeleton } from '../common/SkeletonLoader';
import { NotificationCenterModal } from '../notifications/NotificationCenterModal';

export const StudentLayout: React.FC = () => {
  const { profile, logout } = useAuth();
  const { academyName, logoUrl } = useSettings();
  const navigate = useNavigate();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Home', path: '/student/dashboard', icon: Home },
    { label: 'Attendance', path: '/student/attendance', icon: Calendar },
    { label: 'Fees & PDF', path: '/student/fees', icon: CreditCard },
    { label: 'Notices', path: '/student/announcements', icon: Megaphone },
    { label: 'Settings', path: '/student/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-6 selection:bg-blue-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/85 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <NavLink to="/student/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700/60 p-1 flex items-center justify-center shrink-0 shadow-sm">
              <img src={logoUrl || '/logo.png'} alt="Gurukul" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight leading-none">
                {academyName || 'Gurukul Sports Academy'}
              </h1>
              <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1 mt-0.5">
                <Award className="w-3 h-3 text-amber-400" />
                Student Mobile App
              </span>
            </div>
          </NavLink>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1 bg-slate-950/60 border border-slate-800 rounded-2xl p-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'text-blue-300 bg-blue-500/20 shadow-sm border border-blue-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Notification Center Bell Trigger */}
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition-all"
              aria-label="Open notifications"
              title="Notification Center"
            >
              <Bell className="w-5 h-5 text-slate-200" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg shadow-rose-950/50 border border-slate-900 animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <div className="hidden sm:block">
              <InstallPwaPrompt compact />
            </div>

            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-white">{profile?.fullName || 'Student'}</div>
              <div className="text-[10px] text-slate-400">{profile?.phone || 'Verified Member'}</div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 md:py-6">
        <Suspense fallback={<TableSkeleton rows={5} cols={3} />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Notification Center Modal / Drawer */}
      <NotificationCenterModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onUnreadCountChange={setUnreadCount}
      />

      {/* Mobile Bottom Navigation Bar (Persistent 5-Item Native App Navigation) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/90 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] md:hidden shadow-2xl">
        <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-medium transition-all ${
                    isActive
                      ? 'text-blue-400 bg-blue-500/15 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`
                }
              >
                <Icon className="w-4 h-4 mb-0.5" />
                <span className="truncate max-w-full">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
