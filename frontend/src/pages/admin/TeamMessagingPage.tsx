import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Trash2,
  Phone,
  UserPlus,
  FolderPlus,
  Search,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Building,
  UserCheck,
  Megaphone,
  Tag,
  Share2,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { apiClient } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

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

export interface TeamContact {
  id: string;
  name: string;
  phone: string;
  position?: string | null;
  district?: string | null;
  notes?: string | null;
}

const COLOR_OPTIONS = [
  { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30' },
  { id: 'amber', label: 'Amber', bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' },
  { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  { id: 'rose', label: 'Rose', bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30' },
  { id: 'blue', label: 'Blue', bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30' },
  { id: 'purple', label: 'Purple', bg: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30' },
];

const STORAGE_CONTACTS_KEY = 'gurukul_custom_team_contacts';

export const TeamMessagingPage: React.FC = () => {
  const { toast } = useToast();

  const [teams, setTeams] = useState<TeamCategory[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [savedContacts, setSavedContacts] = useState<TeamContact[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_CONTACTS_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignored
    }
    return [
      { id: 'c1', name: 'Sensei Vikram Salunkhe (Admin)', phone: '9881888061', position: 'Chief Director' },
      { id: 'c2', name: 'Shantanu', phone: '9881888061', position: 'Core Member' },
      { id: 'c3', name: 'Laj', phone: '9404849500', position: 'Core Member' },
      { id: 'c4', name: 'Kaustubh Team', phone: '+917350260261', position: 'Coordinator' },
    ];
  });

  const [loading, setLoading] = useState(true);

  // Active Tab: 'members' or 'teams'
  const [activeTab, setActiveTab] = useState<'members' | 'teams'>('members');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('ALL');
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');

  // Modals
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamCategory | null>(null);

  // Modal Contact Picker Search
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [showNewContactForm, setShowNewContactForm] = useState(false);

  // Form states - Member
  const [memberForm, setMemberForm] = useState({
    name: '',
    phone: '',
    teamCode: '',
    position: '',
    district: '',
    notes: '',
  });
  const [savingMember, setSavingMember] = useState(false);

  // Form states - Team
  const [teamForm, setTeamForm] = useState({
    name: '',
    code: '',
    marathiName: '',
    description: '',
    color: 'indigo',
  });
  const [savingTeam, setSavingTeam] = useState(false);

  // Save contacts to localStorage whenever updated
  const persistContact = (contact: TeamContact) => {
    setSavedContacts((prev) => {
      const cleanPhone = contact.phone.replace(/[^0-9+]/g, '');
      const existingIdx = prev.findIndex(
        (c) => c.phone.replace(/[^0-9+]/g, '') === cleanPhone || (c.name.trim().toLowerCase() === contact.name.trim().toLowerCase() && c.name.trim())
      );
      let updated: TeamContact[];
      if (existingIdx >= 0) {
        updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], ...contact };
      } else {
        updated = [contact, ...prev];
      }
      try {
        localStorage.setItem(STORAGE_CONTACTS_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn('Could not persist contacts:', err);
      }
      return updated;
    });
  };

  // Load Data: strictly teams and team members (no students or teachers)
  const fetchData = async () => {
    try {
      setLoading(true);
      const [teamsRes, membersRes] = await Promise.allSettled([
        apiClient<any>('/team-messages/teams'),
        apiClient<any>('/team-messages/members'),
      ]);

      let rawTeams: TeamCategory[] = [];
      if (teamsRes.status === 'fulfilled') {
        rawTeams = teamsRes.value?.data || (Array.isArray(teamsRes.value) ? teamsRes.value : []);
        setTeams(rawTeams);
        if (rawTeams.length > 0 && !memberForm.teamCode) {
          setMemberForm((prev) => ({ ...prev, teamCode: rawTeams[0].code }));
        }
      }

      if (membersRes.status === 'fulfilled') {
        const rawMembers: TeamMember[] = membersRes.value?.data || (Array.isArray(membersRes.value) ? membersRes.value : []);
        setTeamMembers(rawMembers);

        // Also aggregate any members from DB into saved contacts directory
        for (const m of rawMembers) {
          if (m.phone) {
            persistContact({
              id: m.id || `c-${m.phone}`,
              name: m.name || 'Member',
              phone: m.phone,
              position: m.position,
              district: m.district,
              notes: m.notes,
            });
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load team data:', err);
      toast.error('Could not load teams. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Map each contact to all teams they belong to
  const contactTeamsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const m of teamMembers) {
      const cleanPhone = m.phone.replace(/[^0-9+]/g, '');
      const existing = map.get(cleanPhone) || [];
      if (!existing.includes(m.team_code)) {
        existing.push(m.team_code);
      }
      map.set(cleanPhone, existing);
    }
    return map;
  }, [teamMembers]);

  // Unified contacts directory with team memberships
  const allDirectoryContacts = useMemo(() => {
    return savedContacts.map((c) => {
      const cleanPhone = c.phone.replace(/[^0-9+]/g, '');
      const memberTeams = contactTeamsMap.get(cleanPhone) || [];
      return {
        ...c,
        memberTeams,
      };
    });
  }, [savedContacts, contactTeamsMap]);

  // Filtered directory contacts for modal search
  const filteredDirectoryContacts = useMemo(() => {
    const sq = contactSearchQuery.trim().toLowerCase();
    if (!sq) return allDirectoryContacts;
    return allDirectoryContacts.filter(
      (c) =>
        c.name.toLowerCase().includes(sq) ||
        c.phone.includes(sq) ||
        (c.position || '').toLowerCase().includes(sq) ||
        (c.district || '').toLowerCase().includes(sq)
    );
  }, [allDirectoryContacts, contactSearchQuery]);

  // Filtered members for main list
  const q = memberSearchQuery.trim().toLowerCase();
  const filteredMembers = useMemo(() => {
    return teamMembers.filter((m) => {
      const matchesTeam = selectedTeamFilter === 'ALL' || m.team_code === selectedTeamFilter;
      if (!matchesTeam) return false;
      if (!q) return true;
      const nameMatch = (m.name || '').toLowerCase().includes(q);
      const phoneMatch = (m.phone || '').includes(q);
      const posMatch = (m.position || '').toLowerCase().includes(q);
      const districtMatch = (m.district || '').toLowerCase().includes(q);
      const codeMatch = (m.team_code || '').toLowerCase().includes(q);
      return nameMatch || phoneMatch || posMatch || districtMatch || codeMatch;
    });
  }, [teamMembers, selectedTeamFilter, q]);

  // Open Add Member Modal
  const handleOpenAddMemberModal = (preselectedTeamCode?: string, prefillContact?: TeamContact) => {
    const targetTeam = preselectedTeamCode || (selectedTeamFilter !== 'ALL' ? selectedTeamFilter : teams[0]?.code || '');
    if (prefillContact) {
      setMemberForm({
        name: prefillContact.name,
        phone: prefillContact.phone,
        teamCode: targetTeam,
        position: prefillContact.position || '',
        district: prefillContact.district || '',
        notes: prefillContact.notes || '',
      });
      setShowNewContactForm(true);
    } else {
      setMemberForm({
        name: '',
        phone: '',
        teamCode: targetTeam,
        position: '',
        district: '',
        notes: '',
      });
      setShowNewContactForm(false);
    }
    setContactSearchQuery('');
    setIsAddMemberModalOpen(true);
  };

  // Select contact from directory into modal
  const handleSelectDirectoryContact = (contact: TeamContact) => {
    setMemberForm((prev) => ({
      ...prev,
      name: contact.name,
      phone: contact.phone,
      position: contact.position || prev.position || '',
      district: contact.district || prev.district || '',
      notes: contact.notes || prev.notes || '',
    }));
    setShowNewContactForm(true);
    toast.success(`Selected "${contact.name}"! Confirm team below and save.`);
  };

  // Quick 1-click Add Self (Sensei Vikram Salunkhe)
  const handleAddSelfToForm = () => {
    const adminContact: TeamContact = {
      id: 'admin-self',
      name: 'Sensei Vikram Salunkhe (Admin)',
      phone: '9881888061',
      position: 'Chief Director & Head Coach',
      district: 'Satara / Pune',
      notes: 'Central Dojo Admin',
    };
    handleSelectDirectoryContact(adminContact);
  };

  // Save Member
  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.phone.trim()) {
      toast.error('WhatsApp / Phone number is required.');
      return;
    }
    if (!memberForm.teamCode) {
      toast.error('Please select a target team.');
      return;
    }

    try {
      setSavingMember(true);
      const res: any = await apiClient('/team-messages/members', {
        method: 'POST',
        body: JSON.stringify({
          name: memberForm.name.trim() || 'Member',
          phone: memberForm.phone.trim(),
          teamCode: memberForm.teamCode,
          position: memberForm.position.trim() || null,
          district: memberForm.district.trim() || null,
          notes: memberForm.notes.trim() || null,
        }),
      });

      const newMember: TeamMember = res?.data || {
        id: `mem-${Date.now()}`,
        name: memberForm.name.trim() || 'Member',
        phone: memberForm.phone.trim(),
        team_code: memberForm.teamCode,
        position: memberForm.position.trim() || null,
        district: memberForm.district.trim() || null,
        notes: memberForm.notes.trim() || null,
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
      };

      setTeamMembers((prev) => [newMember, ...prev]);

      // Save to directory
      persistContact({
        id: `c-${Date.now()}`,
        name: memberForm.name.trim() || 'Member',
        phone: memberForm.phone.trim(),
        position: memberForm.position.trim() || null,
        district: memberForm.district.trim() || null,
        notes: memberForm.notes.trim() || null,
      });

      setIsAddMemberModalOpen(false);
      toast.success(`"${memberForm.name || 'Member'}" added to team!`);
    } catch (err: any) {
      console.error('Failed to add member:', err);
      toast.error(err.message || 'Could not add member to team.');
    } finally {
      setSavingMember(false);
    }
  };

  // Delete Member
  const handleDeleteMember = async (member: TeamMember) => {
    const teamName = teams.find((t) => t.code === member.team_code)?.name || member.team_code;
    if (!window.confirm(`Remove ${member.name || 'this member'} from "${teamName}"?`)) {
      return;
    }

    try {
      await apiClient(`/team-messages/members/${member.id}`, {
        method: 'DELETE',
      });
      setTeamMembers((prev) => prev.filter((m) => m.id !== member.id));
      toast.success('Member removed from team.');
    } catch (err: any) {
      console.error('Failed to remove member:', err);
      toast.error('Could not remove member.');
    }
  };

  // Open Create/Edit Team Modal
  const handleOpenTeamModal = (team?: TeamCategory) => {
    if (team) {
      setEditingTeam(team);
      setTeamForm({
        name: team.name,
        code: team.code,
        marathiName: team.marathi_name || '',
        description: team.description || '',
        color: team.color || 'indigo',
      });
    } else {
      setEditingTeam(null);
      setTeamForm({
        name: '',
        code: '',
        marathiName: '',
        description: '',
        color: 'indigo',
      });
    }
    setIsTeamModalOpen(true);
  };

  // Save Team
  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamForm.name.trim()) {
      toast.error('Team name is required.');
      return;
    }

    try {
      setSavingTeam(true);
      if (editingTeam) {
        const res: any = await apiClient(`/team-messages/teams/${editingTeam.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: teamForm.name.trim(),
            code: teamForm.code.trim(),
            marathiName: teamForm.marathiName.trim() || null,
            description: teamForm.description.trim() || null,
            color: teamForm.color,
          }),
        });
        const updated = res?.data || {
          ...editingTeam,
          name: teamForm.name,
          code: teamForm.code,
          marathi_name: teamForm.marathiName,
          description: teamForm.description,
          color: teamForm.color,
        };
        setTeams((prev) => prev.map((t) => (t.id === editingTeam.id ? updated : t)));
        toast.success(`Team "${teamForm.name}" updated!`);
      } else {
        const res: any = await apiClient('/team-messages/teams', {
          method: 'POST',
          body: JSON.stringify({
            name: teamForm.name.trim(),
            code: teamForm.code.trim() || undefined,
            marathiName: teamForm.marathiName.trim() || null,
            description: teamForm.description.trim() || null,
            color: teamForm.color,
          }),
        });
        const created = res?.data || {
          id: `team-${Date.now()}`,
          name: teamForm.name,
          code: teamForm.code || teamForm.name.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
          marathi_name: teamForm.marathiName,
          description: teamForm.description,
          color: teamForm.color,
          created_at: new Date().toISOString(),
        };
        setTeams((prev) => [...prev, created]);
        toast.success(`Team "${teamForm.name}" created!`);
      }
      setIsTeamModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save team:', err);
      toast.error(err.message || 'Could not save team.');
    } finally {
      setSavingTeam(false);
    }
  };

  // Delete Team
  const handleDeleteTeam = async (team: TeamCategory) => {
    const memberCount = teamMembers.filter((m) => m.team_code === team.code).length;
    if (
      !window.confirm(
        `Are you sure you want to delete team "${team.name}"? This team has ${memberCount} enrolled member(s).`
      )
    ) {
      return;
    }

    try {
      await apiClient(`/team-messages/teams/${team.id}`, { method: 'DELETE' });
      setTeams((prev) => prev.filter((t) => t.id !== team.id));
      setTeamMembers((prev) => prev.filter((m) => m.team_code !== team.code));
      if (selectedTeamFilter === team.code) setSelectedTeamFilter('ALL');
      toast.success(`Team "${team.name}" deleted.`);
    } catch (err: any) {
      console.error('Failed to delete team:', err);
      toast.error('Could not delete team.');
    }
  };

  const getTeamColorClass = (color?: string | null) => {
    const found = COLOR_OPTIONS.find((c) => c.id === color);
    return found ? found.bg : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Administration</span>
            <span>•</span>
            <span className="text-amber-600 dark:text-amber-400">Squads &amp; Contacts</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1 flex items-center gap-2.5">
            <Users className="w-7 h-7 text-amber-500 dark:text-amber-400" />
            Teams &amp; Contacts Hub
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Dedicated team directory for custom groups (e.g. Friends group, Partners, Committee). Add any contact to multiple teams with quick search. Broadcast directly from Announcements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/admin/announcements"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-300 dark:border-indigo-500/30 flex items-center gap-2 transition-all shadow-xs"
          >
            <Megaphone className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            <span>Broadcast via Announcements</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Button
            onClick={() => handleOpenTeamModal()}
            variant="outline"
            className="text-xs font-semibold flex items-center gap-1.5"
          >
            <FolderPlus className="w-4 h-4 text-amber-500" />
            New Team
          </Button>
          <Button
            onClick={() => handleOpenAddMemberModal()}
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-orange-500/20"
          >
            <UserPlus className="w-4 h-4" />
            Add Member to Team
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white dark:bg-[#0F172A]/80 border-slate-200 dark:border-white/10 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Teams</span>
            <Building className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">{teams.length}</p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Active custom teams &amp; squads</span>
        </Card>

        <Card className="p-4 bg-white dark:bg-[#0F172A]/80 border-slate-200 dark:border-white/10 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Team Enrollments</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{teamMembers.length}</p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Assigned positions across squads</span>
        </Card>

        <Card className="p-4 bg-white dark:bg-[#0F172A]/80 border-slate-200 dark:border-white/10 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Unique Contacts</span>
            <ShieldCheck className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">{savedContacts.length}</p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Searchable across all teams</span>
        </Card>

        <Card className="p-4 bg-white dark:bg-[#0F172A]/80 border-slate-200 dark:border-white/10 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Broadcast Ready</span>
            <Sparkles className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-2">100%</p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">Scheduled directly in Announcements</span>
        </Card>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'members'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Team Members ({teamMembers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('teams')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'teams'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <FolderPlus className="w-4 h-4" />
            <span>Manage Teams ({teams.length})</span>
          </button>
        </div>

        <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
          No students or teachers here — purely dedicated custom teams &amp; contacts.
        </span>
      </div>

      {/* TAB 1: Team Members Roster */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {/* Team Filter Pills + Quick Search */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-black/40 rounded-xl border border-slate-200 dark:border-white/5 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedTeamFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  selectedTeamFilter === 'ALL'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All Members ({teamMembers.length})
              </button>
              {teams.map((t) => {
                const count = teamMembers.filter((m) => m.team_code === t.code).length;
                const isActive = selectedTeamFilter === t.code;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTeamFilter(t.code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>{t.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Prominent Search Bar */}
            <div className="relative min-w-[280px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search member (e.g. Shantanu, Laj, phone)..."
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 shadow-xs"
              />
            </div>
          </div>

          {/* Members Cards / List ("sutta-sutta sabka dikhega") */}
          {loading ? (
            <Card className="p-8 text-center text-slate-500 dark:text-slate-400">Loading team members...</Card>
          ) : filteredMembers.length === 0 ? (
            <Card className="p-8 text-center bg-white dark:bg-[#0F172A]/70 border-slate-200 dark:border-white/10 shadow-xs">
              <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No members found</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {selectedTeamFilter !== 'ALL'
                  ? `No members enrolled in "${selectedTeamFilter}" yet.`
                  : 'Start by adding Shantanu, Laj, or any custom contacts into your teams.'}
              </p>
              <Button
                onClick={() => handleOpenAddMemberModal(selectedTeamFilter !== 'ALL' ? selectedTeamFilter : undefined)}
                className="mt-3 text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                Add Member to Team
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredMembers.map((member) => {
                const team = teams.find((t) => t.code === member.team_code);
                const cleanPhone = member.phone.replace(/[^0-9+]/g, '');
                const allTeamsForMember = contactTeamsMap.get(cleanPhone) || [member.team_code];
                const otherTeams = allTeamsForMember.filter((code) => code !== member.team_code);

                return (
                  <Card
                    key={member.id}
                    className="p-4 bg-white dark:bg-[#0F172A]/80 border-slate-200 dark:border-white/10 hover:border-amber-500/40 transition-all shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Header: Avatar + Name + Team Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                            {(member.name || 'M').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                              {member.name || 'Unnamed Member'}
                            </h4>
                            <a
                              href={`https://wa.me/${cleanPhone.replace('+', '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-mono flex items-center gap-1 mt-0.5"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{member.phone}</span>
                            </a>
                          </div>
                        </div>

                        {/* Current Team Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getTeamColorClass(
                            team?.color
                          )} shrink-0`}
                        >
                          {team?.name || member.team_code}
                        </span>
                      </div>

                      {/* Role & District Details */}
                      <div className="mt-3 space-y-1 text-xs">
                        {member.position && (
                          <div className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
                            <Tag className="w-3 h-3 text-amber-500 shrink-0" />
                            <span>{member.position}</span>
                          </div>
                        )}
                        {member.district && (
                          <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                            Area: {member.district}
                          </div>
                        )}
                        {member.notes && (
                          <div className="text-slate-400 dark:text-slate-500 text-[11px] italic">
                            &quot;{member.notes}&quot;
                          </div>
                        )}
                      </div>

                      {/* Multi-Team Indicator: Shows if Shantanu is also in other teams */}
                      {otherTeams.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-white/5">
                          <span className="text-[10px] text-slate-400 font-semibold block mb-1">
                            Also enrolled in:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {otherTeams.map((otherCode) => {
                              const otherTeam = teams.find((t) => t.code === otherCode);
                              return (
                                <span
                                  key={otherCode}
                                  className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-700"
                                >
                                  {otherTeam?.name || otherCode}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenAddMemberModal(undefined, {
                            id: member.id,
                            name: member.name || '',
                            phone: member.phone,
                            position: member.position,
                            district: member.district,
                            notes: member.notes,
                          })
                        }
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                        title="Add this contact to another team as well"
                      >
                        <Share2 className="w-3 h-3" />
                        <span>Add to Another Team</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteMember(member)}
                        className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                        title="Remove from this team"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Manage Teams Directory */}
      {activeTab === 'teams' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              Create, rename, or color-code your custom squads.
            </span>
            <Button
              onClick={() => handleOpenTeamModal()}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              New Team
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {teams.map((team) => {
              const membersCount = teamMembers.filter((m) => m.team_code === team.code).length;
              return (
                <Card
                  key={team.id}
                  className="p-4 bg-white dark:bg-[#0F172A]/80 border-slate-200 dark:border-white/10 hover:border-amber-500/30 transition-all shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full border ${getTeamColorClass(team.color)}`} />
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{team.name}</h4>
                      </div>
                      <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {team.code}
                      </span>
                    </div>

                    {team.marathi_name && (
                      <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1">
                        {team.marathi_name}
                      </div>
                    )}

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                      {team.description || 'Dedicated custom team for broadcasting and management.'}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-amber-500" />
                      {membersCount} {membersCount === 1 ? 'Member' : 'Members'}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTeamFilter(team.code);
                          setActiveTab('members');
                        }}
                        className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        View Members <ArrowRight className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteTeam(team)}
                        className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                        title="Delete team"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL 1: Add Member to Team */}
      <Modal
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        title="Add Member to Team"
        maxWidth="md"
      >
        <div className="space-y-4">
          {/* Quick "Add Self / Admin" Banner */}
          <div className="p-3 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent border border-amber-500/30 rounded-xl flex items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-amber-500" />
                Add Sensei Vikram Salunkhe (Self/Admin)?
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                1-click populate with Phone: 9881888061.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleAddSelfToForm}
              className="text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 py-1 px-3 shadow-xs"
            >
              Select Self
            </Button>
          </div>

          {/* STEP 1: Pick from Existing Contacts (Shantanu, Laj, etc.) */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-amber-500" />
                <span>Search &amp; Pick Contact (Shantanu, Laj, etc.)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowNewContactForm(!showNewContactForm)}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                {showNewContactForm ? 'Hide Form' : '+ New Person Form'}
              </button>
            </div>

            {/* Small Search Bar on Top */}
            <input
              type="text"
              placeholder="Search contacts by name (e.g. Shantanu, Laj) or phone..."
              value={contactSearchQuery}
              onChange={(e) => setContactSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 shadow-xs"
            />

            {/* Directory List of Contacts */}
            <div className="max-h-44 overflow-y-auto space-y-1.5 pt-1 pr-1 border-t border-slate-200 dark:border-white/5">
              {filteredDirectoryContacts.length === 0 ? (
                <div className="py-3 text-center">
                  <p className="text-xs text-slate-500">No contact matching &quot;{contactSearchQuery}&quot;</p>
                  <button
                    type="button"
                    onClick={() => {
                      setMemberForm((prev) => ({ ...prev, name: contactSearchQuery }));
                      setShowNewContactForm(true);
                    }}
                    className="mt-1 text-xs text-amber-600 dark:text-amber-400 font-bold hover:underline"
                  >
                    + Add &quot;{contactSearchQuery}&quot; as New Contact
                  </button>
                </div>
              ) : (
                filteredDirectoryContacts.map((contact) => {
                  const targetTeamCode = memberForm.teamCode;
                  const isAlreadyInTarget = contact.memberTeams.includes(targetTeamCode);

                  return (
                    <div
                      key={contact.id}
                      className="p-2 rounded-lg bg-white dark:bg-[#0A1120] border border-slate-200 dark:border-white/5 hover:border-amber-500/40 flex items-center justify-between text-xs transition-all shadow-2xs"
                    >
                      <div className="truncate mr-2">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                          <span>{contact.name}</span>
                          <span className="text-[11px] text-slate-500 font-mono font-normal">
                            ({contact.phone})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {contact.position && (
                            <span className="text-[10px] text-slate-400">{contact.position} • </span>
                          )}
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            Teams: {contact.memberTeams.length > 0 ? contact.memberTeams.join(', ') : 'None yet'}
                          </span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSelectDirectoryContact(contact)}
                        className={`text-[11px] font-bold py-1 px-2.5 h-auto shrink-0 ${
                          isAlreadyInTarget
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                            : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                        }`}
                      >
                        {isAlreadyInTarget ? 'Select Again' : 'Pick +'}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Member Details Form */}
          <form onSubmit={handleSaveMember} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Target Team / Squad *
              </label>
              <select
                required
                value={memberForm.teamCode}
                onChange={(e) => setMemberForm({ ...memberForm, teamCode: e.target.value })}
                className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-xs font-semibold"
              >
                {teams.length === 0 && <option value="">-- No Teams Created Yet --</option>}
                {teams.map((t) => (
                  <option key={t.id} value={t.code}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shantanu, Laj"
                  value={memberForm.name}
                  onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                  className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-xs font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  WhatsApp / Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9881888061"
                  value={memberForm.phone}
                  onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                  className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-amber-500 shadow-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Position / Role (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Coordinator, Partner, Member"
                  value={memberForm.position}
                  onChange={(e) => setMemberForm({ ...memberForm, position: e.target.value })}
                  className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  District / Area (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Satara, Pune, Karad"
                  value={memberForm.district}
                  onChange={(e) => setMemberForm({ ...memberForm, district: e.target.value })}
                  className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-white/10">
              <Button type="button" variant="outline" onClick={() => setIsAddMemberModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingMember}
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs"
              >
                {savingMember ? 'Adding...' : 'Save & Add to Team'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* MODAL 2: Create / Edit Team */}
      <Modal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        title={editingTeam ? `Edit Team: ${editingTeam.name}` : 'Create New Team / Squad'}
        maxWidth="sm"
      >
        <form onSubmit={handleSaveTeam} className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Team Name (English) *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Friends Group, Core Partners, Marketing"
              value={teamForm.name}
              onChange={(e) => {
                const name = e.target.value;
                setTeamForm({
                  ...teamForm,
                  name,
                  code: editingTeam ? teamForm.code : name.toUpperCase().replace(/[^A-Z0-9_]/g, '_').substring(0, 24),
                });
              }}
              className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-xs font-semibold"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Marathi Name / Title (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. मित्र परिवार, कोअर टीम"
              value={teamForm.marathiName}
              onChange={(e) => setTeamForm({ ...teamForm, marathiName: e.target.value })}
              className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Team System Code (Uppercase) *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. FRIENDS_GROUP"
              value={teamForm.code}
              onChange={(e) => setTeamForm({ ...teamForm, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') })}
              className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-amber-500 shadow-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Brief description of this group..."
              value={teamForm.description}
              onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
              className="w-full bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 shadow-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Badge Color Accent
            </label>
            <div className="flex items-center gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setTeamForm({ ...teamForm, color: c.id })}
                  className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer ${
                    teamForm.color === c.id ? 'border-amber-500 scale-110 shadow-sm' : 'border-transparent'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-md ${c.bg}`} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-white/10">
            <Button type="button" variant="outline" onClick={() => setIsTeamModalOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={savingTeam}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs"
            >
              {savingTeam ? 'Saving...' : editingTeam ? 'Update Team' : 'Create Team'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
