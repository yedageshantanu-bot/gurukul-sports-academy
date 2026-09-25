import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { API_BASE } from '../../lib/api';
import {
  Smartphone,
  RefreshCw,
  Power,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Send,
  Radio,
  Clock,
  Check,
} from 'lucide-react';

interface DeviceStatus {
  status: 'CONNECTED' | 'DISCONNECTED' | 'QR_READY' | 'CONNECTING' | 'AUTHENTICATING';
  phoneNumber?: string;
  qrCode?: string;
  sessionStatus?: string;
  lastConnectedAt?: string;
}

export const WhatsAppPage: React.FC = () => {
  const { token } = useAuth();
  const [device, setDevice] = useState<DeviceStatus>({
    status: 'DISCONNECTED',
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Test message form
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Hello from Gurukul Sports Academy! Your training session reminder.');
  const [sendingTest, setSendingTest] = useState(false);

  // Fetch status from backend
  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/whatsapp/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data?.device) {
        setDevice(data.data.device);
      }
    } catch (err: any) {
      console.warn('Failed to load WhatsApp status:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-refresh when waiting for scan
  useEffect(() => {
    if (device.status === 'QR_READY' || device.status === 'CONNECTING') {
      const interval = setInterval(() => {
        fetchStatus();
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [device.status, fetchStatus]);

  // Connect or Regenerate QR code
  const handleConnectOrRefresh = async () => {
    if (!token) return;
    setRefreshing(true);
    setError(null);
    setSuccess(null);

    try {
      const endpoint = device.status === 'DISCONNECTED' ? 'connect' : 'reconnect';
      const res = await fetch(`${API_BASE}/whatsapp/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error?.message || 'Failed to generate QR code');

      // Immediately apply status and QR code from response
      const updatedStatus = data.data?.status || data.data?.device;
      if (updatedStatus) {
        setDevice(updatedStatus);
      } else if (data.data?.qrCode) {
        setDevice((prev) => ({ ...prev, status: 'QR_READY', qrCode: data.data.qrCode }));
      }

      setSuccess('Fresh QR Code generated! Please scan from WhatsApp on your smartphone.');
      await fetchStatus();
    } catch (err: any) {
      setError(err.message || 'Error communicating with WhatsApp gateway');
    } finally {
      setRefreshing(false);
    }
  };

  const { toast } = useToast();

  // Disconnect
  const handleDisconnect = async () => {
    if (!token) return;
    setRefreshing(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${API_BASE}/whatsapp/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to disconnect');

      setSuccess('Device disconnected successfully.');
      toast.success('WhatsApp session disconnected successfully.');
      await fetchStatus();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to disconnect session';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setRefreshing(false);
    }
  };

  // Send Test Message
  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !testPhone.trim()) return;
    setSendingTest(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${API_BASE}/whatsapp/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone: testPhone.trim(),
          message: testMessage.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Message dispatch failed');

      setSuccess(`Test WhatsApp message sent to ${testPhone}!`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to send test message');
    } finally {
      setSendingTest(false);
    }
  };

  const isConnected = device.status === 'CONNECTED';

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20">
              Communication Gateway
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1">WhatsApp Linked Device</h1>
          <p className="text-sm text-slate-400 mt-1">
            Scan QR code to link your academy WhatsApp session for automatic attendance alerts, fee receipts, and parent notifications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchStatus}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#1E293B] hover:bg-[#334155] border border-white/10 text-slate-300 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Check Status</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: QR Code & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: QR Scanner Box (7 cols) */}
        <div className="lg:col-span-7 bg-[#1E293B] border border-white/10 rounded-xl p-6 sm:p-8 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <QrCode className="w-5 h-5 text-orange-400" />
                <h2 className="text-base font-bold text-white">Device Link QR Code</h2>
              </div>
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    CONNECTED
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    {device.status === 'QR_READY' ? 'READY TO SCAN' : 'DISCONNECTED'}
                  </span>
                )}
              </div>
            </div>

            {/* QR Code Container */}
            <div className="my-6 flex flex-col items-center justify-center p-8 bg-[#0F172A] border border-white/10 rounded-2xl">
              {isConnected ? (
                <div className="py-8 text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                    <Check className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-white">WhatsApp Linked & Active</h3>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Your phone is synchronized with the Academy CRM. Outgoing fee reminders, roll call summaries, and announcements are transmitted automatically.
                  </p>
                  {device.phoneNumber && (
                    <div className="mt-2 inline-block px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 font-mono text-sm text-emerald-300 font-bold">
                      {device.phoneNumber}
                    </div>
                  )}
                </div>
              ) : device.qrCode ? (
                <div className="text-center space-y-4">
                  <div className="p-3 bg-white rounded-xl shadow-lg inline-block border-4 border-slate-900">
                    <img
                      src={device.qrCode.startsWith('data:') ? device.qrCode : `data:image/png;base64,${device.qrCode}`}
                      alt="WhatsApp Web QR Code"
                      className="w-56 h-56 object-contain"
                    />
                  </div>
                  <p className="text-xs text-orange-400 font-semibold animate-pulse flex items-center justify-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Scan QR code within 60 seconds
                  </p>
                </div>
              ) : (
                <div className="py-10 text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mx-auto">
                    <QrCode className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">QR Code Offline</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      Click the button below to generate a fresh QR code session for your WhatsApp Web link.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleConnectOrRefresh}
                    disabled={refreshing}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white shadow-md transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    <span>{refreshing ? 'Generating QR Code...' : 'Generate QR Code'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span>Multi-device Web Socket Gateway</span>
            </div>

            <div className="flex items-center gap-2">
              {!isConnected ? (
                <button
                  type="button"
                  onClick={handleConnectOrRefresh}
                  disabled={refreshing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#273549] hover:bg-[#334155] border border-white/10 text-white transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>Regenerate QR Code</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={refreshing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 transition-colors cursor-pointer"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Disconnect Device</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Setup Instructions & Quick Test (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Instructions Card */}
          <div className="bg-[#1E293B] border border-white/10 rounded-xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 pb-3 border-b border-white/10">
              <Smartphone className="w-4 h-4 text-orange-400" />
              How to Link WhatsApp
            </h2>

            <ol className="space-y-3 text-xs text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                  1
                </span>
                <span>Open <strong>WhatsApp</strong> on your mobile smartphone.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                  2
                </span>
                <span>Tap <strong>Menu (⋮)</strong> on Android or <strong>Settings</strong> on iPhone.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                  3
                </span>
                <span>Select <strong>Linked Devices</strong>, then tap <strong>Link a Device</strong>.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                  4
                </span>
                <span>Point your phone camera at the QR code on the left to complete linking.</span>
              </li>
            </ol>
          </div>

          {/* Quick Test Message Dispatcher */}
          <div className="bg-[#1E293B] border border-white/10 rounded-xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 pb-3 border-b border-white/10">
              <Send className="w-4 h-4 text-emerald-400" />
              Send Test Message
            </h2>

            <form onSubmit={handleSendTest} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Recipient Phone Number</label>
                <input
                  type="text"
                  required
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2 rounded-lg bg-[#0F172A] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Message Content</label>
                <textarea
                  rows={2}
                  required
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-[#0F172A] border border-white/10 text-white text-xs focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={sendingTest || !isConnected}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sendingTest ? 'Sending...' : isConnected ? 'Send WhatsApp Message' : 'Connect Device First'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppPage;
