import React, { useState, useEffect } from 'react';
import {
  Users,
  Send,
  Plus,
  Trash2,
  Clock,
  Phone,
  RefreshCw,
  Building,
  Edit2,
  Check,
  MessageSquare,
  X,
  UserPlus,
  FolderPlus,
  FileText,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { apiClient } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

export interface TeamMessageRecord {
  id: string;
  sender_name?: string | null;
  sender_position?: string | null;
  recipient_role: string;
  subject?: string | null;
  message: string;
  priority: 'NORMAL' | 'URGENT' | 'ANNOUNCEMENT';
  status: string;
  created_at: string;
}

export interface TeamCategory {
  id: string;
  code: string;
  name: string;
  marathi_name?: string | null;
  description?: string | null;
  color?: string | null;
  created_at?: string;
}

export interface TeamMember {
  id: string;
  phone: string;
  name?: string | null;
  position?: string | null;
  team_code: string;
  district?: string | null;
  notes?: string | null;
  status?: string;
  created_at?: string;
}

export const DEFAULT_TEAMS: TeamCategory[] = [];

export interface DispatchedLog {
  id: string;
  recipientPhone: string;
  recipientName?: string;
  message: string;
  status: 'SENT' | 'FAILED';
  timestamp: string;
}

const DEFAULT_MEMBERS: TeamMember[] = [];

const PRESET_TEMPLATES = [
  {
    label: 'Jilapramukh District Notice',
    subject: 'जिल्हास्तरीय स्पर्धा व संघ समन्वय (District Meet)',
    text: 'सादर जय हिंद जिल्हाप्रमुख महोदय, गुरुकुल स्पोर्ट्स अकॅडमी अंतर्गत आगामी जिल्हास्तरीय क्रीडा स्पर्धेचे संघ नामांकन व खेळाडू यादी निश्चिती बैठक आयोजित केली आहे. कृपया आपल्या तालुक्यातील संघ प्रतिनिधींसह उपस्थित राहावे.',
  },
  {
    label: 'Jilapramukh Grading Schedule',
    subject: 'जिल्हास्तरीय बेल्ट ग्रेडिंग परीक्षा',
    text: 'सूचना सर्व जिल्हाप्रमुख: आगामी मार्शल आर्ट्स बेल्ट परीक्षा व प्रमाणपत्र पडताळणी तारीख जाहीर झाली आहे. आपल्या कार्यक्षेत्रातील पात्र विद्यार्थ्यांचे अर्ज अंतिम तारखेपूर्वी सादर करावेत.',
  },
  {
    label: 'Team Meeting',
    subject: 'Emergency Coordination Briefing',
    text: 'Notice to Academy Staff: A short coordination briefing will take place today at the main dojo floor. Please ensure timely presence.',
  },
  {
    label: 'Batch Schedule Update',
    subject: 'Training Timing Adjustments',
    text: 'Attention Team: Training batch timings for Kalarippayattu & Karate have been adjusted for this week. Please review your assigned batches.',
  },
  {
    label: 'Roll Call Reminder',
    subject: 'Daily Attendance Compliance',
    text: 'Duty Alert: Coaches & assistants are requested to mark daily student attendance sheets promptly and verify safety gear.',
  },
];

export const TeamMessagingPage: React.FC = () => {
  const { toast } = useToast();

  // Database Team Messages state
  const [dbMessages, setDbMessages] = useState<TeamMessageRecord[]>([]);
  const [dbLoading, setDbLoading] = useState(false);

  // Teams Categories list (Syncs with Cloud DB + Local Storage cache)
  const [teams, setTeams] = useState<TeamCategory[]>(() => {
    try {
      const saved = localStorage.getItem('gurukul_teams_list');
      return saved ? JSON.parse(saved) : DEFAULT_TEAMS;
    } catch {
      return DEFAULT_TEAMS;
    }
  });

  // Team roster (Syncs with Cloud DB + Local Storage cache)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => {
    try {
      const saved = localStorage.getItem('gurukul_personal_team_members');
      return saved ? JSON.parse(saved) : DEFAULT_MEMBERS;
    } catch {
      return DEFAULT_MEMBERS;
    }
  });

  // Selected recipient IDs
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [manualPhone, setManualPhone] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isManageTeamsModalOpen, setIsManageTeamsModalOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [historyTab, setHistoryTab] = useState<'ALL' | 'SENT' | 'DRAFT'>('ALL');

  // Composer fields (Sender Name optional, Position removed per user requirement)
  const [senderName, setSenderName] = useState('');
  const [recipientRole, setRecipientRole] = useState('JILAPRAMUKH');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT' | 'ANNOUNCEMENT'>('NORMAL');
  const [subject, setSubject] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  // Multi-Slot Scheduling
  const [broadcastMode, setBroadcastMode] = useState<'NOW' | 'SCHEDULED'>('NOW');
  const [scheduledTimes, setScheduledTimes] = useState<string[]>([
    new Date(Date.now() + 3600000).toISOString().slice(0, 16),
  ]);

  // Top WhatsApp Team Broadcast Template Configurator
  const DEFAULT_TEAM_TEMPLATE =
    '🥋 *Gurukul Sports Academy Team Notice*\n\nDear {recipient_name},\n{message}\n\nPriority: {priority}\nFrom: {sender_name}\nGurukul Sports Academy Administration';

  const [teamWhatsappTemplate, setTeamWhatsappTemplate] = useState<string>(() => {
    try {
      return localStorage.getItem('gurukul_team_whatsapp_template') || DEFAULT_TEAM_TEMPLATE;
    } catch {
      return DEFAULT_TEAM_TEMPLATE;
    }
  });
  const [isTeamTemplateOpen, setIsTeamTemplateOpen] = useState(false);

  // Modal: Add Team Member
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [newMemberForm, setNewMemberForm] = useState({
    phone: '',
    name: '',
    position: '',
    team_code: 'JILAPRAMUKH',
    district: '',
    notes: '',
  });

  // Modal: Create New Team / Group
  const [isNewTeamModalOpen, setIsNewTeamModalOpen] = useState(false);

  // Edit Team state
  const [editingTeam, setEditingTeam] = useState<TeamCategory | null>(null);
  const [isEditTeamModalOpen, setIsEditTeamModalOpen] = useState(false);
  const [savingEditTeam, setSavingEditTeam] = useState(false);
  const [editTeamForm, setEditTeamForm] = useState({
    name: '',
    marathiName: '',
    code: '',
    description: '',
    color: 'indigo',
  });

  const handleOpenEditTeam = (team: TeamCategory) => {
    setEditingTeam(team);
    setEditTeamForm({
      name: team.name,
      marathiName: team.marathi_name || '',
      code: team.code,
      description: team.description || '',
      color: team.color || 'indigo',
    });
    setIsEditTeamModalOpen(true);
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;
    if (!editTeamForm.name.trim()) {
      toast.error('Team name is required');
      return;
    }
    setSavingEditTeam(true);
    try {
      const updatedCode = editTeamForm.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_') || editingTeam.code;
      if (editingTeam.id && !editingTeam.id.startsWith('t_')) {
        await apiClient(`/team-messages/teams/${editingTeam.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: editTeamForm.name.trim(),
            code: updatedCode,
            marathiName: editTeamForm.marathiName.trim() || null,
            description: editTeamForm.description.trim() || null,
            color: editTeamForm.color,
          }),
        });
      }

      const updatedCategory: TeamCategory = {
        ...editingTeam,
        name: editTeamForm.name.trim(),
        code: updatedCode,
        marathi_name: editTeamForm.marathiName.trim() || null,
        description: editTeamForm.description.trim() || null,
        color: editTeamForm.color,
      };

      setTeams((prev) => prev.map((t) => (t.id === editingTeam.id || t.code === editingTeam.code ? updatedCategory : t)));

      if (editingTeam.code !== updatedCode) {
        setTeamMembers((prev) =>
          prev.map((m) => (m.team_code === editingTeam.code ? { ...m, team_code: updatedCode } : m))
        );
        if (activeCategory === editingTeam.code) {
          setActiveCategory(updatedCode);
        }
      }

      setIsEditTeamModalOpen(false);
      setEditingTeam(null);
      toast.success(`Team "${updatedCategory.name}" updated successfully!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update team');
    } finally {
      setSavingEditTeam(false);
    }
  };
  const [savingTeam, setSavingTeam] = useState(false);
  const [newTeamForm, setNewTeamForm] = useState({
    name: '',
    code: '',
    marathiName: '',
    description: '',
  });

  // Dispatched Logs (Local tracking)
  const [dispatchLogs, setDispatchLogs] = useState<DispatchedLog[]>(() => {
    try {
      const saved = localStorage.getItem('gurukul_team_dispatch_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Fetch Database Team Messages
  const fetchDbMessages = async () => {
    setDbLoading(true);
    try {
      const res = await apiClient<any>('/team-messages');
      const list = Array.isArray(res) ? res : res?.data || [];
      setDbMessages(list);
    } catch (err: any) {
      console.warn('Failed to fetch team messages from database:', err?.message);
    } finally {
      setDbLoading(false);
    }
  };

  // Fetch Teams Categories from DB
  const fetchTeams = async () => {
    try {
      const res = await apiClient<any>('/team-messages/teams');
      const list = Array.isArray(res) ? res : res?.data || [];
      if (Array.isArray(list)) {
        setTeams(list);
        try {
          localStorage.setItem('gurukul_teams_list', JSON.stringify(list));
        } catch {}
      }
    } catch (err: any) {
      console.warn('Failed to fetch teams from database:', err?.message);
    }
  };

  // Fetch Team Members from DB
  const fetchTeamMembers = async () => {
    try {
      const res = await apiClient<any>('/team-messages/members');
      const list = Array.isArray(res) ? res : res?.data || [];
      if (Array.isArray(list)) {
        setTeamMembers(list);
        try {
          localStorage.setItem('gurukul_personal_team_members', JSON.stringify(list));
        } catch {}
      }
    } catch (err: any) {
      console.warn('Failed to fetch team members from database:', err?.message);
    }
  };

  useEffect(() => {
    fetchDbMessages();
    fetchTeams();
    fetchTeamMembers();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('gurukul_personal_team_members', JSON.stringify(teamMembers));
    } catch {}
  }, [teamMembers]);

  useEffect(() => {
    try {
      localStorage.setItem('gurukul_teams_list', JSON.stringify(teams));
    } catch {}
  }, [teams]);

  useEffect(() => {
    try {
      localStorage.setItem('gurukul_team_dispatch_logs', JSON.stringify(dispatchLogs));
    } catch {}
  }, [dispatchLogs]);

  // Handle Create New Team

  // Delete Team handler
  const handleDeleteTeam = async (teamToDelete: TeamCategory) => {
    const confirmDelete = window.confirm(
      `Delete team "${teamToDelete.marathi_name ? `${teamToDelete.marathi_name} (${teamToDelete.name})` : teamToDelete.name}"?\n\nAny existing contacts assigned to this team will remain in your contacts roster.`
    );
    if (!confirmDelete) return;

    try {
      if (teamToDelete.id) {
        await apiClient(`/team-messages/teams/${teamToDelete.id}`, { method: 'DELETE' }).catch((e) => {
          console.warn('Backend team delete notice:', e.message);
        });
      }
      setTeams((prev) => prev.filter((t) => t.id !== teamToDelete.id && t.code !== teamToDelete.code));
      setTeamMembers((prev) =>
        prev.map((m) => (m.team_code === teamToDelete.code ? { ...m, team_code: 'UNASSIGNED' } : m))
      );
      if (activeCategory === teamToDelete.code) {
        setActiveCategory('ALL');
      }
      toast.success(`Team "${teamToDelete.name}" deleted successfully.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete team');
    }
  };

  // Save Message as Draft
  const handleSaveDraft = async () => {
    if (!messageText.trim()) {
      toast.error('Please enter message text before saving as draft.');
      return;
    }
    setSavingDraft(true);
    try {
      const res = await apiClient<any>('/team-messages', {
        method: 'POST',
        body: JSON.stringify({
          sender_name: senderName.trim() || null,
          recipient_role: recipientRole,
          subject: subject.trim() || null,
          message: messageText.trim(),
          priority: priority,
          status: 'DRAFT',
          isDraft: true,
        }),
      });

      const savedDraft = res?.data;
      if (savedDraft) {
        setDbMessages((prev) => [savedDraft, ...prev.filter((m) => m.id !== savedDraft.id)]);
      } else {
        await fetchDbMessages();
      }
      toast.success('Team message saved as Draft!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  // Load Draft into composer
  const handleLoadDraft = (draft: TeamMessageRecord) => {
    setMessageText(draft.message || '');
    setSubject(draft.subject || '');
    setRecipientRole(draft.recipient_role || 'ALL_STAFF');
    setPriority((draft.priority as any) || 'NORMAL');
    if (draft.sender_name) setSenderName(draft.sender_name);
    toast.info('Draft loaded into composer! You can edit and send.');
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamForm.name.trim()) {
      toast.error('Team name is required.');
      return;
    }

    setSavingTeam(true);
    try {
      const res = await apiClient<any>('/team-messages/teams', {
        method: 'POST',
        body: JSON.stringify({
          name: newTeamForm.name.trim(),
          code: newTeamForm.code.trim() || undefined,
          marathiName: newTeamForm.marathiName.trim() || undefined,
          description: newTeamForm.description.trim() || undefined,
          color: 'indigo',
        }),
      });

      const created = res?.data;
      if (created) {
        setTeams((prev) => [...prev.filter((t) => t.code !== created.code), created]);
        setActiveCategory(created.code);
        setRecipientRole(created.code);
      } else {
        await fetchTeams();
      }

      setIsNewTeamModalOpen(false);
      setNewTeamForm({ name: '', code: '', marathiName: '', description: '' });
      toast.success('New team created and saved to academy database!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create team');
    } finally {
      setSavingTeam(false);
    }
  };



  // Handle member addition
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberForm.phone.trim()) {
      toast.error('Mobile/WhatsApp number is required.');
      return;
    }

    setSavingMember(true);
    try {
      const res = await apiClient<any>('/team-messages/members', {
        method: 'POST',
        body: JSON.stringify({
          phone: newMemberForm.phone.trim(),
          name: newMemberForm.name.trim() || undefined,
          teamCode: newMemberForm.team_code,
          district: newMemberForm.district.trim() || undefined,
          position:
            newMemberForm.position.trim() ||
            (newMemberForm.team_code === 'JILAPRAMUKH'
              ? `जिल्हाप्रमुख ${newMemberForm.district ? `(${newMemberForm.district})` : ''}`
              : undefined),
          notes: newMemberForm.notes.trim() || undefined,
        }),
      });

      const created = res?.data;
      if (created) {
        setTeamMembers((prev) => [created, ...prev.filter((m) => m.id !== created.id)]);
      } else {
        await fetchTeamMembers();
      }

      setIsAddModalOpen(false);
      setNewMemberForm({
        phone: '',
        name: '',
        position: '',
        team_code: teams[0]?.code || 'JILAPRAMUKH',
        district: '',
        notes: '',
      });
      toast.success('Team contact added and saved to database!');
    } catch (err: any) {
      // Offline fallback
      const fallbackMember: TeamMember = {
        id: `team_${Date.now()}`,
        phone: newMemberForm.phone.trim(),
        name: newMemberForm.name.trim() || undefined,
        team_code: newMemberForm.team_code,
        district: newMemberForm.district.trim() || undefined,
        position:
          newMemberForm.position.trim() ||
          (newMemberForm.team_code === 'JILAPRAMUKH'
            ? `जिल्हाप्रमुख ${newMemberForm.district ? `(${newMemberForm.district})` : ''}`
            : undefined),
        notes: newMemberForm.notes.trim() || undefined,
        created_at: new Date().toISOString(),
      };
      setTeamMembers((prev) => [fallbackMember, ...prev]);
      setIsAddModalOpen(false);
      toast.success('Team contact saved locally!');
    } finally {
      setSavingMember(false);
    }
  };

  const handleDeleteMember = async (id: string) => {
    try {
      await apiClient(`/team-messages/members/${id}`, { method: 'DELETE' });
      setTeamMembers((prev) => prev.filter((m) => m.id !== id));
      setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id));
      toast.info('Team contact removed from database.');
    } catch {
      setTeamMembers((prev) => prev.filter((m) => m.id !== id));
      setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id));
      toast.info('Team contact removed.');
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredMembers = teamMembers.filter((m) => {
    const matchesCat = activeCategory === 'ALL' || m.team_code === activeCategory || (m as any).team === activeCategory;
    if (!matchesCat) return false;
    if (!memberSearchQuery.trim()) return true;
    const q = memberSearchQuery.toLowerCase().trim();
    return (
      (m.name || '').toLowerCase().includes(q) ||
      (m.phone || '').includes(q) ||
      (m.district || '').toLowerCase().includes(q) ||
      (m.position || '').toLowerCase().includes(q)
    );
  });

  const handleSelectAll = () => {
    const activeIds = filteredMembers.map((m) => m.id);
    const allSelected = activeIds.length > 0 && activeIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !activeIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...activeIds])));
    }
  };

  // Delete DB message
  const handleDeleteDbMessage = async (id: string) => {
    try {
      await apiClient(`/team-messages/${id}`, { method: 'DELETE' });
      setDbMessages((prev) => prev.filter((m) => m.id !== id));
      toast.success('Team message deleted from database.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete message');
    }
  };

  // Save to DB and Dispatch
  const handleDispatchAndSave = async () => {
    if (!messageText.trim()) {
      toast.error('Please enter message content.');
      return;
    }

    setSending(true);

    // 1. Save to Database
    try {
      const savedRecord = await apiClient<any>('/team-messages', {
        method: 'POST',
        body: JSON.stringify({
          sender_name: senderName.trim() || null,
          recipient_role: recipientRole,
          subject: subject.trim() || null,
          message: messageText.trim(),
          priority: priority,
          scheduled_at: broadcastMode === 'SCHEDULED' ? scheduledTimes[0] : null,
          scheduled_times: broadcastMode === 'SCHEDULED' ? scheduledTimes : [],
          status: broadcastMode === 'SCHEDULED' ? 'SCHEDULED' : 'SENT',
        }),
      });

      if (savedRecord?.data) {
        setDbMessages((prev) => [savedRecord.data, ...prev]);
      } else {
        fetchDbMessages();
      }
      if (broadcastMode === 'SCHEDULED') {
        toast.success(`Team message scheduled across ${scheduledTimes.length} delivery slot(s)!`);
      } else {
        toast.success('Team broadcast stored in academy database!');
      }
    } catch (err: any) {
      console.error('Error storing team message:', err);
      toast.warning('Stored locally; backend sync noted.');
    }

    // 2. Dispatch WhatsApp immediately if Mode is NOW and contacts selected
    if (broadcastMode === 'NOW') {
      const recipients: Array<{ phone: string; name?: string | null }> = [];
      teamMembers
        .filter((m) => selectedIds.includes(m.id))
        .forEach((m) => recipients.push({ phone: m.phone, name: m.name }));

      if (manualPhone.trim()) {
        recipients.push({ phone: manualPhone.trim(), name: 'Direct Contact' });
      }

      if (recipients.length > 0) {
        let successCount = 0;
        const newLogs: DispatchedLog[] = [];

        for (const r of recipients) {
          try {
            await apiClient<any>('/whatsapp/send', {
              method: 'POST',
              body: JSON.stringify({
                phone: r.phone,
                message: messageText.trim(),
              }),
            });
            successCount++;
            newLogs.unshift({
              id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              recipientPhone: r.phone,
              recipientName: r.name || undefined,
              message: messageText.trim(),
              status: 'SENT',
              timestamp: new Date().toISOString(),
            });
          } catch {
            newLogs.unshift({
              id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              recipientPhone: r.phone,
              recipientName: r.name || undefined,
              message: messageText.trim(),
              status: 'FAILED',
              timestamp: new Date().toISOString(),
            });
          }
        }

        setDispatchLogs((prev) => [...newLogs, ...prev].slice(0, 50));
        if (successCount > 0) {
          toast.success(`WhatsApp dispatched to ${successCount} contact(s)!`);
        }
      }
    }

    setSending(false);
    setMessageText('');
    setSubject('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Message Your Personal Team
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Publish operational broadcasts, coordination notices, and duty assignments to district coordinators, coaches, and staff.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              fetchDbMessages();
              fetchTeams();
              fetchTeamMembers();
            }}
            disabled={dbLoading}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${dbLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Feed</span>
          </button>

          <Button
            variant="outline"
            onClick={() => setIsManageTeamsModalOpen(true)}
            className="gap-1.5 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer shadow-xs"
          >
            <Users className="w-3.5 h-3.5 text-indigo-500" />
            <span>All Teams ({teams.length})</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsNewTeamModalOpen(true)}
            className="gap-1.5 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-semibold cursor-pointer shadow-xs"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>+ Add New Team</span>
          </Button>

          <Button
            onClick={() => {
              if (teams.length > 0) {
                setNewMemberForm((prev) => ({
                  ...prev,
                  team_code: activeCategory !== 'ALL' ? activeCategory : teams[0].code,
                }));
              }
              setIsAddModalOpen(true);
            }}
            className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer shadow-xs text-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add Team Member</span>
          </Button>
        </div>
      </div>

      {/* WhatsApp Team Broadcast Template Configurator */}
      <Card className="p-4 bg-gradient-to-br from-indigo-950/20 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-indigo-500/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">Team WhatsApp Message &amp; Multi-Schedule Automation</h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Active Team Config
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Staff notices, duty rosters, and meeting reminders sent directly to instructors and coordinators via WhatsApp.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTeamTemplateOpen(!isTeamTemplateOpen)}
            className="text-xs h-8 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10"
          >
            <Edit2 className="w-3.5 h-3.5 mr-1.5" />
            {isTeamTemplateOpen ? 'Collapse Editor' : 'Edit Template & Preview'}
          </Button>
        </div>

        {/* Collapsed Preview */}
        {!isTeamTemplateOpen && (
          <div className="mt-3 p-2.5 rounded-xl bg-black/40 border border-white/5 font-mono text-[11px] text-slate-300 line-clamp-2">
            "{teamWhatsappTemplate}"
          </div>
        )}

        {/* Expanded Editor */}
        {isTeamTemplateOpen && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1.5">
                  Template Message Text
                </label>
                <textarea
                  value={teamWhatsappTemplate}
                  onChange={(e) => setTeamWhatsappTemplate(e.target.value)}
                  rows={4}
                  className="w-full text-xs font-sans p-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 block mb-1">Dynamic Variable Tags:</span>
                <div className="flex flex-wrap gap-1.5">
                  {['{recipient_name}', '{message}', '{priority}', '{sender_name}', '{date}'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTeamWhatsappTemplate((prev) => `${prev} ${tag}`)}
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
                    localStorage.setItem('gurukul_team_whatsapp_template', teamWhatsappTemplate);
                    toast.success('Team WhatsApp template saved!');
                  }}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  Save Template
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTeamWhatsappTemplate(DEFAULT_TEAM_TEMPLATE)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Reset Default
                </Button>
              </div>
            </div>

            {/* Live WhatsApp Bubble */}
            <div>
              <span className="text-xs font-bold text-slate-200 block mb-1.5">
                📱 Live Team Recipient WhatsApp Preview
              </span>
              <div className="p-3.5 rounded-2xl bg-[#0b141a] border border-[#222e35] text-xs font-sans text-slate-100">
                <div className="bg-[#005c4b] text-[#e9edef] p-3 rounded-xl rounded-tr-none shadow-sm space-y-1.5">
                  <p className="whitespace-pre-wrap leading-relaxed text-[12px]">
                    {teamWhatsappTemplate
                      .replace('{recipient_name}', 'Shri Patil (Jilapramukh)')
                      .replace('{message}', messageText.trim() || 'Notice to Team: A short coordination briefing will take place today.')
                      .replace('{priority}', priority)
                      .replace('{sender_name}', senderName.trim() || 'Academy Admin')
                      .replace('{date}', new Date().toLocaleDateString('en-IN'))}
                  </p>
                  <div className="flex items-center justify-end gap-1 text-[10px] text-[#8696a0]">
                    <span>09:45 AM</span>
                    <span className="text-[#53bdeb]">✓✓</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Main Grid: Team Contacts (Left) & Composer (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Team Contacts */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-5 border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Team Contacts ({filteredMembers.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {filteredMembers.length > 0 && filteredMembers.every((m) => selectedIds.includes(m.id))
                  ? 'Deselect In Group'
                  : 'Select All In Group'}
              </button>
            </div>

            {/* Search Input for Team Contacts */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search contacts by name, mobile, district, role..."
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              {memberSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMemberSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  ✕ Clear
                </button>
              )}
            </div>

            {/* Team Category Switcher (No Horizontal Sliding / Multi-Row Wrap + Quick Dropdown) */}
            <div className="space-y-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
              {/* Top Quick Dropdown & Count Row */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Team Filter:</span>
                </span>
                <select
                  value={activeCategory}
                  onChange={(e) => {
                    setActiveCategory(e.target.value);
                    if (e.target.value !== 'ALL') setRecipientRole(e.target.value);
                  }}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
                >
                  <option value="ALL">All Contacts ({teamMembers.length})</option>
                  {teams.map((t) => (
                    <option key={t.id || t.code} value={t.code}>
                      {t.marathi_name ? `${t.marathi_name} (${t.name})` : t.name} ({teamMembers.filter((m) => m.team_code === t.code || (m as any).team === t.code).length})
                    </option>
                  ))}
                </select>
              </div>

              {/* Multi-Row Wrap Team Pills (Visible at a glance, NO sliding!) */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveCategory('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                    activeCategory === 'ALL'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>सर्व संपर्क (All)</span>
                  <span className="text-[10px] opacity-80 px-1 py-0.2 rounded-full bg-black/20">
                    {teamMembers.length}
                  </span>
                </button>

                {teams.map((t) => {
                  const count = teamMembers.filter(
                    (m) => m.team_code === t.code || (m as any).team === t.code
                  ).length;
                  const isCurrent = activeCategory === t.code;

                  return (
                    <div key={t.id || t.code} className="inline-flex items-center rounded-lg border border-slate-200/80 dark:border-slate-700/80 overflow-hidden bg-white dark:bg-slate-800 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCategory(t.code);
                          setRecipientRole(t.code);
                        }}
                        className={`px-2 py-1 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          isCurrent
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                        title={t.description || t.name}
                      >
                        <span>{t.marathi_name || t.name}</span>
                        <span className="text-[10px] opacity-85 px-1 py-0.2 rounded-full bg-black/15">
                          {count}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditTeam(t);
                        }}
                        className="px-1.5 py-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 border-l border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                        title={`Edit team "${t.name}"`}
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTeam(t);
                        }}
                        className="px-1.5 py-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700 border-l border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                        title={`Delete team "${t.name}"`}
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setIsNewTeamModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-300 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 whitespace-nowrap cursor-pointer flex items-center gap-1"
                  title="Create a new team category"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ New Team</span>
                </button>
              </div>

              {/* Zero Teams Empty State */}
              {teams.length === 0 && (
                <div className="p-3 rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-950/20 text-center space-y-1.5">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    No custom teams yet. You can create teams (e.g. Pune Jilapramukh, Coaches, Staff) anytime!
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsNewTeamModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Create First Team</span>
                  </button>
                </div>
              )}
            </div>

            {filteredMembers.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No contacts in this team category. Click &quot;Add Team Member&quot; to assign contacts.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2 max-h-[420px] overflow-y-auto">
                {filteredMembers.map((member) => {
                  const isChecked = selectedIds.includes(member.id);
                  const memberTeam = teams.find(
                    (t) => t.code === member.team_code || t.code === (member as any).team
                  );

                  return (
                    <div
                      key={member.id}
                      onClick={() => handleToggleSelect(member.id)}
                      className={`p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by row click
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                        />
                        <div>
                          <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                            {member.name || <span className="text-slate-400 italic">No Name (Optional)</span>}
                            {member.team_code === 'JILAPRAMUKH' && (
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                जिल्हाप्रमुख {member.district ? `(${member.district})` : ''}
                              </span>
                            )}
                            {member.position && member.team_code !== 'JILAPRAMUKH' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {member.position}
                              </span>
                            )}
                            {memberTeam && member.team_code !== 'JILAPRAMUKH' && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/40 dark:border-indigo-800/40">
                                {memberTeam.marathi_name || memberTeam.name}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                            {member.phone}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMember(member.id);
                        }}
                        className="text-slate-400 hover:text-rose-500 p-1 transition-colors cursor-pointer"
                        title="Remove contact"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Direct Ad-hoc Number Input */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-3 space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Or Message Direct / Ad-hoc Phone Number:
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. +91 98765 43210"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Message Composer */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-5 border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Compose Team Bulletin &amp; Dispatch
                </h2>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                {selectedIds.length + (manualPhone ? 1 : 0)} Direct Contact(s)
              </span>
            </div>

            {/* Sender Name (Optional) */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Sender Name <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="e.g. Master Shihan / Academy Reception"
                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Target Role & Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Team Category
                </label>
                <Select
                  value={recipientRole}
                  onChange={(e) => setRecipientRole(e.target.value)}
                  className="h-9 text-xs"
                >
                  <option value="ALL_STAFF">सर्व संपर्क / All Team Contacts</option>
                  {teams.map((t) => (
                    <option key={t.id || t.code} value={t.code}>
                      {t.marathi_name ? `${t.marathi_name} (${t.name})` : t.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Priority Level
                </label>
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="h-9 text-xs"
                >
                  <option value="NORMAL">Normal Notice</option>
                  <option value="URGENT">Urgent Alert</option>
                  <option value="ANNOUNCEMENT">Announcement</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bulletin Subject <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Dojo Schedule"
                  className="w-full px-3 py-1.5 h-9 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Quick Templates */}
            <div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Quick Template Starters:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.label}
                    type="button"
                    onClick={() => {
                      setMessageText(tmpl.text);
                      setSubject(tmpl.subject);
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200/60 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    {tmpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Textarea */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Message Body *
              </label>
              <textarea
                rows={4}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your message to personal team / staff..."
                className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-sans leading-relaxed"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                <span>Database will store bulletin with sender &amp; role metadata.</span>
                <span>{messageText.length} characters</span>
              </div>
            </div>

            {/* Multi-slot Broadcast Scheduling */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  Delivery Timing:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBroadcastMode('NOW')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      broadcastMode === 'NOW'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Send Immediately
                  </button>
                  <button
                    type="button"
                    onClick={() => setBroadcastMode('SCHEDULED')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      broadcastMode === 'SCHEDULED'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Schedule Multi-Slot Times
                  </button>
                </div>
              </div>

              {broadcastMode === 'SCHEDULED' && (
                <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 block">
                    Configured Delivery Time Slots:
                  </span>
                  {scheduledTimes.map((time, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-indigo-400 w-12 flex-shrink-0">
                        Slot #{idx + 1}:
                      </span>
                      <input
                        type="datetime-local"
                        value={time}
                        onChange={(e) => {
                          const updated = [...scheduledTimes];
                          updated[idx] = e.target.value;
                          setScheduledTimes(updated);
                        }}
                        className="px-2.5 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono flex-1"
                      />
                      {scheduledTimes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setScheduledTimes(scheduledTimes.filter((_, i) => i !== idx))}
                          className="p-1 text-rose-400 hover:text-rose-600 rounded"
                          title="Remove slot"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      const lastTime = scheduledTimes[scheduledTimes.length - 1];
                      const nextDate = lastTime ? new Date(new Date(lastTime).getTime() + 86400000) : new Date(Date.now() + 86400000);
                      setScheduledTimes([...scheduledTimes, nextDate.toISOString().slice(0, 16)]);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline mt-1"
                  >
                    <Plus className="w-3 h-3" /> Add Another Schedule Slot
                  </button>
                </div>
              )}
            </div>

            {/* Dispatch Action */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setMessageText('');
                  setSubject('');
                }}
                className="text-xs cursor-pointer"
              >
                Clear
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleSaveDraft}
                disabled={savingDraft || !messageText.trim()}
                className="gap-1.5 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs font-bold cursor-pointer"
                title="Save this message as a draft to edit or dispatch later"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{savingDraft ? 'Saving Draft...' : 'Save as Draft'}</span>
              </Button>

              <Button
                type="button"
                onClick={handleDispatchAndSave}
                disabled={sending || !messageText.trim()}
                className={`gap-2 text-white font-bold text-xs cursor-pointer shadow-sm ${
                  broadcastMode === 'SCHEDULED'
                    ? 'bg-indigo-600 hover:bg-indigo-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {sending
                    ? 'Saving & Scheduling...'
                    : broadcastMode === 'SCHEDULED'
                    ? `Schedule Broadcast (${scheduledTimes.length} Slot${scheduledTimes.length === 1 ? '' : 's'})`
                    : 'Save Bulletin & Send Alert'}
                </span>
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Database Saved Broadcasts Section */}
      <Card className="p-5 border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Academy Team Broadcasts History ({dbMessages.length})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setHistoryTab('ALL')}
                className={`px-2 py-0.5 rounded ${historyTab === 'ALL' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'}`}
              >
                All ({dbMessages.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('SENT')}
                className={`px-2 py-0.5 rounded ${historyTab === 'SENT' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'}`}
              >
                Dispatched ({dbMessages.filter((m) => m.status !== 'DRAFT').length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('DRAFT')}
                className={`px-2 py-0.5 rounded ${historyTab === 'DRAFT' ? 'bg-amber-500 text-slate-950 font-extrabold shadow-xs' : 'text-amber-600 dark:text-amber-400'}`}
              >
                Drafts ({dbMessages.filter((m) => m.status === 'DRAFT').length})
              </button>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hidden sm:inline-block">
              Cloud Synced
            </span>
          </div>
        </div>

        {dbLoading ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading broadcasts...</div>
        ) : dbMessages.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No team bulletins published yet. Compose your first message above.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pt-1">
            {dbMessages
              .filter((msg) => {
                if (historyTab === 'SENT') return msg.status !== 'DRAFT';
                if (historyTab === 'DRAFT') return msg.status === 'DRAFT';
                return true;
              })
              .map((msg) => (
              <div
                key={msg.id}
                className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2 relative"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      {msg.sender_name || 'Gurukul Admin'}
                    </span>
                    {msg.sender_position && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200/40 dark:border-indigo-800/40">
                        {msg.sender_position}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {msg.status === 'DRAFT' && (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                        Draft
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        msg.priority === 'URGENT'
                          ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          : msg.priority === 'ANNOUNCEMENT'
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          : 'bg-slate-500/10 text-slate-400'
                      }`}
                    >
                      {msg.priority}
                    </span>
                    {msg.status === 'DRAFT' && (
                      <button
                        type="button"
                        onClick={() => handleLoadDraft(msg)}
                        className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                        title="Load this draft into the composer to edit or dispatch"
                      >
                        Edit Draft
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteDbMessage(msg.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 transition-colors cursor-pointer"
                      title="Delete bulletin"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {msg.subject && (
                  <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {msg.subject}
                  </div>
                )}

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                  {msg.message}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <span className="font-mono text-[10px] bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    To: {msg.recipient_role}
                  </span>
                  <span>{new Date(msg.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Dispatched Logs Card */}
      <Card className="p-5 border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Recent WhatsApp Dispatches Log
            </h2>
          </div>
          {dispatchLogs.length > 0 && (
            <button
              type="button"
              onClick={() => setDispatchLogs([])}
              className="text-xs text-slate-400 hover:text-rose-500 cursor-pointer"
            >
              Clear Logs
            </button>
          )}
        </div>

        {dispatchLogs.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No team WhatsApp dispatches logged in this session yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2 max-h-56 overflow-y-auto">
            {dispatchLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>{log.recipientName || 'Team Member'}</span>
                    <span className="font-mono text-slate-400 text-[11px]">{log.recipientPhone}</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 text-[11px] line-clamp-1">
                    &ldquo;{log.message}&rdquo;
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                      log.status === 'SENT'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {log.status === 'SENT' ? 'Delivered' : 'Failed'}
                  </span>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>


      {/* MODAL: Manage All Teams & Coordination Wings */}
      <Modal
        isOpen={isManageTeamsModalOpen}
        onClose={() => setIsManageTeamsModalOpen(false)}
        title="Manage All Teams & Coordination Groups"
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Overview of all active wings, district leadership, and assigned members.
            </p>
            <Button
              size="sm"
              onClick={() => {
                setIsManageTeamsModalOpen(false);
                setIsNewTeamModalOpen(true);
              }}
              className="gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Add New Team</span>
            </Button>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
            {teams.map((t) => {
              const memberCount = teamMembers.filter((m) => m.team_code === t.code || (m as any).team === t.code).length;

              return (
                <div key={t.id || t.code} className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{t.name}</span>
                      {t.marathi_name && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200/60 dark:border-indigo-800">
                          {t.marathi_name}
                        </span>
                      )}
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {t.code}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
                      <span><strong>{memberCount}</strong> assigned contact(s)</span>
                      {t.description && <span>• {t.description}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCategory(t.code);
                        setRecipientRole(t.code);
                        setIsManageTeamsModalOpen(false);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 cursor-pointer"
                    >
                      View Members
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                          setIsManageTeamsModalOpen(false);
                          handleOpenEditTeam(t);
                        }}
                        className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900/60 transition-colors cursor-pointer"
                        title="Edit this team"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTeam(t)}
                        className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 transition-colors cursor-pointer"
                        title="Delete this team"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setIsManageTeamsModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>


      {/* MODAL: Edit Team / Group */}
      <Modal isOpen={isEditTeamModalOpen} onClose={() => setIsEditTeamModalOpen(false)} title="Edit Team / Group">
        <form onSubmit={handleUpdateTeam} className="space-y-4">
          <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200">
            Edit details for team <strong>{editingTeam?.name}</strong>. Assigned contacts will automatically retain their membership.
          </div>

          <Input
            label="Team Name (English) *"
            required
            placeholder="e.g. Pune District Heads"
            value={editTeamForm.name}
            onChange={(e) => setEditTeamForm({ ...editTeamForm, name: e.target.value })}
          />

          <Input
            label="Regional / Marathi Name (Optional)"
            placeholder="उदा. पुणे जिल्हाप्रमुख"
            value={editTeamForm.marathiName}
            onChange={(e) => setEditTeamForm({ ...editTeamForm, marathiName: e.target.value })}
          />

          <Input
            label="Team Code / Short Tag *"
            required
            placeholder="e.g. PUNE_JP"
            value={editTeamForm.code}
            onChange={(e) => setEditTeamForm({ ...editTeamForm, code: e.target.value.toUpperCase() })}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Description</label>
            <textarea
              rows={2}
              value={editTeamForm.description}
              onChange={(e) => setEditTeamForm({ ...editTeamForm, description: e.target.value })}
              placeholder="What this team represents..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsEditTeamModalOpen(false)} disabled={savingEditTeam}>
              Cancel
            </Button>
            <Button type="submit" disabled={savingEditTeam} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold">
              {savingEditTeam ? 'Saving Changes...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Create New Team / Group */}
      <Modal isOpen={isNewTeamModalOpen} onClose={() => setIsNewTeamModalOpen(false)} title="Create New Team / Group">
        <form onSubmit={handleCreateTeam} className="space-y-4">
          <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200">
            Create a custom team or coordination wing (e.g. <strong>तालुकाप्रमुख</strong>, <strong>समिती</strong>, <strong>वैद्यकीय पथक</strong>, etc.) to organize team broadcasts.
          </div>

          <Input
            label="Team Name (English) *"
            required
            placeholder="e.g. Taluka Pramukh / Committee"
            value={newTeamForm.name}
            onChange={(e) => setNewTeamForm({ ...newTeamForm, name: e.target.value })}
          />

          <Input
            label="Marathi Name / Label (मराठी नाव - Optional)"
            placeholder="e.g. तालुकाप्रमुख / क्रीडा समिती"
            value={newTeamForm.marathiName}
            onChange={(e) => setNewTeamForm({ ...newTeamForm, marathiName: e.target.value })}
          />

          <Input
            label="Team Code / Identifier (Optional, e.g. TALUKA_PRAMUKH)"
            placeholder="Auto-generated if left blank"
            value={newTeamForm.code}
            onChange={(e) => setNewTeamForm({ ...newTeamForm, code: e.target.value.toUpperCase() })}
          />

          <Input
            label="Description / Purpose (Optional)"
            placeholder="e.g. Block coordinators for local dojo branches"
            value={newTeamForm.description}
            onChange={(e) => setNewTeamForm({ ...newTeamForm, description: e.target.value })}
          />

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsNewTeamModalOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" disabled={savingTeam} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer">
              {savingTeam ? 'Saving Team...' : 'Create Team'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Add Team Member */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add Team Contact">
        <form onSubmit={handleAddMember} className="space-y-4">
          <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200">
            <strong>टीप:</strong> नाव आणि पद ऐच्छिक (Optional) आहे. संदेश मिळवण्यासाठी फक्त मोबाईल / व्हॉट्सॲप नंबर आवश्यक आहे.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Team Classification / वर्गवारी *
            </label>
            <Select
              value={newMemberForm.team_code}
              onChange={(e) => setNewMemberForm({ ...newMemberForm, team_code: e.target.value })}
              className="h-9 text-xs"
            >
              {teams.map((t) => (
                <option key={t.id || t.code} value={t.code}>
                  {t.marathi_name ? `${t.marathi_name} (${t.name})` : t.name}
                </option>
              ))}
            </Select>
          </div>

          <Input
            label="WhatsApp / Mobile Number *"
            type="tel"
            required
            placeholder="e.g. +91 98765 43210"
            value={newMemberForm.phone}
            onChange={(e) => setNewMemberForm({ ...newMemberForm, phone: e.target.value })}
          />

          <Input
            label="Member Full Name (नाव - Optional)"
            placeholder="e.g. Shri Patil (Jilapramukh)"
            value={newMemberForm.name}
            onChange={(e) => setNewMemberForm({ ...newMemberForm, name: e.target.value })}
          />

          {newMemberForm.team_code === 'JILAPRAMUKH' && (
            <Input
              label="District / कार्यक्षेत्र जिल्हा (Optional)"
              placeholder="e.g. Ahmednagar / Pune / Satara"
              value={newMemberForm.district}
              onChange={(e) => setNewMemberForm({ ...newMemberForm, district: e.target.value })}
            />
          )}

          <Input
            label="Position / Role (पद - Optional)"
            placeholder="e.g. District Chief Coordinator / Head Coach"
            value={newMemberForm.position}
            onChange={(e) => setNewMemberForm({ ...newMemberForm, position: e.target.value })}
          />

          <Input
            label="Internal Notes (टीप - Optional)"
            placeholder="e.g. Available for district meetings"
            value={newMemberForm.notes}
            onChange={(e) => setNewMemberForm({ ...newMemberForm, notes: e.target.value })}
          />

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" disabled={savingMember} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer">
              {savingMember ? 'Saving Contact...' : 'Save Contact'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TeamMessagingPage;
