import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { apiClient } from '../../lib/api';
import {
  Megaphone,
  Plus,
  Send,
  Eye,
  CheckCircle,
  AlertCircle,
  Layers,
  Trash2,
  Edit2,
  Clock,
  Calendar,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  CheckCheck,
} from 'lucide-react';
import { Announcement } from '../../types/announcement';

const ANNOUNCEMENT_PRESETS = [
  {
    label: '🌧️ हवामान बदल',
    title: 'सराव सत्राबाबत हवामान सूचना',
    message: 'आदरणीय पालक व खेळाडू मित्रांनो, आज खराब हवामानामुळे मैदानी सराव सत्र पुढे ढकलण्यात आले आहे. पर्यायी सराव वेळेबाबत लवकरच कळवण्यात येईल. कृपया सुरक्षित राहा.',
  },
  {
    label: '🏆 स्पर्धा व निवड चाचणी',
    title: 'आगामी स्पर्धा व निवड चाचणी सूचना',
    message: 'सर्व खेळाडू व पालकांसाठी महत्त्वाची सूचना! आगामी आंतर-अकादमी क्रीडा स्पर्धेसाठी खेळाडूंची निवड चाचणी या शनिवार-रविवार नियमित सराव वेळेत घेतली जाईल. सर्व खेळाडूंनी अधिकृत गणवेशात वेळेवर उपस्थित राहावे.',
  },
  {
    label: '⏰ सराव वेळेत बदल',
    title: 'सराव सत्राच्या वेळेत बदल',
    message: 'सर्व पालकांनी व खेळाडूंनी नोंद घ्यावी की, पुढील आठवड्यापासून सराव सत्राच्या वेळेत सुधारणा करण्यात येत आहे. अचूक वेळेसाठी कृपया प्रशिक्षकांशी संपर्क साधावा किंवा सूचना फलक तपासावा.',
  },
  {
    label: '🏖️ सुट्टीची सूचना',
    title: 'अकादमी सुट्टीबाबत सूचना',
    message: 'सर्व पालक व खेळाडूंनी नोंद घ्यावी की, उद्या सुट्टीनिमित्त अकादमीचे सराव सत्र बंद राहील. परवापासून नियमित वेळापत्रकानुसार सराव सत्र सुरू राहील.',
  },
  {
    label: '🎽 किट व साहित्य आठवण',
    title: 'क्रीडा साहित्य व गणवेश सूचना',
    message: 'सर्व खेळाडूंनी सराव सत्रास येताना स्वतःचे संपूर्ण क्रीडा साहित्य, योग्य स्पोर्ट्स शूज आणि पाण्याची बाटली सोबत आणणे आवश्यक आहे.',
  },
];

export const AnnouncementsPage: React.FC = () => {
  const { token } = useAuth();
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [batches, setBatches] = useState<{ id: string; name: string; subject?: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [previewAnnouncement, setPreviewAnnouncement] = useState<Announcement | null>(null);
  const [broadcastTarget, setBroadcastTarget] = useState<Announcement | null>(null);

  // Broadcast & Scheduling Form state
  const [broadcastMode, setBroadcastMode] = useState<'NOW' | 'SCHEDULED'>('NOW');
  const [scheduledDateTime, setScheduledDateTime] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState<{
    title: string;
    message: string;
    batchIds: string[];
  }>({
    title: '',
    message: '',
    batchIds: [],
  });

  const [editFormData, setEditFormData] = useState<{
    title: string;
    message: string;
    batchIds: string[];
  }>({
    title: '',
    message: '',
    batchIds: [],
  });

  const fetchAnnouncements = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient<any>('/announcements');
      setAnnouncements(Array.isArray(data) ? data : data?.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch announcements');
    } finally {
      setLoading(false);
    }
  };

  const fetchBatches = async () => {
    if (!token) return;
    try {
      const data = await apiClient<any>('/batches');
      setBatches(data.batches || data || []);
    } catch (err) {
      console.error('Failed to load batches:', err);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    fetchBatches();
  }, [token]);

  const handleApplyPreset = (preset: { title: string; message: string }, isEdit = false) => {
    if (isEdit) {
      setEditFormData((prev) => ({
        ...prev,
        title: preset.title,
        message: preset.message,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        title: preset.title,
        message: preset.message,
      }));
    }
    toast.success(`Preset "${preset.title}" applied!`);
  };

  const handleToggleBatch = (batchId: string) => {
    setFormData((prev) => {
      const exists = prev.batchIds.includes(batchId);
      if (exists) {
        return { ...prev, batchIds: prev.batchIds.filter((id) => id !== batchId) };
      } else {
        return { ...prev, batchIds: [...prev.batchIds, batchId] };
      }
    });
  };

  const handleSelectAllBatches = () => {
    if (formData.batchIds.length === batches.length) {
      setFormData((prev) => ({ ...prev, batchIds: [] }));
    } else {
      setFormData((prev) => ({ ...prev, batchIds: batches.map((b) => b.id) }));
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.batchIds.length === 0) {
      toast.warning('Please select at least one target batch.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await apiClient('/announcements', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      setSuccessMessage('Announcement created as DRAFT. You can now preview and broadcast it safely.');
      toast.success('Announcement drafted successfully!');
      setIsCreateModalOpen(false);
      setFormData({ title: '', message: '', batchIds: [] });
      fetchAnnouncements();
    } catch (err: any) {
      setError(err.message || 'Failed to create announcement');
    } finally {
      setSubmitting(false);
    }
  };

  // Open the broadcast modal with defaults
  const handleOpenBroadcastModal = (a: Announcement) => {
    setBroadcastTarget(a);
    setBroadcastMode('NOW');
    // Default scheduled time to tomorrow 09:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const localIso = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setScheduledDateTime(localIso);
  };

  const handleConfirmBroadcast = async () => {
    if (!broadcastTarget) return;

    if (broadcastMode === 'SCHEDULED' && !scheduledDateTime) {
      toast.warning('Please select a valid scheduled date and time.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        scheduledTime: broadcastMode === 'SCHEDULED' ? new Date(scheduledDateTime).toISOString() : undefined,
      };

      const res = await apiClient<any>(`/announcements/${broadcastTarget.id}/send`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const msg = res?.data?.message || res?.message || 'Announcement broadcast queued successfully.';
      setSuccessMessage(msg);
      toast.success(msg);
      setBroadcastTarget(null);
      setPreviewAnnouncement(null);
      fetchAnnouncements();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to send announcement';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      setSubmitting(true);
      setError(null);
      await apiClient(`/announcements/${id}`, {
        method: 'DELETE',
      });
      setSuccessMessage('Announcement deleted successfully.');
      toast.success('Announcement deleted successfully.');
      fetchAnnouncements();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to delete announcement';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (a: Announcement) => {
    setEditingAnnouncement(a);
    const selectedIds = (a.batches || []).map((b: any) => b.batch?.id).filter(Boolean);
    setEditFormData({
      title: a.title,
      message: a.message,
      batchIds: selectedIds,
    });
    setIsEditModalOpen(true);
  };

  const handleToggleEditBatch = (batchId: string) => {
    setEditFormData((prev) => {
      const exists = prev.batchIds.includes(batchId);
      if (exists) {
        return { ...prev, batchIds: prev.batchIds.filter((id) => id !== batchId) };
      } else {
        return { ...prev, batchIds: [...prev.batchIds, batchId] };
      }
    });
  };

  const handleSelectAllEditBatches = () => {
    if (editFormData.batchIds.length === batches.length) {
      setEditFormData((prev) => ({ ...prev, batchIds: [] }));
    } else {
      setEditFormData((prev) => ({ ...prev, batchIds: batches.map((b) => b.id) }));
    }
  };

  const handleUpdateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnnouncement) return;
    if (editFormData.batchIds.length === 0) {
      toast.warning('Please select at least one target batch.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await apiClient(`/announcements/${editingAnnouncement.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editFormData),
      });

      setSuccessMessage('Announcement updated successfully.');
      toast.success('Announcement updated successfully.');
      setIsEditModalOpen(false);
      setEditingAnnouncement(null);
      fetchAnnouncements();
    } catch (err: any) {
      const msg = err.message || 'Failed to update announcement';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Safe sending window advice
  const currentHour = new Date().getHours();
  const isNightTime = currentHour >= 21 || currentHour < 7;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              WhatsApp Broadcast Studio
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2 mt-1">
            Broadcast Announcements
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Publish targeted notifications and dispatch automated WhatsApp broadcasts to batches with anti-ban safety.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="gap-2 shadow-sm self-start sm:self-auto bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Create Announcement
        </Button>
      </div>

      {/* Anti-Ban Safety Guide Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-300">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-white">Anti-Ban Staggering Active:</span> Broadcast messages are staggered with natural 16-23s delays and include two-way response prompts so parents reply & save your number.
          </div>
        </div>
        <div className="text-slate-400 text-[11px] shrink-0 font-medium">
          Recommended Hours: <span className="text-emerald-400 font-bold">8:00 AM – 8:00 PM</span>
        </div>
      </div>

      {/* Alerts */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-900 dark:text-emerald-200 text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            {successMessage}
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-xs text-emerald-700 dark:text-emerald-400 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-900 dark:text-rose-200 text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            {error}
          </div>
          <button onClick={() => setError(null)} className="text-xs text-rose-700 dark:text-rose-400 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Announcements List Card */}
      <Card className="border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-card">
        <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Announcement History</h3>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">{announcements.length} notices</span>
        </div>

        {loading ? (
          <SkeletonLoader variant="table" rows={4} />
        ) : announcements.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No announcements published yet"
            description="Draft and dispatch your first broadcast notice to students and guardians."
            actionLabel="Create Announcement"
            onAction={() => setIsCreateModalOpen(true)}
            accentColor="indigo"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Created</th>
                  <th className="px-5 py-3.5">Title & Excerpt</th>
                  <th className="px-5 py-3.5">Target Batches</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {announcements.map((a) => {
                  const targetBatches = (a.batches || []).map((b) => b.batch?.name).filter(Boolean);
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">
                        {new Date(a.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100 leading-tight">{a.title}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 max-w-md mt-1">{a.message}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {targetBatches.map((name, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60"
                            >
                              <Layers className="w-2.5 h-2.5 text-purple-500" />
                              {name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPreviewAnnouncement(a)}
                            className="h-8 text-xs gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Preview
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEdit(a)}
                            className="h-8 text-xs gap-1.5 border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                            title="Edit Announcement"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => handleOpenBroadcastModal(a)}
                            disabled={submitting}
                            className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            title="Broadcast / Schedule via WhatsApp"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Broadcast
                          </Button>

                          <button
                            type="button"
                            onClick={() => handleDeleteAnnouncement(a.id)}
                            disabled={submitting}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title="Delete Announcement"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* MODAL: Create Announcement */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Draft New Broadcast Announcement"
        maxWidth="xl"
      >
        <form onSubmit={handleCreateAnnouncement} className="space-y-4">
          {/* Quick Presets */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Quick Presets:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ANNOUNCEMENT_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(p, false)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Announcement Title *"
            required
            placeholder="e.g. Weather Delay: Session Rescheduled"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />

          <div className="w-full space-y-1.5 text-left">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-normal">
                Announcement Message Body *
              </label>
              <span className="text-[11px] text-slate-400">
                {formData.message.length} characters
              </span>
            </div>
            <textarea
              required
              rows={4}
              placeholder="Write announcement body here. Will be dispatched to student & guardian contacts."
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="w-full text-sm rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-sans placeholder:text-slate-400 dark:placeholder:text-slate-400"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Select Target Batches *</label>
              <button
                type="button"
                onClick={handleSelectAllBatches}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-semibold"
              >
                {formData.batchIds.length === batches.length ? 'Deselect All' : 'Select All Batches'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 border border-slate-200/90 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
              {batches.map((b) => (
                <label
                  key={b.id}
                  className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 dark:hover:bg-slate-700/80 transition-all shadow-sm"
                >
                  <input
                    type="checkbox"
                    checked={formData.batchIds.includes(b.id)}
                    onChange={() => handleToggleBatch(b.id)}
                    className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="truncate">{b.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save as Draft'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Edit Announcement */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Broadcast Announcement"
        maxWidth="xl"
      >
        <form onSubmit={handleUpdateAnnouncement} className="space-y-4">
          <Input
            label="Announcement Title *"
            required
            placeholder="e.g. Test Series Schedule Revision"
            value={editFormData.title}
            onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
          />

          <div className="w-full space-y-1.5 text-left">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-normal">
              Announcement Message Body *
            </label>
            <textarea
              required
              rows={4}
              placeholder="Write announcement body here. Will be dispatched to student & guardian contacts."
              value={editFormData.message}
              onChange={(e) => setEditFormData({ ...editFormData, message: e.target.value })}
              className="w-full text-sm rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-sans placeholder:text-slate-400 dark:placeholder:text-slate-400"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Select Target Batches *</label>
              <button
                type="button"
                onClick={handleSelectAllEditBatches}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-semibold"
              >
                {editFormData.batchIds.length === batches.length ? 'Deselect All' : 'Select All Batches'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 border border-slate-200/90 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
              {batches.map((b) => (
                <label
                  key={b.id}
                  className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 dark:hover:bg-slate-700/80 transition-all shadow-sm"
                >
                  <input
                    type="checkbox"
                    checked={editFormData.batchIds.includes(b.id)}
                    onChange={() => handleToggleEditBatch(b.id)}
                    className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="truncate">{b.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Updating...' : 'Update Announcement'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: BROADCAST & SCHEDULE (Advanced Safe Dispatch) */}
      <Modal
        isOpen={Boolean(broadcastTarget)}
        onClose={() => setBroadcastTarget(null)}
        title="Broadcast Announcement via WhatsApp"
        maxWidth="xl"
      >
        {broadcastTarget && (
          <div className="space-y-5">
            {/* Header info */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{broadcastTarget.title}</h4>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Targeting {(broadcastTarget.batches || []).length} batch(es)
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Anti-Ban Guard Active
              </span>
            </div>

            {/* Delivery Timing Options */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                When should this broadcast be dispatched?
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setBroadcastMode('NOW')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    broadcastMode === 'NOW'
                      ? 'border-indigo-600 bg-indigo-500/10 text-white'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <Send className={`w-4 h-4 mt-0.5 shrink-0 ${broadcastMode === 'NOW' ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <div>
                    <div className={`text-xs font-bold ${broadcastMode === 'NOW' ? 'text-indigo-300' : 'text-slate-300'}`}>
                      ⚡ Send Now (Instant Queue)
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      Immediately enqueues with 16-22s anti-ban spacing between each parent.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBroadcastMode('SCHEDULED')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    broadcastMode === 'SCHEDULED'
                      ? 'border-indigo-600 bg-indigo-500/10 text-white'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <Clock className={`w-4 h-4 mt-0.5 shrink-0 ${broadcastMode === 'SCHEDULED' ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <div>
                    <div className={`text-xs font-bold ${broadcastMode === 'SCHEDULED' ? 'text-indigo-300' : 'text-slate-300'}`}>
                      ⏰ Schedule for Later
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      Set a specific date & time (e.g. tomorrow at 9:00 AM) to avoid night alerts.
                    </div>
                  </div>
                </button>
              </div>

              {/* Scheduled DateTime Picker */}
              {broadcastMode === 'SCHEDULED' && (
                <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Select Dispatch Date & Time (IST):</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledDateTime}
                    onChange={(e) => setScheduledDateTime(e.target.value)}
                    className="w-full text-sm rounded-lg border border-slate-700 bg-slate-800 text-white p-2.5 focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400">
                    * The system will automatically wake up and begin staggered dispatches at this exact time.
                  </p>
                </div>
              )}

              {/* Night time warning if sending now late */}
              {broadcastMode === 'NOW' && isNightTime && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Notice: It is currently late evening. Sending broadcasts at night may disturb parents. You may choose <b>Schedule for Later</b> (e.g. tomorrow morning) for higher engagement.
                  </span>
                </div>
              )}
            </div>

            {/* Real WhatsApp Chat Bubble Preview */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>WhatsApp Recipient View:</span>
              </div>
              <div className="bg-[#0b141a] rounded-xl p-4 border border-white/5">
                <div className="max-w-sm bg-[#005c4b] text-white rounded-lg rounded-tl-none p-3 shadow-md text-xs space-y-1.5 ml-1">
                  <div className="font-bold text-emerald-200">📢 *{broadcastTarget.title}*</div>
                  <div className="whitespace-pre-wrap text-slate-100 leading-relaxed">{broadcastTarget.message}</div>
                  <div className="text-[11px] text-slate-300 pt-1">- *Gurukul Sports Academy*</div>
                  <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-200/70 pt-0.5">
                    <span>Just now</span>
                    <CheckCheck className="w-3 h-3 text-cyan-300" />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-700">
              <Button variant="outline" onClick={() => setBroadcastTarget(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmBroadcast}
                disabled={submitting}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Enqueuing Broadcast...' : broadcastMode === 'SCHEDULED' ? 'Schedule Broadcast' : 'Confirm & Send Now'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: Preview Announcement */}
      <Modal
        isOpen={Boolean(previewAnnouncement)}
        onClose={() => setPreviewAnnouncement(null)}
        title="Broadcast Notice Preview"
        maxWidth="lg"
      >
        {previewAnnouncement && (
          <div className="space-y-4">
            <div className="bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-5 space-y-3.5">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Notice Title</span>
                  <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-base mt-0.5">{previewAnnouncement.title}</h4>
                </div>
                <StatusBadge status={previewAnnouncement.status} />
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Message Content</span>
                <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap mt-1 leading-relaxed shadow-sm">
                  {previewAnnouncement.message}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Target Recipients</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(previewAnnouncement.batches || []).map((b, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60"
                    >
                      {b.batch?.name}
                    </span>
                  ))}
                </div>
              </div>

              {previewAnnouncement.sent_at && (
                <div className="text-xs text-slate-400 dark:text-slate-500 pt-3 border-t border-slate-200/80 dark:border-slate-800">
                  Broadcast dispatched: {new Date(previewAnnouncement.sent_at).toLocaleString('en-IN')}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button variant="outline" onClick={() => setPreviewAnnouncement(null)}>
                Close
              </Button>

              <Button
                onClick={() => {
                  const target = previewAnnouncement;
                  setPreviewAnnouncement(null);
                  handleOpenBroadcastModal(target);
                }}
                disabled={submitting}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Send className="w-4 h-4" />
                Configure & Broadcast
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AnnouncementsPage;
