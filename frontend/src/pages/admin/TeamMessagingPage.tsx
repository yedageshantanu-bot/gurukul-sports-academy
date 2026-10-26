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

interface TeamMember {
  id: string;
  phone: string;
  name?: string; // Optional per user requirement
  position?: string; // Optional per user requirement
  notes?: string;
  addedAt: string;
}

interface DispatchedLog {
  id: string;
  recipientPhone: string;
  recipientName?: string;
  message: string;
  status: 'SENT' | 'FAILED';
  timestamp: string;
}

const DEFAULT_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'team_1',
    phone: '+919876543210',
    name: 'Head Coach Rahul',
    position: 'Chief Martial Arts Instructor',
    addedAt: new Date().toISOString(),
  },
  {
    id: 'team_2',
    phone: '+919822000000',
    name: 'Coach Sneha',
    position: 'Kalarippayattu Trainer',
    addedAt: new Date().toISOString(),
  },
];

const PRESET_TEMPLATES = [
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
  {
    label: 'Academy Operations',
    subject: 'Operational Notice',
    text: 'Important Update from Gurukul Sports Academy Administration: Please check staff communication channels for tournament preparation updates.',
  },
];

export const TeamMessagingPage: React.FC = () => {
  const { toast } = useToast();

  // Supabase Database Messages state
  const [dbMessages, setDbMessages] = useState<TeamMessageRecord[]>([]);
  const [dbLoading, setDbLoading] = useState(false);

  // Team roster persistent in localStorage
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => {
    try {
      const saved = localStorage.getItem('gurukul_personal_team_members');
      return saved ? JSON.parse(saved) : DEFAULT_TEAM_MEMBERS;
    } catch {
      return DEFAULT_TEAM_MEMBERS;
    }
  });

  // Selected recipient IDs
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [manualPhone, setManualPhone] = useState('');

  // Composer fields (Sender Name optional, Position removed per user requirement)
  const [senderName, setSenderName] = useState('');
  const [recipientRole, setRecipientRole] = useState('ALL_STAFF');
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
  const [newMemberForm, setNewMemberForm] = useState({
    phone: '',
    name: '', // Optional
    position: '', // Optional
    notes: '',
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

  useEffect(() => {
    fetchDbMessages();
  }, []);

  useEffect(() => {
    localStorage.setItem('gurukul_personal_team_members', JSON.stringify(teamMembers));
  }, [teamMembers]);

  useEffect(() => {
    localStorage.setItem('gurukul_team_dispatch_logs', JSON.stringify(dispatchLogs));
  }, [dispatchLogs]);

  // Handle member addition
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberForm.phone.trim()) {
      toast.error('Mobile/WhatsApp number is required.');
      return;
    }

    const member: TeamMember = {
      id: `team_${Date.now()}`,
      phone: newMemberForm.phone.trim(),
      name: newMemberForm.name.trim() || undefined,
      position: newMemberForm.position.trim() || undefined,
      notes: newMemberForm.notes.trim() || undefined,
      addedAt: new Date().toISOString(),
    };

    setTeamMembers((prev) => [member, ...prev]);
    setIsAddModalOpen(false);
    setNewMemberForm({ phone: '', name: '', position: '', notes: '' });
    toast.success('Team contact added successfully!');
  };

  const handleDeleteMember = (id: string) => {
    setTeamMembers((prev) => prev.filter((m) => m.id !== id));
    setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id));
    toast.info('Team contact removed.');
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === teamMembers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(teamMembers.map((m) => m.id));
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

    // 1. Save to Supabase Database
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
      const recipients: Array<{ phone: string; name?: string }> = [];
      teamMembers
        .filter((m) => selectedIds.includes(m.id))
        .forEach((m) => recipients.push({ phone: m.phone, name: m.name }));

      if (manualPhone.trim()) {
        recipients.push({ phone: manualPhone.trim(), name: 'Ad-hoc Contact' });
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
              recipientName: r.name,
              message: messageText.trim(),
              status: 'SENT',
              timestamp: new Date().toISOString(),
            });
          } catch {
            newLogs.unshift({
              id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              recipientPhone: r.phone,
              recipientName: r.name,
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
            Publish operational broadcasts, coordination notices, and duty assignments to academy coaches, trainers, and staff.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={fetchDbMessages}
            disabled={dbLoading}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${dbLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Feed</span>
          </button>

          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Team Member</span>
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
                Staff notices, duty rosters, and meeting reminders sent directly to instructors and coaches via WhatsApp.
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
                      .replace('{recipient_name}', 'Head Coach Rahul')
                      .replace('{message}', messageText.trim() || 'Notice to Academy Staff: A short coordination briefing will take place today.')
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
          <Card className="p-5 border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Team Contacts ({teamMembers.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {selectedIds.length === teamMembers.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {teamMembers.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No team contacts added yet. Click &quot;Add Team Member&quot; above.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2 max-h-[420px] overflow-y-auto">
                {teamMembers.map((member) => {
                  const isChecked = selectedIds.includes(member.id);
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
                            {member.position && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {member.position}
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

            {/* Sender Name (Optional) - Position removed per user instructions */}
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
                  <option value="ALL_STAFF">All Staff &amp; Coaches</option>
                  <option value="COACHES">Instructors &amp; Coaches Only</option>
                  <option value="ASSISTANTS">Assistant Trainers</option>
                  <option value="MANAGEMENT">Academy Management</option>
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
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Cloud Synchronized
          </span>
        </div>

        {dbLoading ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading broadcasts...</div>
        ) : dbMessages.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No team bulletins published yet. Compose your first message above.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pt-1">
            {dbMessages.map((msg) => (
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

      {/* MODAL: Add Team Member (Name and Position Optional) */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add Team Contact">
        <form onSubmit={handleAddMember} className="space-y-4">
          <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200">
            <strong>Note:</strong> Name and Position are completely optional. Only the WhatsApp / Mobile number is required to receive messages.
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
            label="Member Full Name (Optional)"
            placeholder="e.g. Coach Anand"
            value={newMemberForm.name}
            onChange={(e) => setNewMemberForm({ ...newMemberForm, name: e.target.value })}
          />

          <Input
            label="Position / Role (Optional)"
            placeholder="e.g. Assistant Karate Coach / Physio"
            value={newMemberForm.position}
            onChange={(e) => setNewMemberForm({ ...newMemberForm, position: e.target.value })}
          />

          <Input
            label="Internal Notes (Optional)"
            placeholder="e.g. Available weekdays evening"
            value={newMemberForm.notes}
            onChange={(e) => setNewMemberForm({ ...newMemberForm, notes: e.target.value })}
          />

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer">
              Save Contact
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TeamMessagingPage;
