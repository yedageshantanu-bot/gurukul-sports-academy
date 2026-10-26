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
  Trophy,
  BookmarkPlus,
  X,
  Check,
} from 'lucide-react';
import { Announcement } from '../../types/announcement';

interface AnnouncementPreset {
  id: string;
  label: string;
  title: string;
  message: string;
  isCustom?: boolean;
}

const DEFAULT_PRESETS: AnnouncementPreset[] = [
  {
    id: 'def-1',
    label: '🌧️ Weather Delay',
    title: 'Training Session Weather Update',
    message: 'Dear Students & Parents, due to current weather conditions, today\'s outdoor training session has been rescheduled. We will inform you shortly about the alternate session slot. Stay safe!',
  },
  {
    id: 'def-2',
    label: '🏆 Tournament Notice',
    title: 'Upcoming Tournament & Match Selections',
    message: 'Exciting news! Selection trials for the upcoming Inter-Academy Tournament will take place this weekend during regular batch hours. Please ensure 100% attendance in official academy uniform.',
  },
  {
    id: 'def-3',
    label: '🥋 Belt Exam Alert',
    title: 'Upcoming Belt Grading Examination',
    message: 'Dear Students & Parents, the quarterly Belt Grading Examination has been scheduled. Please ensure all syllabus katas/techniques are practiced and examination dues are settled at the desk.',
  },
  {
    id: 'def-4',
    label: '⏰ Timing Revision',
    title: 'Batch Schedule & Timing Revision',
    message: 'Please note that starting next week, batch practice timings have been updated for optimized coaching sessions. Kindly consult your coach or check the academy board for slot details.',
  },
  {
    id: 'def-5',
    label: '🏖️ Academy Holiday',
    title: 'Academy Closed Notice',
    message: 'Dear Parents & Students, the academy will remain closed tomorrow on account of the public holiday. Regular training sessions will resume from the following day as per schedule.',
  },
  {
    id: 'def-6',
    label: '🎽 Kit & Gear Reminder',
    title: 'Sports Kit & Hydration Reminder',
    message: 'Friendly reminder to all students to carry their complete training equipment, proper sports footwear, and personal water bottles to every training session.',
  },
];

export const AnnouncementsPage: React.FC = () => {
  const { token } = useAuth();
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [batches, setBatches] = useState<{ id: string; name: string; subject?: string }[]>([]);
  const [tournaments, setTournaments] = useState<{ id: string; title: string; location?: string; status?: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Custom presets state (persisted to localStorage)
  const [customPresets, setCustomPresets] = useState<AnnouncementPreset[]>(() => {
    try {
      const saved = localStorage.getItem('gurukul_custom_announcement_presets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modal for creating custom preset
  const [isSavePresetModalOpen, setIsSavePresetModalOpen] = useState(false);
  const [newPresetLabel, setNewPresetLabel] = useState('');
  const [presetTargetSource, setPresetTargetSource] = useState<'CREATE' | 'EDIT'>('CREATE');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [previewAnnouncement, setPreviewAnnouncement] = useState<Announcement | null>(null);
  const [broadcastTarget, setBroadcastTarget] = useState<Announcement | null>(null);

  // Broadcast & Scheduling Form state
  const [broadcastMode, setBroadcastMode] = useState<'NOW' | 'SCHEDULED'>('NOW');
  const [scheduledDateTime, setScheduledDateTime] = useState<string>('');
  const [scheduledDateTimes, setScheduledDateTimes] = useState<string[]>([
    new Date(Date.now() + 3600000).toISOString().slice(0, 16),
  ]);

  // Top WhatsApp Broadcast Template Configurator
  const DEFAULT_ANNOUNCEMENT_TEMPLATE =
    '🥋 *Gurukul Sports Academy Announcement*\n\nDear {student_name} / Parents,\n*{title}*\n\n{message}\n\nWarm regards,\nGurukul Sports Academy Administration';

  const [announcementWhatsappTemplate, setAnnouncementWhatsappTemplate] = useState<string>(() => {
    try {
      return localStorage.getItem('gurukul_announcement_whatsapp_template') || DEFAULT_ANNOUNCEMENT_TEMPLATE;
    } catch {
      return DEFAULT_ANNOUNCEMENT_TEMPLATE;
    }
  });
  const [isAnnouncementTemplateOpen, setIsAnnouncementTemplateOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState<{
    title: string;
    message: string;
    batchIds: string[];
    tournamentIds: string[];
  }>({
    title: '',
    message: '',
    batchIds: [],
    tournamentIds: [],
  });

  const [editFormData, setEditFormData] = useState<{
    title: string;
    message: string;
    batchIds: string[];
    tournamentIds: string[];
  }>({
    title: '',
    message: '',
    batchIds: [],
    tournamentIds: [],
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

  const fetchTournaments = async () => {
    if (!token) return;
    try {
      const data = await apiClient<any>('/tournaments');
      const list = data?.data || data?.tournaments || (Array.isArray(data) ? data : []);
      setTournaments(list);
    } catch (err) {
      console.error('Failed to load tournaments:', err);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    fetchBatches();
    fetchTournaments();
  }, [token]);

  // Presets Handlers
  const allPresets = [...DEFAULT_PRESETS, ...customPresets];

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

  const handleOpenSavePresetModal = (source: 'CREATE' | 'EDIT') => {
    const active = source === 'CREATE' ? formData : editFormData;
    if (!active.title.trim() && !active.message.trim()) {
      toast.warning('Please enter a title and message first to save as a preset.');
      return;
    }
    setPresetTargetSource(source);
    setNewPresetLabel('');
    setIsSavePresetModalOpen(true);
  };

  const handleConfirmSavePreset = () => {
    if (!newPresetLabel.trim()) {
      toast.warning('Please enter a preset button label (e.g. 🥋 Belt Test)');
      return;
    }
    const active = presetTargetSource === 'CREATE' ? formData : editFormData;
    const newPreset: AnnouncementPreset = {
      id: `custom-${Date.now()}`,
      label: newPresetLabel.trim(),
      title: active.title.trim(),
      message: active.message.trim(),
      isCustom: true,
    };
    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    try {
      localStorage.setItem('gurukul_custom_announcement_presets', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save preset to storage', e);
    }
    setIsSavePresetModalOpen(false);
    toast.success(`Preset "${newPreset.label}" saved! You can use it anytime.`);
  };

  const handleDeleteCustomPreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customPresets.filter((p) => p.id !== id);
    setCustomPresets(updated);
    try {
      localStorage.setItem('gurukul_custom_announcement_presets', JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }
    toast.success('Custom preset removed.');
  };

  // Batches handlers
  const handleToggleBatch = (batchId: string) => {
    setFormData((prev) => {
      const exists = prev.batchIds.includes(batchId);
      return {
        ...prev,
        batchIds: exists ? prev.batchIds.filter((id) => id !== batchId) : [...prev.batchIds, batchId],
      };
    });
  };

  const handleSelectAllBatches = () => {
    if (formData.batchIds.length === batches.length) {
      setFormData((prev) => ({ ...prev, batchIds: [] }));
    } else {
      setFormData((prev) => ({ ...prev, batchIds: batches.map((b) => b.id) }));
    }
  };

  // Tournaments handlers (CREATE)
  const handleToggleTournament = (tournamentId: string) => {
    setFormData((prev) => {
      const exists = prev.tournamentIds.includes(tournamentId);
      return {
        ...prev,
        tournamentIds: exists
          ? prev.tournamentIds.filter((id) => id !== tournamentId)
          : [...prev.tournamentIds, tournamentId],
      };
    });
  };

  const handleSelectAllTournaments = () => {
    if (formData.tournamentIds.length === tournaments.length) {
      setFormData((prev) => ({ ...prev, tournamentIds: [] }));
    } else {
      setFormData((prev) => ({ ...prev, tournamentIds: tournaments.map((t) => t.id) }));
    }
  };

  // Edit Handlers
  const handleOpenEdit = (a: Announcement) => {
    setEditingAnnouncement(a);
    const selectedIds = (a.batches || []).map((b: any) => b.batch?.id).filter(Boolean);
    const selectedTourneys = a.metadata?.tournamentIds || [];
    setEditFormData({
      title: a.title,
      message: a.message,
      batchIds: selectedIds,
      tournamentIds: selectedTourneys,
    });
    setIsEditModalOpen(true);
  };

  const handleToggleEditBatch = (batchId: string) => {
    setEditFormData((prev) => {
      const exists = prev.batchIds.includes(batchId);
      return {
        ...prev,
        batchIds: exists ? prev.batchIds.filter((id) => id !== batchId) : [...prev.batchIds, batchId],
      };
    });
  };

  const handleSelectAllEditBatches = () => {
    if (editFormData.batchIds.length === batches.length) {
      setEditFormData((prev) => ({ ...prev, batchIds: [] }));
    } else {
      setEditFormData((prev) => ({ ...prev, batchIds: batches.map((b) => b.id) }));
    }
  };

  const handleToggleEditTournament = (tournamentId: string) => {
    setEditFormData((prev) => {
      const exists = prev.tournamentIds.includes(tournamentId);
      return {
        ...prev,
        tournamentIds: exists
          ? prev.tournamentIds.filter((id) => id !== tournamentId)
          : [...prev.tournamentIds, tournamentId],
      };
    });
  };

  const handleSelectAllEditTournaments = () => {
    if (editFormData.tournamentIds.length === tournaments.length) {
      setEditFormData((prev) => ({ ...prev, tournamentIds: [] }));
    } else {
      setEditFormData((prev) => ({ ...prev, tournamentIds: tournaments.map((t) => t.id) }));
    }
  };

  // Submission
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.batchIds.length === 0 && formData.tournamentIds.length === 0) {
      toast.warning('Please select at least one target batch or tournament squad.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await apiClient('/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title: formData.title,
          message: formData.message,
          batchIds: formData.batchIds,
          tournamentIds: formData.tournamentIds,
          metadata: {
            tournamentIds: formData.tournamentIds,
          },
        }),
      });

      setSuccessMessage('Announcement created as DRAFT. You can now preview and broadcast it safely.');
      toast.success('Announcement drafted successfully!');
      setIsCreateModalOpen(false);
      setFormData({ title: '', message: '', batchIds: [], tournamentIds: [] });
      fetchAnnouncements();
    } catch (err: any) {
      setError(err.message || 'Failed to create announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnnouncement) return;
    if (editFormData.batchIds.length === 0 && editFormData.tournamentIds.length === 0) {
      toast.warning('Please select at least one target batch or tournament squad.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await apiClient(`/announcements/${editingAnnouncement.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editFormData.title,
          message: editFormData.message,
          batchIds: editFormData.batchIds,
          tournamentIds: editFormData.tournamentIds,
          metadata: {
            tournamentIds: editFormData.tournamentIds,
          },
        }),
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

  // Open the broadcast modal with defaults
  const handleOpenBroadcastModal = (a: Announcement) => {
    setBroadcastTarget(a);
    setBroadcastMode('NOW');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const localIso = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setScheduledDateTime(localIso);
    setScheduledDateTimes([localIso]);
  };

  const handleConfirmBroadcast = async () => {
    if (!broadcastTarget) return;

    if (broadcastMode === 'SCHEDULED' && scheduledDateTimes.length === 0 && !scheduledDateTime) {
      toast.warning('Please select at least one valid scheduled delivery time.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const targetIso = scheduledDateTimes[0] || scheduledDateTime;
      const payload = {
        scheduledTime: broadcastMode === 'SCHEDULED' && targetIso ? new Date(targetIso).toISOString() : undefined,
        scheduledTimes: broadcastMode === 'SCHEDULED' ? scheduledDateTimes.map((t) => new Date(t).toISOString()) : undefined,
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
            Publish targeted notifications and dispatch automated WhatsApp broadcasts to batches & tournament squads with anti-ban safety.
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

      {/* WhatsApp Broadcast Template Configurator */}
      <Card className="p-4 bg-gradient-to-br from-indigo-950/20 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-indigo-500/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">WhatsApp Broadcast Announcement Message &amp; Automation</h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Active Broadcast Config
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Official announcement template dispatched to student batches and tournament squads with live preview.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAnnouncementTemplateOpen(!isAnnouncementTemplateOpen)}
            className="text-xs h-8 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10"
          >
            <Edit2 className="w-3.5 h-3.5 mr-1.5" />
            {isAnnouncementTemplateOpen ? 'Collapse Editor' : 'Edit Template & Preview'}
          </Button>
        </div>

        {/* Collapsed Preview */}
        {!isAnnouncementTemplateOpen && (
          <div className="mt-3 p-2.5 rounded-xl bg-black/40 border border-white/5 font-mono text-[11px] text-slate-300 line-clamp-2">
            "{announcementWhatsappTemplate}"
          </div>
        )}

        {/* Expanded Editor */}
        {isAnnouncementTemplateOpen && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  Template Message Text
                </label>
                <textarea
                  value={announcementWhatsappTemplate}
                  onChange={(e) => setAnnouncementWhatsappTemplate(e.target.value)}
                  rows={4}
                  className="w-full text-xs font-sans p-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 block mb-1">Dynamic Variable Tags:</span>
                <div className="flex flex-wrap gap-1.5">
                  {['{student_name}', '{parent_name}', '{title}', '{message}', '{batch_name}', '{date}'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setAnnouncementWhatsappTemplate((prev) => `${prev} ${tag}`)}
                      className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-800 hover:bg-slate-700 border border-slate-600 text-indigo-300 transition-colors"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <Button
                  size="sm"
                  onClick={() => {
                    localStorage.setItem('gurukul_announcement_whatsapp_template', announcementWhatsappTemplate);
                    toast.success('Announcement WhatsApp template saved!');
                  }}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  Save Template
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAnnouncementWhatsappTemplate(DEFAULT_ANNOUNCEMENT_TEMPLATE)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Reset Default
                </Button>
              </div>
            </div>

            {/* Live WhatsApp Bubble */}
            <div>
              <span className="text-xs font-bold text-slate-200 block mb-1.5">
                📱 Live Recipient WhatsApp Preview
              </span>
              <div className="p-3.5 rounded-2xl bg-[#0b141a] border border-[#222e35] text-xs font-sans text-slate-100">
                <div className="bg-[#005c4b] text-[#e9edef] p-3 rounded-xl rounded-tr-none shadow-sm space-y-1.5">
                  <p className="whitespace-pre-wrap leading-relaxed text-[12px]">
                    {announcementWhatsappTemplate
                      .replace('{student_name}', 'Aarav Patil')
                      .replace('{parent_name}', 'Rajesh Patil')
                      .replace('{title}', 'Important Academy Notice')
                      .replace('{message}', 'Training timings updated for this weekend. Please check your schedule.')
                      .replace('{batch_name}', 'Kalari Morning Batch')
                      .replace('{date}', new Date().toLocaleDateString('en-IN'))}
                  </p>
                  <div className="flex items-center justify-end gap-1 text-[10px] text-[#8696a0]">
                    <span>08:15 AM</span>
                    <span className="text-[#53bdeb]">✓✓</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

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
                  <th className="px-5 py-3.5">Target Audience</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {announcements.map((a) => {
                  const targetBatches = (a.batches || []).map((b) => b.batch?.name).filter(Boolean);
                  const targetedTournaments = tournaments.filter((t) => (a.metadata?.tournamentIds || []).includes(t.id));

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
                              key={`b-${idx}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60"
                            >
                              <Layers className="w-2.5 h-2.5 text-purple-500" />
                              {name}
                            </span>
                          ))}
                          {targetedTournaments.map((tourney, idx) => (
                            <span
                              key={`t-${idx}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60"
                            >
                              <Trophy className="w-2.5 h-2.5 text-amber-500" />
                              {tourney.title}
                            </span>
                          ))}
                          {targetBatches.length === 0 && targetedTournaments.length === 0 && (
                            <span className="text-xs text-slate-400 italic">No targets specified</span>
                          )}
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
          {/* Quick Presets Section with Custom Presets Support */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Quick Message Presets</span>
              </div>
              <button
                type="button"
                onClick={() => handleOpenSavePresetModal('CREATE')}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                + Save Draft as New Preset
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
              {allPresets.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleApplyPreset(p, false)}
                  className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    p.isCustom
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                  }`}
                >
                  <span>{p.label}</span>
                  {p.isCustom && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteCustomPreset(p.id, e)}
                      className="p-0.5 text-amber-400/60 hover:text-rose-400 rounded transition-colors"
                      title="Delete custom preset"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
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
              placeholder="Write announcement body here. Will be dispatched to student & guardian contacts via WhatsApp."
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="w-full text-sm rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-sans placeholder:text-slate-400 dark:placeholder:text-slate-400"
            />
          </div>

          {/* Target Audience Section: Batches + Tournament Squads */}
          <div className="space-y-4 pt-2 border-t border-slate-200/70 dark:border-slate-800">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Select Target Audience (Select at least one)
            </div>

            {/* 1. Academic Batches */}
            <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <Layers className="w-3.5 h-3.5 text-purple-500" />
                  <span>Academy Batches ({formData.batchIds.length}/{batches.length} selected)</span>
                </div>
                <button
                  type="button"
                  onClick={handleSelectAllBatches}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                >
                  {formData.batchIds.length === batches.length ? 'Deselect All Batches' : 'Select All Batches'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                {batches.map((b) => (
                  <label
                    key={b.id}
                    className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 transition-all shadow-sm"
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

            {/* 2. Tournament Squads */}
            <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <span>Tournament Squads ({formData.tournamentIds.length}/{tournaments.length} selected)</span>
                </div>
                <button
                  type="button"
                  onClick={handleSelectAllTournaments}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                >
                  {formData.tournamentIds.length === tournaments.length ? 'Deselect All Squads' : 'Select All Squads'}
                </button>
              </div>

              {tournaments.length === 0 ? (
                <div className="text-xs text-slate-400 py-2 italic text-center">
                  No tournaments registered yet.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                  {tournaments.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer hover:border-amber-300 dark:hover:border-amber-600 transition-all shadow-sm"
                    >
                      <input
                        type="checkbox"
                        checked={formData.tournamentIds.includes(t.id)}
                        onChange={() => handleToggleTournament(t.id)}
                        className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-amber-600 focus:ring-amber-500"
                      />
                      <div className="truncate flex-1">
                        <div className="truncate font-semibold">{t.title}</div>
                        {t.location && <div className="text-[10px] text-slate-400 truncate">{t.location}</div>}
                      </div>
                    </label>
                  ))}
                </div>
              )}
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
          {/* Quick Presets Section */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Quick Message Presets</span>
              </div>
              <button
                type="button"
                onClick={() => handleOpenSavePresetModal('EDIT')}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                + Save Draft as New Preset
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
              {allPresets.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleApplyPreset(p, true)}
                  className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    p.isCustom
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                  }`}
                >
                  <span>{p.label}</span>
                  {p.isCustom && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteCustomPreset(p.id, e)}
                      className="p-0.5 text-amber-400/60 hover:text-rose-400 rounded transition-colors"
                      title="Delete custom preset"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

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
              placeholder="Write announcement body here. Will be dispatched to student & guardian contacts via WhatsApp."
              value={editFormData.message}
              onChange={(e) => setEditFormData({ ...editFormData, message: e.target.value })}
              className="w-full text-sm rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-sans placeholder:text-slate-400 dark:placeholder:text-slate-400"
            />
          </div>

          {/* Target Audience Section: Batches + Tournament Squads */}
          <div className="space-y-4 pt-2 border-t border-slate-200/70 dark:border-slate-800">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Select Target Audience (Select at least one)
            </div>

            {/* Academic Batches */}
            <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <Layers className="w-3.5 h-3.5 text-purple-500" />
                  <span>Academy Batches ({editFormData.batchIds.length}/{batches.length} selected)</span>
                </div>
                <button
                  type="button"
                  onClick={handleSelectAllEditBatches}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                >
                  {editFormData.batchIds.length === batches.length ? 'Deselect All Batches' : 'Select All Batches'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                {batches.map((b) => (
                  <label
                    key={b.id}
                    className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 transition-all shadow-sm"
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

            {/* Tournament Squads */}
            <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <span>Tournament Squads ({editFormData.tournamentIds.length}/{tournaments.length} selected)</span>
                </div>
                <button
                  type="button"
                  onClick={handleSelectAllEditTournaments}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                >
                  {editFormData.tournamentIds.length === tournaments.length ? 'Deselect All Squads' : 'Select All Squads'}
                </button>
              </div>

              {tournaments.length === 0 ? (
                <div className="text-xs text-slate-400 py-2 italic text-center">
                  No tournaments registered yet.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                  {tournaments.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer hover:border-amber-300 dark:hover:border-amber-600 transition-all shadow-sm"
                    >
                      <input
                        type="checkbox"
                        checked={editFormData.tournamentIds.includes(t.id)}
                        onChange={() => handleToggleEditTournament(t.id)}
                        className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-amber-600 focus:ring-amber-500"
                      />
                      <div className="truncate flex-1">
                        <div className="truncate font-semibold">{t.title}</div>
                        {t.location && <div className="text-[10px] text-slate-400 truncate">{t.location}</div>}
                      </div>
                    </label>
                  ))}
                </div>
              )}
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

      {/* MODAL: Save New Preset */}
      <Modal
        isOpen={isSavePresetModalOpen}
        onClose={() => setIsSavePresetModalOpen(false)}
        title="Save as Quick Preset"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Save this announcement title and message so you can apply it in 1 click anytime in the future.
          </p>
          <Input
            label="Preset Button Label *"
            required
            placeholder="e.g. 🥋 Belt Exam Test or ⚡ Emergency Alert"
            value={newPresetLabel}
            onChange={(e) => setNewPresetLabel(e.target.value)}
          />

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Draft Preview:</div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              {presetTargetSource === 'CREATE' ? formData.title || '(No title)' : editFormData.title || '(No title)'}
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
              {presetTargetSource === 'CREATE' ? formData.message || '(No message)' : editFormData.message || '(No message)'}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsSavePresetModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSavePreset} className="bg-indigo-600 hover:bg-indigo-700">
              Save Preset
            </Button>
          </div>
        </div>
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
                  Targeting {(broadcastTarget.batches || []).length} batch(es) & {(broadcastTarget.metadata?.tournamentIds || []).length} tournament squad(s)
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
                      ? 'border-indigo-600 bg-indigo-500/10 text-indigo-900 dark:text-white'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <Send className={`w-4 h-4 mt-0.5 shrink-0 ${broadcastMode === 'NOW' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                  <div>
                    <div className={`text-xs font-bold ${broadcastMode === 'NOW' ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                      ⚡ Send Now (Instant Queue)
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Immediately enqueues with 16-22s anti-ban spacing between each parent.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBroadcastMode('SCHEDULED')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    broadcastMode === 'SCHEDULED'
                      ? 'border-indigo-600 bg-indigo-500/10 text-indigo-900 dark:text-white'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <Clock className={`w-4 h-4 mt-0.5 shrink-0 ${broadcastMode === 'SCHEDULED' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                  <div>
                    <div className={`text-xs font-bold ${broadcastMode === 'SCHEDULED' ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                      ⏰ Schedule for Later
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Set a specific date & time (e.g. tomorrow at 9:00 AM) to avoid night alerts.
                    </div>
                  </div>
                </button>
              </div>

              {/* Multi-slot Scheduled DateTime Picker */}
              {broadcastMode === 'SCHEDULED' && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                      <span>Configured Dispatch Slots (IST):</span>
                    </label>
                    <span className="text-[11px] font-semibold text-indigo-500">
                      {scheduledDateTimes.length} Slot(s)
                    </span>
                  </div>

                  <div className="space-y-2">
                    {scheduledDateTimes.map((time, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-400 w-14 shrink-0">
                          Slot #{idx + 1}:
                        </span>
                        <input
                          type="datetime-local"
                          value={time}
                          onChange={(e) => {
                            const updated = [...scheduledDateTimes];
                            updated[idx] = e.target.value;
                            setScheduledDateTimes(updated);
                            if (idx === 0) setScheduledDateTime(e.target.value);
                          }}
                          className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-2 focus:outline-none focus:border-indigo-500 font-mono"
                        />
                        {scheduledDateTimes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setScheduledDateTimes(scheduledDateTimes.filter((_, i) => i !== idx))}
                            className="p-1.5 text-rose-400 hover:text-rose-600 rounded"
                            title="Remove slot"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const last = scheduledDateTimes[scheduledDateTimes.length - 1];
                      const next = last ? new Date(new Date(last).getTime() + 86400000) : new Date(Date.now() + 86400000);
                      const iso = new Date(next.getTime() - next.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                      setScheduledDateTimes([...scheduledDateTimes, iso]);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline pt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Broadcast Slot</span>
                  </button>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-2">
                    * The system will automatically wake up and begin staggered dispatches at each scheduled time slot.
                  </p>
                </div>
              )}

              {/* Night time warning if sending now late */}
              {broadcastMode === 'NOW' && isNightTime && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
                  <span>
                    Notice: It is currently late evening. Sending broadcasts at night may disturb parents. You may choose <b>Schedule for Later</b> (e.g. tomorrow morning) for higher engagement.
                  </span>
                </div>
              )}
            </div>

            {/* Real WhatsApp Chat Bubble Preview */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
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
            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700">
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
                      key={`preview-b-${idx}`}
                      className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 flex items-center gap-1"
                    >
                      <Layers className="w-3 h-3 text-indigo-500" />
                      {b.batch?.name}
                    </span>
                  ))}
                  {tournaments
                    .filter((t) => (previewAnnouncement.metadata?.tournamentIds || []).includes(t.id))
                    .map((t, idx) => (
                      <span
                        key={`preview-t-${idx}`}
                        className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/60 flex items-center gap-1"
                      >
                        <Trophy className="w-3 h-3 text-amber-500" />
                        {t.title}
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
