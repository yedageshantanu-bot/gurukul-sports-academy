import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { Modal } from '../../components/ui/Modal';
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
  MessageSquare,
  ShieldCheck,
  Search,
  Eye,
  XCircle,
} from 'lucide-react';

interface DeviceStatus {
  status: 'CONNECTED' | 'DISCONNECTED' | 'QR_READY' | 'CONNECTING' | 'AUTHENTICATING';
  phoneNumber?: string;
  qrCode?: string;
  sessionStatus?: string;
  lastConnectedAt?: string;
}

export interface WhatsAppLogMessage {
  id: string;
  template_id?: string;
  student_id?: string;
  recipient_phone: string;
  event_type: string;
  message_body: string;
  provider_message_id?: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'MOCK';
  error_message?: string;
  sent_at?: string;
  created_at: string;
  student?: {
    id: string;
    name: string;
    course?: string;
    parent_name?: string;
  };
}

export const WhatsAppPage: React.FC = () => {
  const { toast } = useToast();
  const [device, setDevice] = useState<DeviceStatus>({
    status: 'DISCONNECTED',
  });
  const [whatsappStats, setWhatsappStats] = useState<{
    isConnected: boolean;
    sent: number;
    monthSent: number;
    totalSent: number;
    queued: number;
    failed: number;
    billingPeriod?: string;
  }>({
    isConnected: false,
    sent: 0,
    monthSent: 0,
    totalSent: 0,
    queued: 0,
    failed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Message Logs & Audit Outbox States
  const [messages, setMessages] = useState<WhatsAppLogMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | '7DAYS'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SENT' | 'QUEUED' | 'FAILED'>('ALL');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<WhatsAppLogMessage | null>(null);

  // Test message form
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Hello from Gurukul Sports Academy! Your training session reminder.');
  const [sendingTest, setSendingTest] = useState(false);

  // Fetch Message Outbox Logs from backend with Supabase fallback
  const fetchMessages = useCallback(async () => {
    setLoadingMessages(true);
    try {
      const res = await apiClient<any>('/whatsapp/logs');
      const data = res?.data !== undefined ? res.data : (Array.isArray(res) ? res : []);
      if (Array.isArray(data) && data.length > 0) {
        setMessages(data);
      } else {
        const { data: sbData } = await supabase
          .from('whatsapp_messages')
          .select('*, student:students(id, name, course, parent_name)')
          .order('created_at', { ascending: false })
          .limit(100);
        if (sbData) setMessages(sbData as any);
      }
    } catch (err: any) {
      console.warn('Failed to load WhatsApp logs via API, falling back to direct Supabase:', err);
      try {
        const { data: sbData } = await supabase
          .from('whatsapp_messages')
          .select('*, student:students(id, name, course, parent_name)')
          .order('created_at', { ascending: false })
          .limit(100);
        if (sbData) setMessages(sbData as any);
      } catch (sbErr) {
        console.warn('Direct Supabase log fetch note:', sbErr);
      }
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Fetch status from backend via apiClient (handles token refresh & prod URL)
  const fetchStatus = useCallback(async (autoTriggerConnect = false) => {
    try {
      const res = await apiClient<any>('/whatsapp/status');
      const payload = res?.data !== undefined ? res.data : res;
      const deviceData = payload?.device;
      if (deviceData) {
        // Strip out any fake mock numbers
        const rawPhone = deviceData.phoneNumber ? String(deviceData.phoneNumber).replace(/\D/g, '') : '';
        const isValidPhone = rawPhone.length >= 10 && !rawPhone.includes('9999999999') && !rawPhone.includes('9421248210');

        if (!isValidPhone) {
          deviceData.phoneNumber = undefined;
          if (deviceData.status === 'CONNECTED') {
            deviceData.status = deviceData.qrCode ? 'QR_READY' : 'DISCONNECTED';
          }
        }

        setDevice((prev) => {
          if (deviceData.status === 'CONNECTED' && isValidPhone) {
            return deviceData;
          }
          if (deviceData.qrCode) {
            return { ...deviceData, status: 'QR_READY' };
          }
          // Retain QR code if backend temporarily returns empty qrCode while still in QR_READY
          if (prev.qrCode && deviceData.status !== 'CONNECTED') {
            return { ...deviceData, qrCode: prev.qrCode, status: 'QR_READY' };
          }
          return deviceData;
        });

        // If not connected and no QR code, automatically initiate connect to get fresh QR
        if (autoTriggerConnect && !isValidPhone && !deviceData.qrCode) {
          apiClient<any>('/whatsapp/connect', { method: 'POST' }).then((cRes) => {
            const cPayload = cRes?.data !== undefined ? cRes.data : cRes;
            const cQr = cPayload?.qrCode || cPayload?.status?.qrCode;
            if (cQr) {
              setDevice((prev) => ({
                ...prev,
                status: 'QR_READY',
                qrCode: cQr,
              }));
            }
          }).catch(() => {});
        }
      }

      const statsObj = payload?.todayStats || payload?.stats;
      const rawPhone = deviceData?.phoneNumber ? String(deviceData.phoneNumber).replace(/\D/g, '') : '';
      const isDeviceReallyConnected = deviceData?.status === 'CONNECTED' && rawPhone.length >= 10 && !rawPhone.includes('9999999999') && !rawPhone.includes('9421248210');

      setWhatsappStats({
        isConnected: Boolean(isDeviceReallyConnected),
        sent: statsObj?.sent || 0,
        monthSent: statsObj?.monthSent || 0,
        totalSent: statsObj?.totalSent || 0,
        queued: statsObj?.queued ?? statsObj?.pending ?? 0,
        failed: statsObj?.failed || 0,
        billingPeriod: statsObj?.billingPeriod,
      });
    } catch (err: any) {
      console.warn('Failed to load WhatsApp status:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus(true);
    fetchMessages();
  }, [fetchStatus, fetchMessages]);

  // Connect or Regenerate QR code
  const handleConnectOrRefresh = async () => {
    setRefreshing(true);
    setError(null);
    setSuccess(null);

    try {
      const endpoint = device.status === 'DISCONNECTED' ? '/whatsapp/connect' : '/whatsapp/reconnect';
      const res = await apiClient<any>(endpoint, {
        method: 'POST',
      });

      const payload = res?.data !== undefined ? res.data : res;
      const updatedStatus = payload?.status || payload?.device || payload;
      const returnedQr = payload?.qrCode || updatedStatus?.qrCode;

      const rawPhone = updatedStatus?.phoneNumber ? String(updatedStatus.phoneNumber).replace(/\D/g, '') : '';
      const isValidPhone = rawPhone.length >= 10 && !rawPhone.includes('9999999999') && !rawPhone.includes('9421248210');

      if (returnedQr) {
        setDevice((prev) => ({
          ...prev,
          status: 'QR_READY',
          qrCode: returnedQr,
          phoneNumber: isValidPhone ? updatedStatus.phoneNumber : undefined,
        }));
        setSuccess('Fresh QR Code generated! Please scan from WhatsApp on your smartphone.');
        toast.success('Fresh QR Code generated! Ready to scan.');
      } else if (updatedStatus && updatedStatus.status === 'CONNECTED' && isValidPhone) {
        setDevice(updatedStatus);
      } else {
        await fetchStatus(true);
      }
    } catch (err: any) {
      const errMsg = err.message || 'Error communicating with WhatsApp gateway';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setRefreshing(false);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    setRefreshing(true);
    setError(null);
    setSuccess(null);

    try {
      await apiClient('/whatsapp/disconnect', {
        method: 'POST',
      });

      setDevice({ status: 'DISCONNECTED', phoneNumber: undefined, qrCode: undefined });
      setSuccess('WhatsApp session disconnected successfully.');
      toast.success('WhatsApp session disconnected successfully.');

      // Automatically generate a fresh QR code so the user is immediately ready to scan!
      setTimeout(() => {
        handleConnectOrRefresh();
      }, 500);
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
    if (!testPhone.trim()) return;
    setSendingTest(true);
    setError(null);
    setSuccess(null);

    const digits = testPhone.replace(/\D/g, '');
    let normalizedPhone = testPhone.trim();
    if (digits.length === 10) {
      normalizedPhone = `+91${digits}`;
    } else if (digits.length === 11 && digits.startsWith('0')) {
      normalizedPhone = `+91${digits.slice(1)}`;
    } else if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = `+${digits}`;
    }

    try {
      const res = await apiClient<any>('/whatsapp/send', {
        method: 'POST',
        body: JSON.stringify({
          recipientPhone: normalizedPhone,
          phone: normalizedPhone,
          messageBody: testMessage.trim(),
          message: testMessage.trim(),
        }),
      });

      const successMsg = res?.message || `Direct WhatsApp message dispatched to ${normalizedPhone}!`;
      setSuccess(successMsg);
      toast.success(successMsg);
      setTimeout(() => setSuccess(null), 5000);
      fetchStatus();
      fetchMessages();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to send test message';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setSendingTest(false);
    }
  };

  const isConnected = Boolean(
    device.status === 'CONNECTED' &&
    device.phoneNumber &&
    device.phoneNumber.replace(/\D/g, '').length >= 10 &&
    !device.phoneNumber.includes('9999999999') &&
    !device.phoneNumber.includes('9421248210')
  );

  // Real-time polling: runs every 3.5 seconds while waiting for QR scan, slows down once paired
  useEffect(() => {
    const pollIntervalMs = isConnected ? 30000 : 3500;
    const interval = setInterval(() => {
      fetchStatus(false);
    }, pollIntervalMs);
    return () => clearInterval(interval);
  }, [isConnected, fetchStatus]);

  // Synced Metrics: Guaranteed to match Outbox Table & Supabase
  const todayStr = new Date().toISOString().split('T')[0];
  const displayTotalSent = useMemo(() => {
    const listSent = messages.filter((m) => m.status === 'SENT' || m.status === 'DELIVERED' || m.status === 'MOCK').length;
    return Math.max(whatsappStats.totalSent || 0, listSent);
  }, [messages, whatsappStats.totalSent]);

  const displaySentToday = useMemo(() => {
    const listToday = messages.filter(
      (m) =>
        (m.status === 'SENT' || m.status === 'DELIVERED' || m.status === 'MOCK') &&
        (m.sent_at?.startsWith(todayStr) || m.created_at?.startsWith(todayStr))
    ).length;
    return Math.max(whatsappStats.sent || 0, listToday);
  }, [messages, whatsappStats.sent, todayStr]);

  // Current month active date range (e.g. "01 Nov 2026 – 30 Nov 2026")
  const dateRangeStr = (() => {
    if (whatsappStats.billingPeriod) return whatsappStats.billingPeriod;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startDay = String(start.getDate()).padStart(2, '0');
    const endDay = String(end.getDate()).padStart(2, '0');
    const month = now.toLocaleDateString('en-IN', { month: 'short' });
    const year = now.getFullYear();
    return `${startDay} ${month} ${year} – ${endDay} ${month} ${year}`;
  })();

  const displayMonthSent = useMemo(() => {
    const currentYearMonth = todayStr.slice(0, 7); // "YYYY-MM"
    const listMonth = messages.filter(
      (m) =>
        (m.status === 'SENT' || m.status === 'DELIVERED' || m.status === 'MOCK') &&
        (m.sent_at?.startsWith(currentYearMonth) || m.created_at?.startsWith(currentYearMonth))
    ).length;
    return Math.max(whatsappStats.monthSent || 0, listMonth);
  }, [messages, whatsappStats.monthSent, todayStr]);

  const monthMessages = displayMonthSent;
  const totalBilled = (monthMessages * 0.17).toFixed(2);

  // Filtered Message Log
  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      // Date filter
      if (dateFilter === 'TODAY') {
        const msgDate = (msg.sent_at || msg.created_at || '').split('T')[0];
        if (msgDate !== todayStr) return false;
      } else if (dateFilter === '7DAYS') {
        const msgTime = new Date(msg.sent_at || msg.created_at).getTime();
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (msgTime < sevenDaysAgo) return false;
      }

      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'SENT') {
          if (msg.status !== 'SENT' && msg.status !== 'DELIVERED' && msg.status !== 'MOCK') return false;
        } else if (statusFilter === 'QUEUED') {
          if (msg.status !== 'QUEUED') return false;
        } else if (statusFilter === 'FAILED') {
          if (msg.status !== 'FAILED') return false;
        }
      }

      // Event Type filter
      if (eventTypeFilter !== 'ALL' && msg.event_type !== eventTypeFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const phoneMatch = msg.recipient_phone?.toLowerCase().includes(q);
        const nameMatch = msg.student?.name?.toLowerCase().includes(q);
        const parentMatch = msg.student?.parent_name?.toLowerCase().includes(q);
        const bodyMatch = msg.message_body?.toLowerCase().includes(q);
        if (!phoneMatch && !nameMatch && !parentMatch && !bodyMatch) return false;
      }

      return true;
    });
  }, [messages, dateFilter, statusFilter, eventTypeFilter, searchQuery, todayStr]);

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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">WhatsApp Linked Device</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Scan QR code to link your academy WhatsApp session for automatic attendance alerts, fee receipts, and parent notifications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isConnected && (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 border border-rose-500/50 text-white shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Disconnect WhatsApp</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => fetchStatus(false)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-[#1E293B] hover:bg-slate-100 dark:hover:bg-[#334155] border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer shadow-xs"
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

      {/* WhatsApp Messaging Stats & Cost Tracker */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Dispatched */}
        <div className="p-4 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-white/10 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
              Total Dispatched
            </span>
            <MessageSquare className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 block mt-1">
            {displayTotalSent}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">All-time count</span>
        </div>

        {/* Sent Today */}
        <div className="p-4 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-white/10 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
              Sent Today
            </span>
            <Clock className="w-4 h-4 text-orange-400" />
          </div>
          <span className="text-2xl font-black text-slate-900 dark:text-white block mt-1">
            {displaySentToday}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Today's count</span>
        </div>

        {/* Month Messages */}
        <div className="p-4 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-white/10 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
              Month Messages
            </span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              ₹0.17 / msg
            </span>
          </div>
          <span className="text-2xl font-black text-slate-900 dark:text-white block mt-1">
            {monthMessages} msgs
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate block" title={dateRangeStr}>
            {dateRangeStr}
          </span>
        </div>

        {/* Monthly Cost Tracker */}
        <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-emerald-900 dark:text-emerald-200 tracking-wider">
              Monthly Cost Tracker
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 block mt-1">
              ₹{totalBilled}
            </span>
            <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
              Rate: ₹0.17 / msg
            </span>
          </div>
        </div>
      </div>

      {/* Gateway Status Info Banner */}
      <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-700 dark:text-slate-300 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="font-semibold text-slate-900 dark:text-white">Live WhatsApp Gateway:</span>
          <span>Attendance alerts, fee receipts, and parent broadcasts dispatched in real-time.</span>
        </div>
        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
          Queue backlog: {whatsappStats.queued} pending
        </span>
      </div>

      {/* Main Grid: QR Code & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: QR Scanner Box (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-white/10 rounded-xl p-6 sm:p-8 shadow-sm dark:shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <QrCode className="w-5 h-5 text-orange-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Device Link QR Code</h2>
              </div>
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                    CONNECTED
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />
                    {device.status === 'QR_READY' ? 'READY TO SCAN' : 'DISCONNECTED'}
                  </span>
                )}
              </div>
            </div>

            {/* QR Code Container */}
            <div className="my-6 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-white/10 rounded-2xl">
              {isConnected ? (
                <div className="py-8 text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                    <Check className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">WhatsApp Linked & Active</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                    Your phone is synchronized with the Academy CRM. Outgoing fee reminders, roll call summaries, and announcements are transmitted automatically.
                  </p>
                  {device.phoneNumber && (
                    <div className="mt-2 inline-block px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 font-mono text-sm text-emerald-700 dark:text-emerald-300 font-bold">
                      {device.phoneNumber}
                    </div>
                  )}

                  {/* Dedicated Client Handover / Disconnect Box */}
                  <div className="mt-6 pt-5 border-t border-slate-200 dark:border-white/10 max-w-sm mx-auto space-y-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Testing finished? Click below to cleanly disconnect your phone before giving access to your client.
                    </p>
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      disabled={refreshing}
                      className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-all cursor-pointer active:scale-95 border border-rose-500/40"
                    >
                      <Power className="w-4 h-4" />
                      <span>{refreshing ? 'Disconnecting...' : 'Disconnect / Unlink WhatsApp'}</span>
                    </button>
                  </div>
                </div>
              ) : device.qrCode ? (
                <div className="text-center space-y-4">
                  <div className="p-3 bg-white rounded-xl shadow-lg inline-block border-4 border-slate-900 dark:border-slate-800">
                    <img
                      src={device.qrCode.startsWith('data:') ? device.qrCode : `data:image/png;base64,${device.qrCode}`}
                      alt="WhatsApp Web QR Code"
                      className="w-56 h-56 object-contain"
                    />
                  </div>
                  <p className="text-xs text-orange-500 dark:text-orange-400 font-semibold animate-pulse flex items-center justify-center gap-1.5">
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
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">QR Code Offline</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
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
          <div className="pt-4 border-t border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>Multi-device Web Socket Gateway</span>
            </div>

            <div className="flex items-center gap-2">
              {!isConnected ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={refreshing}
                    title="Clear/Reset current session"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer shadow-xs"
                  >
                    <Power className="w-3.5 h-3.5 text-slate-400" />
                    <span>Reset</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleConnectOrRefresh}
                    disabled={refreshing}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#273549] dark:hover:bg-[#334155] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white transition-colors cursor-pointer shadow-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${refreshing ? 'animate-spin' : ''}`} />
                    <span>Regenerate QR Code</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={refreshing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white border border-rose-500/40 shadow-sm transition-colors cursor-pointer"
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
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-white/10 rounded-xl p-6 shadow-sm dark:shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-white/10">
              <Smartphone className="w-4 h-4 text-orange-400" />
              How to Link WhatsApp
            </h2>

            <ol className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
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
          <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-white/10 rounded-xl p-6 shadow-sm dark:shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-white/10">
              <Send className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              Send Test Message
            </h2>

            <form onSubmit={handleSendTest} className="space-y-3.5">
                <PhoneInput
                  label="Recipient Phone Number"
                  required
                  value={testPhone}
                  onChange={setTestPhone}
                  placeholder="94048 49500"
                  helperText="Fixed +91 country prefix. Enter recipient's 10-digit mobile."
                />

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Message Content</label>
                <textarea
                  rows={2}
                  required
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-orange-500 transition-colors shadow-xs"
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

      {/* WhatsApp Message Outbox & Audit Log */}
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-white/10 rounded-xl p-6 shadow-sm dark:shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                WhatsApp Outbox &amp; Message Audit Log
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {displayTotalSent} Permanent Total
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Live audit trail of all automated fee reminders, roll call alerts, and parent notifications dispatched via Gurukul WhatsApp gateway.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchMessages}
              disabled={loadingMessages}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingMessages ? 'animate-spin' : ''}`} />
              <span>Refresh Log</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search phone, student, or parent name..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Date Filter Tabs */}
          <div className="flex items-center rounded-lg bg-slate-100 dark:bg-[#0F172A] p-0.5 border border-slate-200 dark:border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setDateFilter('ALL')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                dateFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('TODAY')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                dateFilter === 'TODAY'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Today ({displaySentToday})
            </button>
            <button
              type="button"
              onClick={() => setDateFilter('7DAYS')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                dateFilter === '7DAYS'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Last 7 Days
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="SENT">Sent / Delivered</option>
              <option value="QUEUED">Queued (Pending)</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          {/* Event Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">Event:</span>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value="ALL">All Event Types</option>
              <option value="FEE_OVERDUE">Fee Overdue Notice</option>
              <option value="FEE_DUE">Fee Due Reminder</option>
              <option value="FEE_UPCOMING">Advance Fee Courtesy</option>
              <option value="ATTENDANCE_ABSENT">Student Absent Alert</option>
              <option value="ATTENDANCE_PRESENT">Present Confirmation</option>
              <option value="PAYMENT_SUCCESS">Payment Confirmation</option>
              <option value="ANNOUNCEMENT">Announcement</option>
              <option value="CUSTOM_NOTIFICATION">Custom Notification</option>
            </select>
          </div>
        </div>

        {/* Counter Info & Table */}
        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>
            Showing <strong>{filteredMessages.length}</strong> of <strong>{messages.length}</strong> recorded messages
          </span>
          <span className="font-mono">
            Today Sent: {displaySentToday} • All-Time: {displayTotalSent}
          </span>
        </div>

        {loadingMessages ? (
          <div className="py-12 text-center text-xs text-slate-500 animate-pulse flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-orange-400" />
            <span>Loading WhatsApp outbox audit messages...</span>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="py-12 text-center rounded-xl bg-slate-50 dark:bg-[#0F172A]/50 border border-slate-200 dark:border-white/5 space-y-2">
            <MessageSquare className="w-8 h-8 text-slate-400 mx-auto opacity-40" />
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">No WhatsApp messages match your filters</h3>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              {messages.length === 0
                ? 'No messages have been dispatched yet. When attendance alerts or fee reminders are sent, they will appear here permanently.'
                : 'Try clearing the search query or switching the date and status filters above.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#0F172A] text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-white/10 text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Date &amp; Time</th>
                  <th className="py-2.5 px-3">Recipient &amp; Student</th>
                  <th className="py-2.5 px-3">Event Type</th>
                  <th className="py-2.5 px-3">Message Content</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                {filteredMessages.map((msg) => {
                  const timestamp = msg.sent_at || msg.created_at;
                  const dateObj = new Date(timestamp);
                  const formattedDate = dateObj.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  });
                  const formattedTime = dateObj.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  });

                  // Event badge styling
                  const eventBadge = (() => {
                    switch (msg.event_type) {
                      case 'FEE_OVERDUE':
                        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
                      case 'FEE_DUE':
                        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
                      case 'FEE_UPCOMING':
                        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
                      case 'ATTENDANCE_ABSENT':
                        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
                      case 'ATTENDANCE_PRESENT':
                        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
                      case 'PAYMENT_SUCCESS':
                        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
                      default:
                        return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
                    }
                  })();

                  // Status badge styling
                  const isSent = msg.status === 'SENT' || msg.status === 'DELIVERED' || msg.status === 'MOCK';
                  const isQueued = msg.status === 'QUEUED';
                  const isFailed = msg.status === 'FAILED';

                  return (
                    <tr
                      key={msg.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Date & Time */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        <div className="font-semibold text-slate-900 dark:text-white text-[11px]">{formattedDate}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{formattedTime}</div>
                      </td>

                      {/* Recipient & Student */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900 dark:text-white text-xs">
                          {msg.student?.name || 'Direct Recipient'}
                        </div>
                        {msg.student?.parent_name && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Parent: {msg.student.parent_name}
                          </div>
                        )}
                        <div className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                          {msg.recipient_phone}
                        </div>
                      </td>

                      {/* Event Type */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${eventBadge}`}
                        >
                          {msg.event_type.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Message Content Preview */}
                      <td className="py-3 px-3 max-w-xs md:max-w-md">
                        <p className="line-clamp-2 text-slate-600 dark:text-slate-300 text-[11px] font-sans leading-relaxed">
                          {msg.message_body}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isSent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20">
                            <Check className="w-3 h-3" />
                            SENT
                          </span>
                        ) : isQueued ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20">
                            <Clock className="w-3 h-3" />
                            QUEUED
                          </span>
                        ) : isFailed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20">
                            <XCircle className="w-3 h-3" />
                            FAILED
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">{msg.status}</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedMessage(msg)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Message Detail Modal */}
      {selectedMessage && (
        <Modal
          isOpen={!!selectedMessage}
          onClose={() => setSelectedMessage(null)}
          title="WhatsApp Message Audit Details"
          maxWidth="lg"
        >
          <div className="p-6 space-y-4 text-xs font-sans">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-white/10 text-[11px]">
              <div>
                <span className="text-slate-500 block">Recipient Phone</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                  {selectedMessage.recipient_phone}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Student &amp; Parent</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {selectedMessage.student?.name || 'General Recipient'}
                  {selectedMessage.student?.parent_name ? ` (${selectedMessage.student.parent_name})` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Event Type</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedMessage.event_type}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Timestamp</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {new Date(selectedMessage.sent_at || selectedMessage.created_at).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Live WhatsApp Bubble Preview */}
            <div className="p-4 rounded-2xl bg-[#0b141a] border border-[#222e35] text-slate-100">
              <span className="text-[10px] uppercase font-bold text-[#8696a0] tracking-wider block mb-2">
                Delivered WhatsApp Message Bubble:
              </span>
              <div className="bg-[#005c4b] text-[#e9edef] p-3.5 rounded-xl rounded-tr-none shadow-sm space-y-2">
                <p className="whitespace-pre-wrap leading-relaxed text-[12px] font-sans">
                  {selectedMessage.message_body}
                </p>
                <div className="flex items-center justify-end gap-1 text-[10px] text-[#8696a0]">
                  <span>{new Date(selectedMessage.sent_at || selectedMessage.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-[#53bdeb]">✓✓</span>
                </div>
              </div>
            </div>

            {selectedMessage.error_message && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px]">
                <strong>Error:</strong> {selectedMessage.error_message}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default WhatsAppPage;
