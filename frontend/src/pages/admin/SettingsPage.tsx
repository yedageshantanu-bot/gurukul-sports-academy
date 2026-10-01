import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import { apiClient } from '../../lib/api';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Globe,
  Coins,
  CheckCircle2,
  AlertCircle,
  Save,
  RotateCcw,
  Sparkles,
  Upload,
  Trash2,
  MessageSquare,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { settings, refreshSettings } = useSettings();

  const [whatsappStats, setWhatsappStats] = useState<{
    isConnected: boolean;
    sent: number;
    totalSent: number;
    queued: number;
    failed: number;
    dailyLimit: number;
    remainingLimit: number;
  }>({
    isConnected: false,
    sent: 0,
    totalSent: 0,
    queued: 0,
    failed: 0,
    dailyLimit: 100,
    remainingLimit: 100,
  });

  const [formData, setFormData] = useState({
    academy_name: '',
    logo_url: '',
    phone: '',
    email: '',
    address: '',
    website: '',
    currency: 'INR',
  });

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) {
      setFormData({
        academy_name: settings.academy_name || 'Gurukul Sports Academy',
        logo_url: settings.logo_url || '/logo.png',
        phone: settings.phone || '+91 98765 43210',
        email: settings.email || 'admin@gurukulsports.in',
        address: settings.address || 'Gurukul Sports Complex, Multi-Sport Training Facility, Pune, Maharashtra',
        website: settings.website || 'https://gurukulsports.in',
        currency: settings.currency || 'INR',
      });
    }

    const fetchWhatsappStats = async () => {
      try {
        const res = await apiClient<{
          success: boolean;
          data: {
            isConnected: boolean;
            todayStats: {
              sent: number;
              totalSent?: number;
              failed: number;
              queued: number;
              dailyLimit: number;
              remainingLimit: number;
            };
          };
        }>('/whatsapp/status');

        if (res.data) {
          setWhatsappStats({
            isConnected: !!res.data.isConnected,
            sent: res.data.todayStats?.sent || 0,
            totalSent: res.data.todayStats?.totalSent || 0,
            queued: res.data.todayStats?.queued || 0,
            failed: res.data.todayStats?.failed || 0,
            dailyLimit: res.data.todayStats?.dailyLimit || 100,
            remainingLimit: res.data.todayStats?.remainingLimit || 100,
          });
        }
      } catch (err) {
        // Silently continue if gateway offline
      }
    };

    fetchWhatsappStats();
  }, [settings]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, SVG).');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setErrorMessage('Image size should be less than 4MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setFormData((prev) => ({ ...prev, logo_url: dataUrl }));
        setSuccessMessage('Logo preview updated. Click "Save Settings" to persist.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await apiClient('/settings', {
        method: 'PUT',
        body: JSON.stringify(formData),
      });

      await refreshSettings();
      setSuccessMessage('Academy settings successfully synchronized and saved.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update academy settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (settings) {
      setFormData({
        academy_name: settings.academy_name || 'Gurukul Sports Academy',
        logo_url: settings.logo_url || '/logo.png',
        phone: settings.phone || '+91 98765 43210',
        email: settings.email || 'admin@gurukulsports.in',
        address: settings.address || 'Gurukul Sports Complex, Multi-Sport Training Facility, Pune, Maharashtra',
        website: settings.website || 'https://gurukulsports.in',
        currency: settings.currency || 'INR',
      });
      setSuccessMessage('Changes reverted to saved database profile.');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20">
              System Administration
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1">Academy Profile & Settings</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage organization branding, official contact channels, and central operational parameters.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#1E293B] hover:bg-[#334155] border border-white/10 text-slate-300 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white shadow-md transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Changes...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Organization & Logo (1 col) */}
        <div className="space-y-6">
          {/* Logo Card */}
          <div className="bg-[#1E293B] border border-white/10 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-400" />
                Academy Logo
              </h2>
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Transparent 2D
              </span>
            </div>

            {/* Logo Preview */}
            <div className="flex flex-col items-center justify-center p-6 bg-[#0F172A] border border-white/5 rounded-xl">
              <img
                src={formData.logo_url || '/logo.png'}
                alt="Academy Logo Preview"
                className="w-24 h-24 object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/logo.png';
                }}
              />
              <span className="text-[11px] text-slate-400 mt-3 font-medium">
                Live Navbar & Receipt Logo
              </span>
            </div>

            {/* Upload Buttons */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#273549] hover:bg-[#334155] border border-white/10 text-white transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-orange-400" />
                Upload New
              </button>
              <button
                type="button"
                onClick={() => handleInputChange('logo_url', '/logo.png')}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#0F172A] hover:bg-[#162235] border border-white/10 text-slate-300 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                Default Logo
              </button>
            </div>
            <p className="text-[10.5px] text-slate-400 leading-relaxed">
              Recommended: High-resolution PNG or SVG with transparent background for pristine 2D display.
            </p>
          </div>

          {/* Quick System Status Card */}
          <div className="bg-[#1E293B] border border-white/10 rounded-xl p-5 shadow-lg space-y-3">
            <h2 className="text-sm font-bold text-white flex items-center justify-between">
              <span>Instance Status</span>
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Operational
              </span>
            </h2>
            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-slate-400">Database Engine</span>
                <span className="font-semibold text-emerald-400">Supabase PG17 (Connected)</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-slate-400">API Status</span>
                <span className="font-semibold text-emerald-400">Active (v2.4)</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-400">Security Layer</span>
                <span className="font-semibold text-orange-400">JWT + RBAC Enforced</span>
              </div>
            </div>
          </div>

          {/* WhatsApp Messaging Dispatch & Analytics Card */}
          <div className="bg-[#1E293B] border border-emerald-500/20 rounded-xl p-5 shadow-lg space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none"></div>

            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white leading-none">WhatsApp Messaging</h2>
                  <span className="text-[10px] text-slate-400">System Gateway Dispatch Counter</span>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                whatsappStats.isConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                {whatsappStats.isConnected ? 'Connected' : 'Standby'}
              </span>
            </div>

            {/* Total Messages Highlight Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 bg-[#0F172A] border border-white/5 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Total Dispatched
                </span>
                <span className="text-xl font-black text-emerald-400 block mt-0.5">
                  {whatsappStats.totalSent || whatsappStats.sent || 0}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">All-time count</span>
              </div>

              <div className="p-3 bg-[#0F172A] border border-white/5 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Sent Today
                </span>
                <span className="text-xl font-black text-white block mt-0.5">
                  {whatsappStats.sent || 0}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  Limit: {whatsappStats.dailyLimit}/day
                </span>
              </div>
            </div>

            {/* Details List */}
            <div className="space-y-2 text-xs text-slate-300 pt-1">
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Remaining Quota Today</span>
                <span className="font-semibold text-white">{whatsappStats.remainingLimit} msgs</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Queue Backlog</span>
                <span className="font-semibold text-slate-300">{whatsappStats.queued} pending</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">Dispatch Status</span>
                <span className="font-semibold text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Anti-Ban Engine Active
                </span>
              </div>
            </div>

            {/* Quick Link to WhatsApp Manager */}
            <Link
              to="/admin/whatsapp"
              className="inline-flex items-center justify-center gap-2 w-full px-3.5 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-semibold transition-colors"
            >
              <span>Manage WhatsApp Gateway & Logs</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Right Column: Institutional & Contact Details (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#1E293B] border border-white/10 rounded-xl p-6 shadow-lg space-y-5">
            <div className="pb-3 border-b border-white/10">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-orange-400" />
                Institutional Details
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                These details will appear across fee receipts, student report cards, and communication headers.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-300">
                  Academy Name <span className="text-orange-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.academy_name}
                  onChange={(e) => handleInputChange('academy_name', e.target.value)}
                  placeholder="e.g. Gurukul Sports Academy"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F172A] border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-orange-400" />
                  Primary Contact Phone
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F172A] border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-orange-400" />
                  Official Email Address
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="admin@gurukulsports.in"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F172A] border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3 h-3 text-orange-400" />
                  Official Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  placeholder="https://gurukulsports.in"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F172A] border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Coins className="w-3 h-3 text-orange-400" />
                  Primary Billing Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F172A] border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
                >
                  <option value="INR">INR (₹) — Indian Rupee</option>
                  <option value="USD">USD ($) — US Dollar</option>
                  <option value="AED">AED (د.إ) — UAE Dirham</option>
                  <option value="GBP">GBP (£) — British Pound</option>
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-orange-400" />
                  Campus / Facility Physical Address
                </label>
                <textarea
                  rows={3}
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Full physical sports complex address..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F172A] border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white shadow-md transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default SettingsPage;
