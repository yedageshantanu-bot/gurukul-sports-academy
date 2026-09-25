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
} from 'lucide-react';
import { Announcement } from '../../types/announcement';

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
  const [previewAnnouncement, setPreviewAnnouncement] = useState<Announcement | null>(null);

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

      setSuccessMessage('Announcement created as DRAFT.');
      setIsCreateModalOpen(false);
      setFormData({ title: '', message: '', batchIds: [] });
      fetchAnnouncements();
    } catch (err: any) {
      setError(err.message || 'Failed to create announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendAnnouncement = async (id: string) => {
    try {
      setSubmitting(true);
      setError(null);
      const res = await apiClient<any>(`/announcements/${id}/send`, {
        method: 'POST',
      });

      setSuccessMessage(res?.message || 'Announcement broadcast successfully.');
      setPreviewAnnouncement(null);
      fetchAnnouncements();
    } catch (err: any) {
      setError(err.message || 'Failed to send announcement');
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

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Broadcast Announcements
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Publish targeted notifications and dispatch automated broadcast messages to batches.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="gap-2 shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create Announcement
        </Button>
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

                          {a.status === 'DRAFT' && (
                            <Button
                              size="sm"
                              onClick={() => handleSendAnnouncement(a.id)}
                              disabled={submitting}
                              className="h-8 text-xs gap-1.5"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Broadcast
                            </Button>
                          )}

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
          <Input
            label="Announcement Title *"
            required
            placeholder="e.g. Test Series Schedule Revision"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />

          <div className="w-full space-y-1.5 text-left">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-normal">
              Announcement Message Body *
            </label>
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

      {/* MODAL: Preview & Send Announcement */}
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

              {previewAnnouncement.status === 'DRAFT' && (
                <Button
                  onClick={() => handleSendAnnouncement(previewAnnouncement.id)}
                  disabled={submitting}
                  className="gap-2 shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Broadcasting...' : 'Confirm & Broadcast'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AnnouncementsPage;
