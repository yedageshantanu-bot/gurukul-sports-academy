import React, { useState, useEffect } from 'react';
import {
  Users,
  Send,
  MessageSquare,
  Plus,
  Trash2,
  Clock,
  Phone,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { apiClient } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

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
    text: 'Notice to Academy Staff: A short coordination briefing will take place today at [Time] on the dojo floor. Please ensure timely presence.',
  },
  {
    label: 'Batch Schedule Update',
    text: 'Attention Team: Training batch timings for Kalarippayattu & Karate have been adjusted for this week. Please review your assigned batches.',
  },
  {
    label: 'Duty & Roll Call Reminder',
    text: 'Duty Alert: Coaches & assistants are requested to mark daily student attendance sheets promptly and verify training safety equipment.',
  },
  {
    label: 'Academy Operations Notice',
    text: 'Important Update from Gurukul Sports Academy Administration: Please check the staff group for operational notices regarding upcoming events.',
  },
];

export const TeamMessagingPage: React.FC = () => {
  const { toast } = useToast();

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

  // Composer
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  // Modal: Add Team Member
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newMemberForm, setNewMemberForm] = useState({
    phone: '',
    name: '', // Optional
    position: '', // Optional
    notes: '',
  });

  // Dispatched Logs
  const [dispatchLogs, setDispatchLogs] = useState<DispatchedLog[]>(() => {
    try {
      const saved = localStorage.getItem('gurukul_team_dispatch_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

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

  // Dispatch WhatsApp to selected team members
  const handleSendMessage = async () => {
    if (!messageText.trim()) {
      toast.error('Please enter a message to send.');
      return;
    }

    const recipients: Array<{ phone: string; name?: string }> = [];

    // From selected team members
    teamMembers
      .filter((m) => selectedIds.includes(m.id))
      .forEach((m) => recipients.push({ phone: m.phone, name: m.name }));

    // From manual ad-hoc phone
    if (manualPhone.trim()) {
      recipients.push({ phone: manualPhone.trim(), name: 'Ad-hoc Contact' });
    }

    if (recipients.length === 0) {
      toast.error('Please select at least one team member or enter a phone number.');
      return;
    }

    setSending(true);
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
      } catch (err: any) {
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
    setSending(false);

    if (successCount > 0) {
      toast.success(`WhatsApp message sent to ${successCount} team recipient(s)!`);
      setMessageText('');
      setManualPhone('');
    } else {
      toast.error('Failed to dispatch message to recipients.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Message Personal Team
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Broadcast operational alerts, meeting reminders, and duty schedules to your coaches, trainers, and academy staff.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold shadow-xs">
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>WhatsApp Gateway Ready</span>
          </div>

          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Team Member</span>
          </Button>
        </div>
      </div>

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
                          <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
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
                  Compose WhatsApp Message
                </h2>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                {selectedIds.length + (manualPhone ? 1 : 0)} Recipient(s) Selected
              </span>
            </div>

            {/* Quick Templates */}
            <div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                Quick Template Starters:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.label}
                    type="button"
                    onClick={() => setMessageText(tmpl.text)}
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
                rows={6}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your message to personal team / staff..."
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-sans leading-relaxed"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                <span>Tip: Use *bold* or _italic_ for WhatsApp emphasis.</span>
                <span>{messageText.length} characters</span>
              </div>
            </div>

            {/* Dispatch Action */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMessageText('')}
                className="text-xs cursor-pointer"
              >
                Clear
              </Button>

              <Button
                type="button"
                onClick={handleSendMessage}
                disabled={sending || (!selectedIds.length && !manualPhone.trim()) || !messageText.trim()}
                className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sending ? 'Sending WhatsApp...' : `Dispatch to ${selectedIds.length + (manualPhone ? 1 : 0)} Contact(s)`}</span>
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Dispatched Logs Card */}
      <Card className="p-5 border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Recent Team Dispatches Log
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
            No team messages sent in this session yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2 max-h-64 overflow-y-auto">
            {dispatchLogs.map((log) => (
              <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>{log.recipientName || 'Team Member'}</span>
                    <span className="font-mono text-slate-400 text-[11px]">{log.recipientPhone}</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 text-[11px] line-clamp-2">
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
            <strong>Note:</strong> Name and Position are optional. Only the WhatsApp / Mobile number is required to receive messages.
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
