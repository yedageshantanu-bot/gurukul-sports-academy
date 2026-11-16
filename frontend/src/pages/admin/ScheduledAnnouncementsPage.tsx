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
  RotateCcw,
  Download,
  Filter,
  CheckSquare,
  Square,
  AlertTriangle,
} from 'lucide-react';
import { apiClient, getApiUrl, getValidAccessToken } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { ScheduleDetailModal } from '../../components/announcements/ScheduleDetailModal';
import { UpcomingScheduledItem } from '../../types/crm';

export interface ScheduledAnnouncementItem {
  id: string;
  announcement_id?: string;
  slot_number?: number;
  title: string;
  message: string;
  author_id?: string;
  created_at: string;
  updated_at: string;
  status: 'SCHEDULED' | 'PENDING' | 'POSTPONED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  scheduled_at: string;
  original_scheduled_at?: string | null;
  postponed_at?: string | null;
  dispatch_timestamp?: string | null;
  batches?: Array<{ id: string; name: string }>;
  recipientCount?: number;
  batch_code?: string;
  slot_tag?: string;
  dispatch_id?: string;
  total_slots?: number;
  batchCode?: string;
  slotTag?: string;
  dispatchId?: string;
  totalSlots?: number;
  history?: any[];
  stats?: {
    total: number;
    pending: number;
    sent: number;
    failed: number;
  };
  metadata?: any;
}

export type HistoryFilterTab = 'UPCOMING' | 'PAST_SENT' | 'MISSED_QR' | 'FAILED' | 'ALL_HISTORY';

export const ScheduledAnnouncementsPage: React.FC = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<ScheduledAnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter tabs: Default to UPCOMING to keep dashboard completely clean of past clutter
  const [filterTab, setFilterTab] = useState<HistoryFilterTab>('UPCOMING');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [whatsappStatus, setWhatsappStatus] = useState<{ status: string; phoneNumber?: string } | null>(null);

  // Selected Slot Detail Modal State
  const [selectedSlotForModal, setSelectedSlotForModal] = useState<UpcomingScheduledItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduledAnnouncementItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editScheduledTime, setEditScheduledTime] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // PDF Export State
  const [exportingPdf, setExportingPdf] = useState(false);

  // Permanent Delete Modal & Bulk Selection State
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'SELECTED' | 'ALL_FILTERED'>('SELECTED');
  const [deletingHistory, setDeletingHistory] = useState(false);

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
      const targetId = editingItem.announcement_id || (editingItem as any).announcementId || (editingItem.id.includes('-slot-') ? editingItem.id.split('-slot-')[0] : editingItem.id);
      await apiClient(`/announcements/scheduled/${targetId}`, {
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
      const targetId = item.announcement_id || (item as any).announcementId || (item.id.includes('-slot-') ? item.id.split('-slot-')[0] : item.id);
      const res: any = await apiClient(`/announcements/scheduled/${targetId}/send-now`, {
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
    if (!window.confirm(`Cancel and remove scheduled broadcast for "${item.title}"? Any unsent queue items will be purged.`)) {
      return;
    }

    try {
      setActionLoadingId(item.id);
      const targetId = item.announcement_id || (item as any).announcementId || (item.id.includes('-slot-') ? item.id.split('-slot-')[0] : item.id);
      const res: any = await apiClient(`/announcements/scheduled/${targetId}?permanent=true`, {
        method: 'DELETE',
      });
      toast.success(res?.message || 'Scheduled broadcast cancelled and removed successfully!');
      await fetchScheduled(true);
    } catch (err: any) {
      console.error('Cancel failed:', err);
      toast.error(err.message || 'Failed to cancel schedule');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Requirement 1: Export Historical & Missed Scheduled Messages to PDF
  const handleExportHistoryPdf = async () => {
    try {
      setExportingPdf(true);
      const token = await getValidAccessToken();
      const url = getApiUrl('/announcements/export-history-pdf');
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        throw new Error(`Failed to generate history PDF (status ${res.status})`);
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `whatsapp-scheduled-history-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Historical & missed messages PDF downloaded successfully!');
    } catch (err: any) {
      console.error('PDF export error:', err);
      toast.error(err.message || 'Failed to export history PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  // Requirement 2: Permanent Delete of Filtered History
  const handleDeleteHistory = async () => {
    try {
      setDeletingHistory(true);
      const payload: any = {
        filter: filterTab === 'PAST_SENT' ? 'SENT' : filterTab === 'MISSED_QR' ? 'MISSED' : filterTab === 'FAILED' ? 'FAILED' : 'ALL_HISTORY',
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };

      if (deleteMode === 'SELECTED') {
        payload.slotIds = selectedSlotIds;
      }

      const res: any = await apiClient('/announcements/scheduled/delete-history', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success(res?.message || `Permanently deleted ${res?.deletedCount || 0} historical records.`);
      setIsDeleteModalOpen(false);
      setSelectedSlotIds([]);
      await fetchScheduled(true);
    } catch (err: any) {
      console.error('Permanent delete failed:', err);
      toast.error(err.message || 'Failed to delete historical logs');
    } finally {
      setDeletingHistory(false);
    }
  };

  // Helper determinations for past/missed messages (strictly past scheduled time)
  const nowMs = Date.now();
  const isSlotPast = (item: ScheduledAnnouncementItem) => {
    const schedMs = new Date(item.scheduled_at).getTime();
    const isDone = item.status === 'SENT' || item.status === 'FAILED';
    const isPastTime = schedMs <= nowMs;
    return isDone || isPastTime;
  };

  const isSlotMissed = (item: ScheduledAnnouncementItem) => {
    const schedMs = new Date(item.scheduled_at).getTime();
    return (item.status as any) === 'MISSED' || ((item.status === 'SCHEDULED' || item.status === 'PENDING') && schedMs <= nowMs);
  };

  // Next upcoming pending message in queue (strictly in future)
  const nextPendingItem = React.useMemo(() => {
    const pendings = items.filter(
      (i) => (i.status === 'SCHEDULED' || i.status === 'PENDING') &&
             new Date(i.scheduled_at || 0).getTime() > nowMs
    );
    pendings.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    return pendings[0] || null;
  }, [items, nowMs]);

  // Counts for filter bar
  const activeItems = items.filter((i) => i.status !== 'CANCELLED');
  const upcomingCount = activeItems.filter((i) => !isSlotPast(i)).length;
  const pastSentCount = items.filter((i) => i.status === 'SENT').length;
  const missedCount = activeItems.filter((i) => isSlotMissed(i)).length;
  const failedCount = items.filter((i) => i.status === 'FAILED').length;
  const allHistoryCount = activeItems.filter((i) => isSlotPast(i)).length;

  // Search & Tab Filter logic
  const q = searchTerm.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (item.status === 'CANCELLED') return false;

    // Search query
    const batchCodeStr = item.batch_code || item.batchCode || '';
    const slotTagStr = item.slot_tag || item.slotTag || '';
    const dispatchIdStr = item.dispatch_id || item.dispatchId || '';
    const matchesSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.message.toLowerCase().includes(q) ||
      batchCodeStr.toLowerCase().includes(q) ||
      slotTagStr.toLowerCase().includes(q) ||
      dispatchIdStr.toLowerCase().includes(q) ||
      (item.batches || []).some((b) => b.name.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    // Date range filter
    if (startDate) {
      const itemDate = new Date(item.scheduled_at).toISOString().slice(0, 10);
      if (itemDate < startDate) return false;
    }
    if (endDate) {
      const itemDate = new Date(item.scheduled_at).toISOString().slice(0, 10);
      if (itemDate > endDate) return false;
    }

    // Tab filter
    if (filterTab === 'UPCOMING') {
      // Default view: ONLY show upcoming/scheduled messages (hide all past/ago clutter)
      return !isSlotPast(item);
    }
    if (filterTab === 'PAST_SENT') {
      return item.status === 'SENT';
    }
    if (filterTab === 'MISSED_QR') {
      return isSlotMissed(item);
    }
    if (filterTab === 'FAILED') {
      return item.status === 'FAILED';
    }
    if (filterTab === 'ALL_HISTORY') {
      return isSlotPast(item);
    }

    return true;
  });

  const toggleSelectSlot = (id: string) => {
    setSelectedSlotIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedSlotIds.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedSlotIds([]);
    } else {
      setSelectedSlotIds(filteredItems.map((i) => i.id));
    }
  };

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
    const diff = target - Date.now();

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

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Requirement 1: Export History PDF Button */}
          <Button
            variant="outline"
            onClick={handleExportHistoryPdf}
            disabled={exportingPdf}
            className="border-indigo-300 dark:border-indigo-700/60 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-xs font-semibold py-2 px-3 shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Export past scheduled messages and missed logs to PDF table"
          >
            <Download className={`w-3.5 h-3.5 ${exportingPdf ? 'animate-bounce' : ''}`} />
            <span>{exportingPdf ? 'Exporting PDF...' : 'Export History PDF'}</span>
          </Button>

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

      {/* WhatsApp Gateway Status Banner */}
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

      {/* Navigation Switcher between All Announcements and Scheduled Messages */}
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
          {upcomingCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-slate-950 font-black">
              {upcomingCount}
            </span>
          )}
        </button>
      </div>

      {/* NEXT UPCOMING MESSAGE IN PENDING QUEUE (Displayed only when on Upcoming tab) */}
      {filterTab === 'UPCOMING' && nextPendingItem && (
        <Card className="p-5 bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/10 border-2 border-amber-500/40 rounded-2xl shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-sm shrink-0">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 tracking-wide">
                    Next in Queue / पुढील मेसेज
                  </span>
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                    Scheduled Time: {formatIST(nextPendingItem.scheduled_at)}
                  </span>
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-black/10 dark:bg-white/10 text-slate-800 dark:text-amber-200">
                    {getRelativeCountdown(nextPendingItem.scheduled_at)}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {nextPendingItem.title}
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2 max-w-2xl">
                  {nextPendingItem.message}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenEdit(nextPendingItem)}
                className="text-xs border-amber-500/40 hover:bg-amber-500/10 text-slate-900 dark:text-white font-bold flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5 text-amber-500" />
                <span>Edit Time</span>
              </Button>

              <Button
                size="sm"
                onClick={() => handleSendNow(nextPendingItem)}
                disabled={actionLoadingId === nextPendingItem.id}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Now</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCancelSchedule(nextPendingItem)}
                disabled={actionLoadingId === nextPendingItem.id}
                className="text-xs border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-bold"
                title="Cancel schedule and cancel queued items"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card
          onClick={() => setFilterTab('UPCOMING')}
          className={`p-3.5 bg-white dark:bg-[#0F172A]/80 border transition-all shadow-sm cursor-pointer ${
            filterTab === 'UPCOMING' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200 dark:border-white/10 hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Upcoming</span>
            <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          </div>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">{upcomingCount}</p>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Default Clean View</span>
        </Card>

        <Card
          onClick={() => setFilterTab('PAST_SENT')}
          className={`p-3.5 bg-white dark:bg-[#0F172A]/80 border transition-all shadow-sm cursor-pointer ${
            filterTab === 'PAST_SENT' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 dark:border-white/10 hover:border-emerald-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Past Sent</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          </div>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{pastSentCount}</p>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Delivered history</span>
        </Card>

        <Card
          onClick={() => setFilterTab('MISSED_QR')}
          className={`p-3.5 bg-white dark:bg-[#0F172A]/80 border transition-all shadow-sm cursor-pointer ${
            filterTab === 'MISSED_QR' ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-slate-200 dark:border-white/10 hover:border-orange-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Missed (QR Off)</span>
            <RotateCcw className="w-4 h-4 text-orange-500 dark:text-orange-400" />
          </div>
          <p className="text-xl font-black text-orange-600 dark:text-orange-400 mt-1">{missedCount}</p>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">WhatsApp was offline</span>
        </Card>

        <Card
          onClick={() => setFilterTab('FAILED')}
          className={`p-3.5 bg-white dark:bg-[#0F172A]/80 border transition-all shadow-sm cursor-pointer ${
            filterTab === 'FAILED' ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200 dark:border-white/10 hover:border-rose-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Failed</span>
            <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400" />
          </div>
          <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">{failedCount}</p>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Delivery errors</span>
        </Card>

        <Card
          onClick={() => setFilterTab('ALL_HISTORY')}
          className={`p-3.5 bg-white dark:bg-[#0F172A]/80 border transition-all shadow-sm cursor-pointer col-span-2 sm:col-span-1 ${
            filterTab === 'ALL_HISTORY' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-white/10 hover:border-indigo-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">All History</span>
            <Calendar className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          </div>
          <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{allHistoryCount}</p>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Entire log trail</span>
        </Card>
      </div>

      {/* Requirement 2: Filter Toggle Bar + Date Range + Search */}
      <div className="bg-white dark:bg-[#0F172A]/90 p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Main Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-black/30 rounded-xl border border-slate-200 dark:border-white/5">
            <button
              type="button"
              onClick={() => {
                setFilterTab('UPCOMING');
                setSelectedSlotIds([]);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'UPCOMING'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Upcoming ({upcomingCount})</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-black/15 text-slate-950 font-black">Default</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFilterTab('PAST_SENT');
                setSelectedSlotIds([]);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'PAST_SENT'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Past Sent ({pastSentCount})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFilterTab('MISSED_QR');
                setSelectedSlotIds([]);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'MISSED_QR'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Missed (QR Off) ({missedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFilterTab('FAILED');
                setSelectedSlotIds([]);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'FAILED'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Failed ({failedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFilterTab('ALL_HISTORY');
                setSelectedSlotIds([]);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'ALL_HISTORY'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>All History ({allHistoryCount})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, batch, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Date Range Sub-Filter Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-white/5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
              <Filter className="w-3 h-3" /> Date Range:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs focus:outline-none"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs focus:outline-none"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-semibold"
              >
                Clear Dates
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Showing <strong className="text-slate-900 dark:text-white font-mono">{filteredItems.length}</strong> record(s)
            {filterTab === 'UPCOMING' && ' (Past completed messages hidden)'}
          </div>
        </div>
      </div>

      {/* Requirement 2: Bulk Selection & Permanent Delete Action Bar (Only visible when viewing past history) */}
      {filterTab !== 'UPCOMING' && filteredItems.length > 0 && (
        <div className="p-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              {selectedSlotIds.length === filteredItems.length && filteredItems.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-amber-500" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>Select All</span>
            </button>
            <span className="text-slate-400">•</span>
            <span className="text-slate-600 dark:text-slate-400 font-medium">
              {selectedSlotIds.length} of {filteredItems.length} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={selectedSlotIds.length === 0}
              onClick={() => {
                setDeleteMode('SELECTED');
                setIsDeleteModalOpen(true);
              }}
              className="border-rose-400/50 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 hover:bg-rose-100 text-xs font-bold py-1.5 px-3 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Delete Selected ({selectedSlotIds.length})</span>
            </Button>

            <Button
              size="sm"
              onClick={() => {
                setDeleteMode('ALL_FILTERED');
                setIsDeleteModalOpen(true);
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-1.5 px-3 flex items-center gap-1.5 shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Filtered History ({filteredItems.length})</span>
            </Button>
          </div>
        </div>
      )}

      {/* Scheduled Items List */}
      {loading ? (
        <div className="space-y-4">
          <SkeletonLoader rows={5} />
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="p-12 text-center bg-white dark:bg-[#0F172A]/60 border-slate-200 dark:border-white/10 rounded-2xl shadow-sm">
          <Clock className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            {filterTab === 'UPCOMING'
              ? 'No Upcoming Scheduled Announcements'
              : `No Records Found in ${filterTab.replace('_', ' ')}`}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
            {filterTab === 'UPCOMING'
              ? 'Past messages are automatically hidden from this dashboard to keep your view clean. Switch to "Past Sent", "Missed (QR Off)", or "All History" to view or audit past dispatches.'
              : 'There are no historical records matching the active filter criteria.'}
          </p>
          <div className="flex justify-center gap-3 mt-4">
            {filterTab !== 'UPCOMING' && (
              <Button
                variant="outline"
                onClick={() => setFilterTab('UPCOMING')}
                className="text-xs font-bold py-2 px-4 border-amber-500/40 text-amber-600"
              >
                Back to Upcoming Messages
              </Button>
            )}
            <Link to="/admin/announcements">
              <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-2 px-4 shadow-sm cursor-pointer">
                <Megaphone className="w-3.5 h-3.5 mr-1.5" />
                Compose Scheduled Announcement
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredItems.map((item) => {
            const isPending = item.status === 'SCHEDULED' || item.status === 'PENDING';
            const isSent = item.status === 'SENT';
            const isMissed = isSlotMissed(item);
            const isFailed = item.status === 'FAILED';
            const countdown = getRelativeCountdown(item.scheduled_at);
            const isActionLoading = actionLoadingId === item.id;
            const isSelected = selectedSlotIds.includes(item.id);

            return (
              <Card
                key={item.id}
                className={`p-5 rounded-2xl border transition-all shadow-sm ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20'
                    : isPending
                    ? 'bg-white dark:bg-[#0F172A]/90 border-amber-500/30 dark:border-amber-500/20 hover:border-amber-500/50'
                    : isSent
                    ? 'bg-white dark:bg-[#0F172A]/80 border-emerald-500/20'
                    : isMissed
                    ? 'bg-white dark:bg-[#0F172A]/80 border-orange-500/30'
                    : isFailed
                    ? 'bg-white dark:bg-[#0F172A]/80 border-rose-500/30'
                    : 'bg-white dark:bg-[#0F172A]/60 border-slate-200 dark:border-white/5 opacity-80'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Left Column: Details */}
                  <div className="space-y-2 flex-1">
                    {/* Header with Checkbox, Status, Batch ID, and Timings */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {/* Checkbox for past history item selection */}
                      {filterTab !== 'UPCOMING' && (
                        <button
                          type="button"
                          onClick={() => toggleSelectSlot(item.id)}
                          className="mr-1 text-slate-400 hover:text-amber-500 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-500" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      )}

                      {/* Status Badges */}
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
                      {isMissed && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30">
                          <RotateCcw className="w-3 h-3 text-orange-500" />
                          MISSED (QR OFF)
                        </span>
                      )}
                      {isFailed && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                          <AlertCircle className="w-3 h-3 text-rose-500" />
                          FAILED
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
                        <strong className="text-slate-900 dark:text-white font-mono">{item.stats?.total || item.recipientCount || 0}</strong>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedSlotForModal({
                            id: item.id,
                            announcementId: item.announcement_id || item.id,
                            slotNumber: item.slot_number || 1,
                            title: item.title,
                            message: item.message,
                            messagePreview: item.message.slice(0, 150),
                            scheduledAt: item.scheduled_at,
                            recipientsCount: item.recipientCount || item.stats?.total || 0,
                            status: item.status,
                            batchCode: item.batch_code || item.batchCode,
                            slotTag: item.slot_tag || item.slotTag,
                            dispatchId: item.dispatch_id || item.dispatchId,
                            totalSlots: item.total_slots || item.totalSlots,
                            originalScheduledAt: item.original_scheduled_at,
                            postponedAt: item.postponed_at,
                            dispatchTimestamp: item.dispatch_timestamp,
                            batches: item.batches,
                            history: item.history,
                          });
                          setIsDetailModalOpen(true);
                        }}
                        className="w-full text-xs font-semibold py-1.5 flex items-center justify-center gap-1.5 cursor-pointer border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                      >
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Slot Details &amp; Lifecycle</span>
                      </Button>

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
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSelectedSlotIds([item.id]);
                              setDeleteMode('SELECTED');
                              setIsDeleteModalOpen(true);
                            }}
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

      {/* CONFIRMATION MODAL FOR PERMANENT DELETION */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Permanent Deletion of History (इतिहास हटवा)"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-800 dark:text-rose-200 space-y-1">
              <strong className="block text-sm">This action is permanent and cannot be undone.</strong>
              <p>
                {deleteMode === 'SELECTED'
                  ? `You are about to permanently delete ${selectedSlotIds.length} selected historical scheduled message record(s) from the Supabase database.`
                  : `You are about to permanently delete all ${filteredItems.length} records matching the current filter "${filterTab.replace('_', ' ')}" from the Supabase database.`}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            Tip: If you need an audit trail, please click <strong>"Export History PDF"</strong> before proceeding with permanent cleanup.
          </p>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              disabled={deletingHistory}
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={deletingHistory}
              onClick={handleDeleteHistory}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 px-4 shadow-sm"
            >
              {deletingHistory ? 'Deleting History...' : 'Yes, Delete Permanently'}
            </Button>
          </div>
        </div>
      </Modal>

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

      {/* Unified Slot Detail Modal */}
      <ScheduleDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        slot={selectedSlotForModal}
        onRefresh={() => fetchScheduled(true)}
      />
    </div>
  );
};

export default ScheduledAnnouncementsPage;
