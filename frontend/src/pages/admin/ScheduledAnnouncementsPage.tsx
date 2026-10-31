import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  Calendar,
  Send,
  Edit2,
  Trash2,
  Megaphone,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  ArrowLeft,
} from 'lucide-react';
import { apiClient } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';

interface ScheduledAnnouncementItem {
  id: string;
  title: string;
  message: string;
  author_id?: string;
  created_at: string;
  updated_at: string;
  status: 'SCHEDULED' | 'SENT' | 'CANCELLED';
  scheduled_at: string;
  batches?: Array<{ id: string; name: string }>;
  stats?: {
    total: number;
    pending: number;
    sent: number;
    failed: number;
  };
  metadata?: any;
}

export const ScheduledAnnouncementsPage: React.FC = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<ScheduledAnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'SENT' | 'CANCELLED'>('ALL');
  const [whatsappStatus, setWhatsappStatus] = useState<{ status: string; phoneNumber?: string } | null>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduledAnnouncementItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editScheduledTime, setEditScheduledTime] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Action loading states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchScheduled = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      const res: any = await apiClient('/announcements/scheduled');
      const data = Array.isArray(res) ? res : res?.data || [];
      setItems(data);
    } catch (err: any) {
      console.error('Failed to load scheduled announcements:', err);
      toast.error(err.message || 'Failed to load scheduled messages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchWhatsAppStatus = async () => {
    try {
      const res: any = await apiClient('/whatsapp/status');
      const payload = res?.data !== undefined ? res.data : res;
      if (payload?.device) {
        setWhatsappStatus(payload.device);
      }
    } catch (e) {
      // Ignore
    }
  };

  useEffect(() => {
    fetchScheduled();
    fetchWhatsAppStatus();
  }, []);

  const handleOpenEdit = (item: ScheduledAnnouncementItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditMessage(item.message);
    // Format to YYYY-MM-DDTHH:mm
    if (item.scheduled_at) {
      const dt = new Date(item.scheduled_at);
      const tzOffset = dt.getTimezoneOffset() * 60000;
      const localISOTime = new Date(dt.getTime() - tzOffset).toISOString().slice(0, 16);
      setEditScheduledTime(localISOTime);
    } else {
      setEditScheduledTime(new Date(Date.now() + 3600000).toISOString().slice(0, 16));
    }
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editTitle.trim() || !editMessage.trim() || !editScheduledTime) {
      toast.error('Title, message, and scheduled time are required.');
      return;
    }

    try {
      setSavingEdit(true);
      await apiClient(`/announcements/scheduled/${editingItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editTitle.trim(),
          message: editMessage.trim(),
          scheduledTime: new Date(editScheduledTime).toISOString(),
        }),
      });

      toast.success('Scheduled broadcast updated successfully!');
      setIsEditModalOpen(false);
      setEditingItem(null);
      await fetchScheduled(true);
    } catch (err: any) {
      console.error('Update failed:', err);
      toast.error(err.message || 'Failed to update schedule');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSendNow = async (item: ScheduledAnnouncementItem) => {
    if (!window.confirm(`Are you sure you want to dispatch "${item.title}" to WhatsApp queue immediately?`)) {
      return;
    }

    try {
      setActionLoadingId(item.id);
      const res: any = await apiClient(`/announcements/scheduled/${item.id}/send-now`, {
        method: 'POST',
      });
      toast.success(res?.message || 'Message queued for immediate dispatch!');
      await fetchScheduled(true);
    } catch (err: any) {
      console.error('Send now failed:', err);
      toast.error(err.message || 'Failed to dispatch message');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelSchedule = async (item: ScheduledAnnouncementItem) => {
    if (!window.confirm(`Cancel scheduled broadcast for "${item.title}"? Any unsent queue items will be purged.`)) {
      return;
    }

    try {
      setActionLoadingId(item.id);
      const res: any = await apiClient(`/announcements/scheduled/${item.id}`, {
        method: 'DELETE',
      });
      toast.success(res?.message || 'Scheduled broadcast cancelled!');
      await fetchScheduled(true);
    } catch (err: any) {
      console.error('Cancel failed:', err);
      toast.error(err.message || 'Failed to cancel schedule');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeletePermanent = async (item: ScheduledAnnouncementItem) => {
    if (!window.confirm(`Permanently delete announcement "${item.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      setActionLoadingId(item.id);
      const res: any = await apiClient(`/announcements/scheduled/${item.id}?permanent=true`, {
        method: 'DELETE',
      });
      toast.success(res?.message || 'Announcement deleted permanently!');
      await fetchScheduled(true);
    } catch (err: any) {
      console.error('Delete failed:', err);
      toast.error(err.message || 'Failed to delete announcement');
    } finally {
      setActionLoadingId(null);
    }
  };

  // KPI Computations
  const totalCount = items.length;
  const pendingCount = items.filter((i) => i.status === 'SCHEDULED').length;
  const sentCount = items.filter((i) => i.status === 'SENT').length;
  const cancelledCount = items.filter((i) => i.status === 'CANCELLED').length;

  // Search & Filter
  const q = searchTerm.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.message.toLowerCase().includes(q) ||
      (item.batches || []).some((b) => b.name.toLowerCase().includes(q));

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'PENDING' && item.status === 'SCHEDULED') ||
      (statusFilter === 'SENT' && item.status === 'SENT') ||
      (statusFilter === 'CANCELLED' && item.status === 'CANCELLED');

    return matchesSearch && matchesStatus;
  });

  const formatIST = (dateStr: string) => {
    if (!dateStr) return 'TBA';
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getRelativeCountdown = (dateStr: string) => {
    if (!dateStr) return '';
    const target = new Date(dateStr).getTime();
    const now = Date.now();
    const diff = target - now;

    if (diff < 0) {
      const pastMins = Math.floor(-diff / 60000);
      if (pastMins < 60) return `${pastMins}m ago`;
      const pastHours = Math.floor(pastMins / 60);
      if (pastHours < 24) return `${pastHours}h ago`;
      return `${Math.floor(pastHours / 24)}d ago`;
    }

    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `In ${mins} min${mins === 1 ? '' : 's'}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `In ${hours} hr${hours === 1 ? '' : 's'}`;
    const days = Math.floor(hours / 24);
    return `In ${days} day${days === 1 ? '' : 's'}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 font-medium">
            <Link to="/admin/announcements" className="hover:text-amber-500 flex items-center gap-1 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span>Announcements</span>
            </Link>
            <span>•</span>
            <span className="text-amber-600 dark:text-amber-400 font-semibold">Scheduled Broadcasts</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 flex items-center gap-2.5">
            <Clock className="w-7 h-7 text-amber-500 dark:text-amber-400" />
            Scheduled Announcements &amp; Broadcasts
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Track, edit, cancel, and immediately dispatch future-dated WhatsApp broadcasts across batches and academies.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => fetchScheduled(true)}
            disabled={refreshing}
            className="border-slate-300 dark:border-white/10 text-xs font-semibold py-2 px-3 shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-500' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Link to="/admin/announcements">
            <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold text-xs py-2 px-3 shadow-md shadow-orange-500/20 cursor-pointer flex items-center gap-1.5">
              <Megaphone className="w-3.5 h-3.5" />
              <span>Compose New Announcement</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* WhatsApp Status Alert Banner */}
      {whatsappStatus && whatsappStatus.status !== 'CONNECTED' && (
        <div className="p-3.5 px-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-200">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">WhatsApp Gateway Pending Pairing: </span>
              <span>
                Status is <strong className="uppercase">{whatsappStatus.status}</strong>. Scheduled messages will automatically dispatch once WhatsApp is paired.
              </span>
            </div>
          </div>
          <Link
            to="/admin/whatsapp"
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shrink-0 transition-colors shadow-xs"
          >
            Pair WhatsApp (Scan QR) &rarr;
          </Link>
        </div>
      )}
      {whatsappStatus && whatsappStatus.status === 'CONNECTED' && (
        <div className="p-2.5 px-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>
              <strong>WhatsApp Gateway Active:</strong> Paired with {whatsappStatus.phoneNumber || 'Academy Device'}. Scheduler polling every 5s.
            </span>
          </div>
          <Link to="/admin/whatsapp" className="text-emerald-700 dark:text-emerald-400 underline font-semibold hover:text-emerald-600">
            View Gateway
          </Link>
        </div>
      )}

      {/* Primary View Switcher Banner */}
      <div className="p-1 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/5 rounded-xl flex items-center gap-1 max-w-md">
        <Link
          to="/admin/announcements"
          className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center gap-2 transition-colors"
        >
          <Megaphone className="w-3.5 h-3.5" />
          <span>All Announcements</span>
        </Link>
        <button
          type="button"
          className="flex-1 py-2 px-3 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 shadow-sm flex items-center justify-center gap-2 cursor-default"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Scheduled Messages</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-slate-950 font-black">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white dark:bg-[#0F172A]/80 border-slate-200 dark:border-white/10 hover:border-amber-500/30 transition-all shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Scheduled</span>
            <Calendar className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">{totalCount}</p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Scheduled on system</span>
        </Card>

        <Card className="p-4 bg-white dark:bg-[#0F172A]/80 border-slate-200 dark:border-white/10 hover:border-cyan-500/30 transition-all shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending Dispatch</span>
            <Clock className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
          </div>
          <p className="text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-2">{pendingCount}</p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Awaiting scheduled trigger</span>
        </Card>

        <Card className="p-4 bg-white dark:bg-[#0F172A]/80 border-slate-200 dark:border-white/10 hover:border-emerald-500/30 transition-all shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Successfully Dispatched</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{sentCount}</p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Delivered to WhatsApp queue</span>
        </Card>

        <Card className="p-4 bg-white dark:bg-[#0F172A]/80 border-slate-200 dark:border-white/10 hover:border-rose-500/30 transition-all shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cancelled / Purged</span>
            <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400" />
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">{cancelledCount}</p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Cancelled by academy admin</span>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#0F172A]/70 p-3 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { key: 'ALL', label: `All (${totalCount})` },
            { key: 'PENDING', label: `Pending (${pendingCount})` },
            { key: 'SENT', label: `Sent (${sentCount})` },
            { key: 'CANCELLED', label: `Cancelled (${cancelledCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === tab.key
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search scheduled messages, batches..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Scheduled Items List */}
      {loading ? (
        <div className="space-y-4">
          <SkeletonLoader rows={5} />
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="p-12 text-center bg-white dark:bg-[#0F172A]/60 border-slate-200 dark:border-white/10 rounded-2xl shadow-sm">
          <Clock className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No scheduled announcements found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
            {searchTerm || statusFilter !== 'ALL'
              ? 'Try modifying your search query or status filter to see other messages.'
              : 'You have no scheduled messages waiting in the queue. Create a new announcement and set a future date & time to schedule it.'}
          </p>
          <Link to="/admin/announcements" className="inline-block mt-4">
            <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-2 px-4 shadow-sm cursor-pointer">
              <Megaphone className="w-3.5 h-3.5 mr-1.5" />
              Compose Scheduled Announcement
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredItems.map((item) => {
            const isPending = item.status === 'SCHEDULED';
            const isSent = item.status === 'SENT';
            const isCancelled = item.status === 'CANCELLED';
            const countdown = getRelativeCountdown(item.scheduled_at);
            const isActionLoading = actionLoadingId === item.id;

            return (
              <Card
                key={item.id}
                className={`p-5 rounded-2xl border transition-all shadow-sm ${
                  isPending
                    ? 'bg-white dark:bg-[#0F172A]/90 border-amber-500/30 dark:border-amber-500/20 hover:border-amber-500/50'
                    : isSent
                    ? 'bg-white dark:bg-[#0F172A]/80 border-emerald-500/20'
                    : 'bg-white dark:bg-[#0F172A]/60 border-slate-200 dark:border-white/5 opacity-80'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Left Column: Details */}
                  <div className="space-y-2 flex-1">
                    {/* Status & Time Header */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {isPending && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                          <Clock className="w-3 h-3 text-amber-500 animate-spin" style={{ animationDuration: '6s' }} />
                          SCHEDULED
                        </span>
                      )}
                      {isSent && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          DISPATCHED
                        </span>
                      )}
                      {isCancelled && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                          <AlertCircle className="w-3 h-3 text-rose-500" />
                          CANCELLED
                        </span>
                      )}

                      {/* Scheduled IST Time */}
                      <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 bg-slate-100 dark:bg-black/30 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-white/5">
                        <Calendar className="w-3 h-3 text-amber-500" />
                        <span>Scheduled: {formatIST(item.scheduled_at)}</span>
                      </span>

                      {/* Relative countdown */}
                      {countdown && (
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          isPending ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' : 'text-slate-400'
                        }`}>
                          {countdown}
                        </span>
                      )}
                    </div>

                    {/* Announcement Title */}
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{item.title}</span>
                    </h3>

                    {/* Message Preview */}
                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-sans bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-200 dark:border-white/5 max-h-36 overflow-y-auto">
                      {item.message}
                    </p>

                    {/* Target Batches & Audience */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Users className="w-3 h-3 text-slate-400" />
                        Target:
                      </span>
                      {item.batches && item.batches.length > 0 ? (
                        item.batches.map((b) => (
                          <span
                            key={b.id}
                            className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40"
                          >
                            {b.name}
                          </span>
                        ))
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5">
                          Academy All-Students Broadcast
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Stats & Action Buttons */}
                  <div className="lg:w-64 flex flex-col justify-between gap-4 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-white/5 pt-3 lg:pt-0 lg:pl-5">
                    {/* Queue Statistics Card */}
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-white/5 text-xs space-y-1.5">
                      <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-300">
                        <span>Total Recipients:</span>
                        <strong className="text-slate-900 dark:text-white font-mono">{item.stats?.total || 0}</strong>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-amber-600 dark:text-amber-400 font-medium">Pending in Queue:</span>
                        <strong className="text-amber-600 dark:text-amber-400 font-mono">{item.stats?.pending || 0}</strong>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Delivered:</span>
                        <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{item.stats?.sent || 0}</strong>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      {isPending && (
                        <>
                          <Button
                            onClick={() => handleSendNow(item)}
                            disabled={isActionLoading}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                            title="Dispatch scheduled announcement to WhatsApp queue right now"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{isActionLoading ? 'Dispatching...' : 'Send Now (आत्ता पाठवा)'}</span>
                          </Button>

                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="outline"
                              onClick={() => handleOpenEdit(item)}
                              disabled={isActionLoading}
                              className="border-amber-400 dark:border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-xs font-semibold py-1.5 px-2 cursor-pointer flex items-center justify-center gap-1"
                            >
                              <Edit2 className="w-3 h-3 text-amber-500" />
                              <span>Edit</span>
                            </Button>

                            <Button
                              variant="outline"
                              onClick={() => handleCancelSchedule(item)}
                              disabled={isActionLoading}
                              className="border-rose-300 dark:border-rose-600/40 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-xs font-semibold py-1.5 px-2 cursor-pointer flex items-center justify-center gap-1"
                            >
                              <Trash2 className="w-3 h-3 text-rose-500" />
                              <span>Cancel</span>
                            </Button>
                          </div>
                        </>
                      )}

                      {!isPending && (
                        <div className="space-y-1.5">
                          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/40 text-center text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            {isSent ? 'Dispatched to recipients' : 'Broadcast cancelled'}
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => handleDeletePermanent(item)}
                            disabled={isActionLoading}
                            className="w-full border-rose-300 dark:border-rose-600/40 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-xs font-semibold py-1.5 px-2 cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Trash2 className="w-3 h-3 text-rose-500" />
                            <span>Delete Permanently</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* EDIT SCHEDULE MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingItem(null);
        }}
        title="Edit Scheduled Announcement (वेळ व संदेश बदला)"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Announcement Title *
            </label>
            <input
              type="text"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              WhatsApp Broadcast Message *
            </label>
            <textarea
              rows={5}
              required
              value={editMessage}
              onChange={(e) => setEditMessage(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-sans leading-relaxed"
            />
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-500/20 space-y-1.5">
            <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>New Scheduled Dispatch Time (IST) *</span>
            </label>
            <input
              type="datetime-local"
              required
              value={editScheduledTime}
              onChange={(e) => setEditScheduledTime(e.target.value)}
              className="w-full px-3 py-2 border border-amber-300 dark:border-amber-500/40 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
            />
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              Updating the scheduled time immediately reschedules all pending queued WhatsApp messages.
            </p>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingItem(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={savingEdit}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 px-4 shadow-sm"
            >
              {savingEdit ? 'Updating Schedule...' : 'Save & Reschedule'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
