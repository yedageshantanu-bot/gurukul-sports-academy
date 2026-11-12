import React, { useState } from 'react';
import {
  Clock,
  Calendar,
  Send,
  AlertCircle,
  CheckCircle2,
  X,
  History,
  Users,
  RotateCcw,
  Ban,
  MessageSquare,
  Edit2,
} from 'lucide-react';
import { UpcomingScheduledItem } from '../../types/crm';
import { apiClient } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/Button';

interface ScheduleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: UpcomingScheduledItem | null;
  onRefresh: () => void;
}

export const ScheduleDetailModal: React.FC<ScheduleDetailModalProps> = ({
  isOpen,
  onClose,
  slot,
  onRefresh,
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'POSTPONE' | 'RESCHEDULE'>('DETAILS');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Postpone / Reschedule form state
  const [newScheduledTime, setNewScheduledTime] = useState<string>('');
  const [actionReason, setActionReason] = useState<string>('');
  const [editedTitle, setEditedTitle] = useState<string>('');
  const [editedMessage, setEditedMessage] = useState<string>('');

  if (!isOpen || !slot) return null;

  const formatIST = (dateStr?: string | null) => {
    if (!dateStr) return 'Not available';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getRelativeCountdown = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const now = Date.now();
    const target = new Date(dateStr).getTime();
    if (isNaN(target)) return '';

    const diffMs = target - now;
    if (diffMs < 0) {
      const pastSec = Math.floor(Math.abs(diffMs) / 1000);
      if (pastSec < 60) return 'Just now (past due)';
      if (pastSec < 3600) return `${Math.floor(pastSec / 60)}m ago`;
      if (pastSec < 86400) return `${Math.floor(pastSec / 3600)}h ago`;
      return `${Math.floor(pastSec / 86400)}d ago (past due)`;
    }

    const sec = Math.floor(diffMs / 1000);
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);

    if (hours === 0 && minutes < 60) {
      return `In ${minutes}m`;
    }
    if (hours < 24) {
      return `In ${hours}h ${minutes}m`;
    }
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `In ${days}d ${remHours}h`;
  };

  const handleSendNow = async () => {
    if (!window.confirm(`Are you sure you want to dispatch slot for "${slot.title}" to WhatsApp immediately?`)) {
      return;
    }

    try {
      setLoadingAction('SEND_NOW');
      const res: any = await apiClient(`/announcements/slots/${slot.id}/send-now`, {
        method: 'POST',
      }).catch(async (err) => {
        // Fallback to legacy scheduled dispatch if slotId is announcementId
        if (err?.message?.includes('not found') && slot.announcementId) {
          return await apiClient(`/announcements/scheduled/${slot.announcementId}/send-now`, {
            method: 'POST',
          });
        }
        throw err;
      });

      toast.success(res?.message || 'Slot dispatched immediately with safe anti-ban spacing!');
      onRefresh();
      onClose();
    } catch (err: any) {
      console.error('Send Now error:', err);
      toast.error(err.message || 'Failed to dispatch slot.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handlePostpone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScheduledTime) {
      toast.warning('Please select a new date and time for postponement.');
      return;
    }

    try {
      setLoadingAction('POSTPONE');
      const targetIso = new Date(newScheduledTime).toISOString();
      const res: any = await apiClient(`/announcements/slots/${slot.id}/postpone`, {
        method: 'POST',
        body: JSON.stringify({
          scheduledAt: targetIso,
          reason: actionReason.trim() || undefined,
        }),
      });

      toast.success(res?.message || 'Delivery slot postponed successfully!');
      setActiveTab('DETAILS');
      onRefresh();
      onClose();
    } catch (err: any) {
      console.error('Postpone error:', err);
      toast.error(err.message || 'Failed to postpone slot.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScheduledTime) {
      toast.warning('Please select a new date and time.');
      return;
    }

    try {
      setLoadingAction('RESCHEDULE');
      const targetIso = new Date(newScheduledTime).toISOString();
      const res: any = await apiClient(`/announcements/slots/${slot.id}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({
          scheduledAt: targetIso,
          title: editedTitle.trim() || undefined,
          message: editedMessage.trim() || undefined,
          reason: actionReason.trim() || undefined,
        }),
      });

      toast.success(res?.message || 'Delivery slot rescheduled successfully!');
      setActiveTab('DETAILS');
      onRefresh();
      onClose();
    } catch (err: any) {
      console.error('Reschedule error:', err);
      toast.error(err.message || 'Failed to reschedule slot.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCancelSlot = async () => {
    const promptReason = window.prompt(`Cancel scheduled slot for "${slot.title}"? Enter optional reason:`, 'Cancelled by administrator');
    if (promptReason === null) return; // User clicked Cancel

    try {
      setLoadingAction('CANCEL');
      const res: any = await apiClient(`/announcements/slots/${slot.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason: promptReason }),
      });

      toast.success(res?.message || 'Delivery slot cancelled.');
      onRefresh();
      onClose();
    } catch (err: any) {
      console.error('Cancel slot error:', err);
      toast.error(err.message || 'Failed to cancel slot.');
    } finally {
      setLoadingAction(null);
    }
  };

  const startPostponeFlow = () => {
    // Default to 24 hours from current scheduled time or now
    const base = slot.scheduledAt ? new Date(slot.scheduledAt).getTime() : Date.now();
    const next = new Date(base + 24 * 60 * 60 * 1000);
    const localIso = new Date(next.getTime() - next.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setNewScheduledTime(localIso);
    setActionReason('');
    setActiveTab('POSTPONE');
  };

  const startRescheduleFlow = () => {
    const base = slot.scheduledAt ? new Date(slot.scheduledAt).getTime() : Date.now();
    const localIso = new Date(base - new Date(base).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setNewScheduledTime(localIso);
    setEditedTitle(slot.title);
    setEditedMessage(slot.message || slot.messagePreview);
    setActionReason('');
    setActiveTab('RESCHEDULE');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Scheduled
          </span>
        );
      case 'POSTPONED':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> Postponed
          </span>
        );
      case 'SENDING':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border border-yellow-300 animate-pulse flex items-center gap-1">
            <Send className="w-3 h-3" /> Sending Now...
          </span>
        );
      case 'SENT':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Sent
          </span>
        );
      case 'FAILED':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Failed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 flex items-center gap-1">
            <Ban className="w-3 h-3" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                  Slot #{slot.slotNumber || 1}
                </span>
                {getStatusBadge(slot.status)}
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight mt-0.5 line-clamp-1">
                {slot.title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        {slot.status !== 'CANCELLED' && slot.status !== 'SENT' && (
          <div className="flex items-center gap-1 px-5 pt-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <button
              type="button"
              onClick={() => setActiveTab('DETAILS')}
              className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition border-b-2 cursor-pointer ${
                activeTab === 'DETAILS'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              📋 Slot Details
            </button>
            <button
              type="button"
              onClick={startRescheduleFlow}
              className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition border-b-2 flex items-center gap-1 cursor-pointer ${
                activeTab === 'RESCHEDULE'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Edit2 className="w-3 h-3" />
              <span>Edit & Reschedule</span>
            </button>
            <button
              type="button"
              onClick={startPostponeFlow}
              className={`px-3 py-1.5 text-xs font-bold rounded-t-lg transition border-b-2 flex items-center gap-1 cursor-pointer ${
                activeTab === 'POSTPONE'
                  ? 'border-amber-600 text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              <span>Postpone</span>
            </button>
          </div>
        )}

        {/* Body content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {activeTab === 'DETAILS' && (
            <>
              {/* Metadata Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Scheduled Delivery (IST)
                    </p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {formatIST(slot.scheduledAt)}
                    </p>
                    <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                      {getRelativeCountdown(slot.scheduledAt)}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Recipients Count
                    </p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {slot.recipientsCount} recipient(s) targeted
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Safe anti-ban staggered dispatch
                    </span>
                  </div>
                </div>
              </div>

              {/* Postponement History Notice */}
              {slot.originalScheduledAt && (
                <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                  <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Postponed Delivery Slot</p>
                    <p className="mt-0.5">
                      Originally scheduled for: <span className="font-semibold">{formatIST(slot.originalScheduledAt)}</span>
                    </p>
                    <p>
                      New target delivery: <span className="font-semibold">{formatIST(slot.scheduledAt)}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Error Notice if Failed */}
              {slot.errorDetails && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Dispatch Error Details</p>
                    <p className="mt-0.5">{slot.errorDetails}</p>
                  </div>
                </div>
              )}

              {/* Full Message Preview */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Full Message Content:</span>
                </label>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-sans text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap select-text">
                  {slot.message || slot.messagePreview}
                </div>
              </div>

              {/* History & Attempts Audit */}
              {Array.isArray(slot.history) && slot.history.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2">
                    <History className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Lifecycle & Attempt History:</span>
                  </label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {slot.history.map((hist, idx) => (
                      <div
                        key={idx}
                        className="text-[11px] p-2 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {hist.action}
                          </span>
                          <span className="text-slate-600 dark:text-slate-300">
                            {hist.note || (hist.toStatus ? `Status transitioned to ${hist.toStatus}` : '')}
                          </span>
                        </div>
                        <span className="text-slate-400 dark:text-slate-500 shrink-0 text-[10px]">
                          {formatIST(hist.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'POSTPONE' && (
            <form onSubmit={handlePostpone} className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
                <p className="font-bold flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Postpone this specific delivery slot
                </p>
                <p className="text-[11px] mt-0.5 text-amber-800 dark:text-amber-300">
                  The message will move to the Postponed Messages section and remain queued until the new delivery time.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Delivery Date & Time (IST) *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={newScheduledTime}
                  onChange={(e) => setNewScheduledTime(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Postponement Reason (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Academy tournament postponed by organizer, rescheduling notification"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setActiveTab('DETAILS')}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={loadingAction === 'POSTPONE'}>
                  {loadingAction === 'POSTPONE' ? 'Saving...' : 'Confirm Postpone'}
                </Button>
              </div>
            </form>
          )}

          {activeTab === 'RESCHEDULE' && (
            <form onSubmit={handleReschedule} className="space-y-3.5">
              <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200">
                <p className="font-bold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Reschedule slot delivery
                </p>
                <p className="text-[11px] mt-0.5 text-blue-800 dark:text-blue-300">
                  Update the delivery slot time and optionally modify announcement title or message body.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Scheduled Date & Time (IST) *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={newScheduledTime}
                  onChange={(e) => setNewScheduledTime(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Message Body
                </label>
                <textarea
                  rows={3}
                  value={editedMessage}
                  onChange={(e) => setEditedMessage(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setActiveTab('DETAILS')}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={loadingAction === 'RESCHEDULE'}>
                  {loadingAction === 'RESCHEDULE' ? 'Rescheduling...' : 'Save Schedule'}
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions (Only shown in DETAILS tab) */}
        {activeTab === 'DETAILS' && (
          <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              {slot.status !== 'CANCELLED' && slot.status !== 'SENT' && (
                <button
                  type="button"
                  onClick={handleCancelSlot}
                  disabled={Boolean(loadingAction)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Cancel Slot</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {slot.status !== 'SENT' && slot.status !== 'CANCELLED' && (
                <>
                  <button
                    type="button"
                    onClick={startPostponeFlow}
                    disabled={Boolean(loadingAction)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Postpone</span>
                  </button>

                  <button
                    type="button"
                    onClick={startRescheduleFlow}
                    disabled={Boolean(loadingAction)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit & Reschedule</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendNow}
                    disabled={Boolean(loadingAction)}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{loadingAction === 'SEND_NOW' ? 'Dispatching...' : 'Send Now'}</span>
                  </button>
                </>
              )}

              {slot.status === 'SENT' && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Dispatched
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
