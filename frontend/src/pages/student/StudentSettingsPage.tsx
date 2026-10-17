import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Settings, 
  User, 
  Smartphone, 
  Lock, 
  Moon, 
  Sun, 
  LogOut, 
  CheckCircle2, 
  Phone,
  Bell
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getApiUrl } from '../../lib/api';
import { InstallPwaPrompt } from '../../components/pwa/InstallPwaPrompt';

export const StudentSettingsPage: React.FC = () => {
  const { profile, token, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [notificationStatus, setNotificationStatus] = useState<string>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
  });

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotificationStatus(perm);
      } catch (e) {
        console.warn('Notification permission error:', e);
      }
    }
  };

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdError, setPwdError] = useState('');

  const { data: profileData } = useQuery({
    queryKey: ['student-profile-settings'],
    queryFn: async () => {
      const res = await fetch(getApiUrl('/student-portal/profile'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      return json.data;
    },
    enabled: !!token,
  });

  const student = profileData?.student;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdSuccess('');
    setPwdError('');

    if (newPassword.length < 6) {
      setPwdError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdError('Passwords do not match.');
      return;
    }

    setPwdLoading(true);
    try {
      const res = await fetch(getApiUrl('/student-portal/change-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update password.');
      }

      setPwdSuccess('Password changed successfully! You can now use your new password to log in.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwdError(err.message || 'An error occurred.');
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-400" />
          Settings & Account
        </h2>
        <p className="text-xs text-slate-400">
          Manage your student profile, app installation, and security preferences.
        </p>
      </div>

      {/* PWA Mobile Installation Section */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-blue-400" />
          Mobile App (PWA) Status
        </h3>
        <p className="text-xs text-slate-300">
          Gurukul Sports Academy is a Progressive Web App (PWA). You can install it on your Android or iPhone without needing Play Store.
        </p>
        <InstallPwaPrompt />
      </div>

      {/* Notifications & Permissions */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            Alerts & Notifications
          </h3>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
            notificationStatus === 'granted'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
          }`}>
            {notificationStatus === 'granted' ? 'Enabled 🔔' : 'Permission Required'}
          </span>
        </div>
        <p className="text-xs text-slate-300">
          Attendance alerts and payment receipts are sent via WhatsApp. Enable device notifications for instant belt promotion and academy schedule updates.
        </p>
        {notificationStatus !== 'granted' && (
          <button
            onClick={requestNotificationPermission}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center gap-2 active:scale-95 transition-all cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5" />
            Allow Notifications
          </button>
        )}
      </div>

      {/* Student Profile Overview */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <User className="w-4 h-4 text-emerald-400" />
          Student Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Full Name</span>
            <span className="font-bold text-white text-sm">{student?.name || profile?.fullName}</span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Registered Mobile</span>
            <span className="font-bold text-white text-sm flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-blue-400" />
              {student?.student_mobile || profile?.phone || 'Not registered'}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Parent / WhatsApp</span>
            <span className="font-bold text-white text-sm">
              {student?.parent_name ? `${student.parent_name} (` : ''}
              {student?.parent_whatsapp || 'Same as mobile'}
              {student?.parent_name ? ')' : ''}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Training Program</span>
            <span className="font-bold text-blue-300 text-sm">{student?.course || 'Martial Arts Division'}</span>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-purple-400" />
          Change Password / Security PIN
        </h3>

        {pwdSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {pwdSuccess}
          </div>
        )}

        {pwdError && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
            {pwdError}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">New Password / PIN</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={pwdLoading}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs transition-colors shadow-md shadow-purple-600/20"
          >
            {pwdLoading ? 'Updating Password...' : 'Save New Password'}
          </button>
        </form>
      </div>

      {/* Theme & Session Control */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-white">Theme Mode</h4>
            <p className="text-xs text-slate-400">Toggle between Dark (Dojo) and Light view</p>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
          </button>
        </div>

        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-white">Sign Out</h4>
            <p className="text-xs text-slate-400">Log out from your student account on this device</p>
          </div>
          <button
            onClick={logout}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-colors flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};
