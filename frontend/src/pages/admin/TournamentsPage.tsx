import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Plus,
  Search,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  CreditCard,
  ChevronRight,
  Award,
  Trash2,
  UserPlus,
  BookMarked,
} from 'lucide-react';
import { apiClient } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { useToast } from '../../contexts/ToastContext';

interface Tournament {
  id: string;
  title: string;
  name?: string;
  discipline_code: string;
  discipline?: string;
  venue: string;
  start_date: string;
  end_date: string;
  registration_deadline: string;
  entry_fee: number;
  status: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  description: string | null;
  created_at: string;
  registrationCount?: number;
  totalCollected?: number;
}

interface TournamentRegistration {
  id: string;
  tournament_id: string;
  student_id: string;
  student_name: string;
  contact_number: string;
  category: string | null;
  fee_amount: number;
  amount_paid: number;
  payment_status: 'PAID' | 'PENDING' | 'WAIVED';
  payment_method: string | null;
  selection_status: 'REGISTERED' | 'SELECTED' | 'CONFIRMED' | 'WITHDRAWN';
  whatsapp_notified: boolean;
  notified_at: string | null;
  created_at: string;
}

interface TournamentSummary {
  totalTournaments: number;
  upcomingCount: number;
  totalAthletesNominated: number;
  totalRevenueCollected: number;
  totalDuesPending: number;
}

export interface TournamentsPageProps {
  embedded?: boolean;
}

export const TournamentsPage: React.FC<TournamentsPageProps> = ({ embedded = false }) => {
  const { toast } = useToast();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [summary, setSummary] = useState<TournamentSummary>({
    totalTournaments: 0,
    upcomingCount: 0,
    totalAthletesNominated: 0,
    totalRevenueCollected: 0,
    totalDuesPending: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [disciplineFilter, setDisciplineFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected tournament for detail view & nominations
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isNominateModalOpen, setIsNominateModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedRegForPay, setSelectedRegForPay] = useState<TournamentRegistration | null>(null);

  // Form states - Create Tournament
  const [formData, setFormData] = useState({
    title: '',
    discipline_code: 'KALARIPPAYATTU',
    venue: '',
    start_date: '',
    end_date: '',
    registration_deadline: '',
    entry_fee: '1500',
    description: '',
  });

  // Nominate state - Academy Students roster
  const [academyStudents, setAcademyStudents] = useState<Array<{ id: string; fullName: string; contactNumber: string; courseName?: string }>>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [nominating, setNominating] = useState(false);
  const [nominateModalTab, setNominateModalTab] = useState<'nominate_new' | 'view_previous'>('nominate_new');

  // Payment settle state
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'UPI' | 'CASH' | 'RAZORPAY' | 'BANK_TRANSFER'>('UPI');
  const [payRef, setPayRef] = useState('');
  const [settling, setSettling] = useState(false);

  // WhatsApp notification loading state
  const [notifyingRegId, setNotifyingRegId] = useState<string | null>(null);

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const res = await apiClient<any>('/tournaments');
      const rawList = Array.isArray(res) ? res : res?.data || [];
      const list: Tournament[] = rawList.map((t: any) => ({
        ...t,
        id: t.id,
        title: t.title || t.name || 'Untitled Tournament',
        name: t.name || t.title || 'Untitled Tournament',
        discipline_code: t.discipline_code || t.discipline || 'KALARIPPAYATTU',
        venue: t.venue || 'Gurukul Sports Ground',
        start_date: t.start_date || t.tournament_date || '',
        end_date: t.end_date || t.tournament_date || '',
        registration_deadline: t.registration_deadline || t.tournament_date || '',
        entry_fee: Number(t.entry_fee || t.entryFee || 0),
        status: t.status || 'UPCOMING',
        description: t.description || null,
        created_at: t.created_at || '',
        registrationCount: Number(t.registrationCount ?? t.stats?.participants ?? 0),
        totalCollected: Number(t.totalCollected ?? t.stats?.collected ?? 0),
      }));
      setTournaments(list);
      if (res?.summary) {
        setSummary(res.summary);
      } else {
        const totalTournaments = list.length;
        const upcomingCount = list.filter((t) => t.status === 'UPCOMING').length;
        const totalAthletesNominated = list.reduce((acc, t) => acc + (t.registrationCount || 0), 0);
        const totalRevenueCollected = list.reduce((acc, t) => acc + (t.totalCollected || 0), 0);
        setSummary({
          totalTournaments,
          upcomingCount,
          totalAthletesNominated,
          totalRevenueCollected,
          totalDuesPending: 0,
        });
      }
    } catch (err) {
      console.error('Failed to load tournaments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistrations = async (tournamentId: string) => {
    try {
      setLoadingRegistrations(true);
      const res = await apiClient<any>(`/tournaments/${tournamentId}/registrations`);
      const rawList = Array.isArray(res)
        ? res
        : (Array.isArray(res?.data)
            ? res.data
            : (res?.data?.registrations || res?.registrations || []));
      const list: TournamentRegistration[] = (rawList || []).map((r: any) => ({
        ...r,
        id: r.id,
        tournament_id: r.tournament_id || tournamentId,
        student_id: r.student_id,
        student_name: r.student_name || r.students?.name || 'Athlete',
        contact_number: r.contact_number || r.students?.parent_whatsapp || r.students?.student_mobile || '',
        category: r.category || null,
        fee_amount: Number(r.fee_amount || 0),
        amount_paid: Number(r.amount_paid || 0),
        payment_status: r.payment_status || 'PENDING',
        payment_method: r.payment_method || null,
        selection_status: r.selection_status || 'REGISTERED',
        whatsapp_notified: Boolean(r.whatsapp_notified),
        notified_at: r.notified_at || null,
        created_at: r.created_at || '',
      }));
      setRegistrations(list);
    } catch (err) {
      console.error('Failed to load registrations:', err);
    } finally {
      setLoadingRegistrations(false);
    }
  };

  const fetchAcademyStudents = async () => {
    try {
      const res = await apiClient<any>('/students');
      const list = Array.isArray(res) ? res : res?.data || [];
      setAcademyStudents(
        list.map((s: any) => ({
          id: s.id,
          fullName: s.fullName || s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Student',
          contactNumber: s.contactNumber || s.phone || '',
          courseName: s.course?.title || s.batch?.name || '',
        }))
      );
    } catch (err) {
      console.error('Failed to load academy students:', err);
    }
  };

  useEffect(() => {
    fetchTournaments();
    fetchAcademyStudents();
  }, []);

  const handleSelectTournament = (tour: Tournament) => {
    setSelectedTournament(tour);
    fetchRegistrations(tour.id);
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.title,
        title: formData.title,
        discipline: formData.discipline_code,
        discipline_code: formData.discipline_code,
        venue: formData.venue,
        tournamentDate: formData.start_date,
        tournament_date: formData.start_date,
        start_date: formData.start_date,
        end_date: formData.end_date || formData.start_date,
        registration_deadline: formData.registration_deadline || formData.start_date,
        entry_fee: Number(formData.entry_fee) || 0,
        entryFee: Number(formData.entry_fee) || 0,
        description: formData.description,
      };

      await apiClient('/tournaments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setIsCreateModalOpen(false);
      setFormData({
        title: '',
        discipline_code: 'KALARIPPAYATTU',
        venue: '',
        start_date: '',
        end_date: '',
        registration_deadline: '',
        entry_fee: '1500',
        description: '',
      });
      fetchTournaments();
      toast.success(`Championship "${formData.title}" registered successfully!`);
    } catch (err: any) {
      console.error('Failed to create tournament:', err);
      toast.error(err.message || 'Could not register tournament. Check inputs.');
    }
  };

  const handleNominateStudents = async () => {
    if (!selectedTournament || selectedStudentIds.length === 0) return;
    const count = selectedStudentIds.length;
    try {
      setNominating(true);
      await apiClient(`/tournaments/${selectedTournament.id}/nominate`, {
        method: 'POST',
        body: JSON.stringify({
          studentIds: selectedStudentIds,
          notes: 'Nominated by Academy Selection Committee',
        }),
      });

      setSelectedStudentIds([]);
      await fetchRegistrations(selectedTournament.id);
      await fetchTournaments();
      toast.success(`Success! ${count} athletes nominated. Selection WhatsApp notices queued!`);
      // Switch tab so user sees all previously nominated athletes and can add more
      setNominateModalTab('view_previous');
    } catch (err) {
      console.error('Failed to nominate students:', err);
      toast.error('Error nominating athletes.');
    } finally {
      setNominating(false);
    }
  };

  const handleRemoveRegistration = async (registrationId: string) => {
    try {
      await apiClient(`/tournaments/registrations/${registrationId}`, {
        method: 'DELETE',
      });
      if (selectedTournament) {
        await fetchRegistrations(selectedTournament.id);
      }
      await fetchTournaments();
      toast.success('Athlete removed from tournament roster.');
    } catch (err: any) {
      console.error('Failed to remove athlete:', err);
      toast.error('Could not remove athlete from roster.');
    }
  };

  const handleSettlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegForPay) return;
    try {
      setSettling(true);
      const paid = Number(payAmount) || 0;
      const status = paid >= selectedRegForPay.fee_amount ? 'PAID' : 'PENDING';

      await apiClient(`/tournaments/registrations/${selectedRegForPay.id}/payment`, {
        method: 'PATCH',
        body: JSON.stringify({
          amount_paid: paid,
          payment_status: status,
          payment_method: payMethod,
          transaction_ref: payRef || undefined,
        }),
      });

      setIsPayModalOpen(false);
      setSelectedRegForPay(null);
      setPayAmount('');
      setPayRef('');
      if (selectedTournament) {
        fetchRegistrations(selectedTournament.id);
      }
      fetchTournaments();
      toast.success('Tournament registration fee settled successfully!');
    } catch (err) {
      console.error('Failed to settle tournament fee:', err);
      toast.error('Error updating payment.');
    } finally {
      setSettling(false);
    }
  };

  const handleSendWhatsAppNotification = async (registrationId: string) => {
    try {
      setNotifyingRegId(registrationId);
      await apiClient(`/tournaments/registrations/${registrationId}/notify`, {
        method: 'POST',
      });
      if (selectedTournament) {
        fetchRegistrations(selectedTournament.id);
      }
      toast.success('WhatsApp selection reminder queued successfully!');
    } catch (err) {
      console.error('Failed to dispatch notification:', err);
      toast.error('Failed to send WhatsApp alert.');
    } finally {
      setNotifyingRegId(null);
    }
  };

  const q = (searchTerm || '').trim().toLowerCase();
  const filteredTournaments = (tournaments || []).filter((t) => {
    const title = (t.title || t.name || '').toLowerCase();
    const venue = (t.venue || '').toLowerCase();
    const matchesSearch = !q || title.includes(q) || venue.includes(q);
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchesDiscipline = disciplineFilter === 'ALL' || t.discipline_code === disciplineFilter;
    return matchesSearch && matchesStatus && matchesDiscipline;
  });

  const sq = (studentSearchTerm || '').trim().toLowerCase();
  const unnominatedStudents = (academyStudents || []).filter(
    (s) => !(registrations || []).some((r) => r.student_id === s.id)
  );
  const filteredUnnominated = unnominatedStudents.filter(
    (s) => !sq || (s.fullName || '').toLowerCase().includes(sq) || (s.contactNumber || '').includes(sq) || (s.courseName || '').toLowerCase().includes(sq)
  );
  const filteredRegistrations = (registrations || []).filter(
    (r) => !sq || (r.student_name || '').toLowerCase().includes(sq) || (r.contact_number || '').includes(sq) || (r.selection_status || '').toLowerCase().includes(sq)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 3-Stream Segregated Fee Navigation Bar */}
      {!embedded && (
        <div className="p-3 bg-gradient-to-r from-slate-900 to-[#0F172A] border border-white/10 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fee Stream:</span>
            <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
              <Link
                to="/admin/fees"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 flex items-center gap-1.5 transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Academy Tuition Fees
              </Link>
              <Link
                to="/admin/publications"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 flex items-center gap-1.5 transition-colors"
              >
                <BookMarked className="w-3.5 h-3.5 text-blue-400" />
                Published Document Fees
                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-bold">Annual</span>
              </Link>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 shadow-sm flex items-center gap-1.5 cursor-default font-extrabold"
              >
                <Trophy className="w-3.5 h-3.5 text-slate-950" />
                Tournament Entry Fees
                <span className="text-[10px] bg-black/20 text-slate-950 px-1.5 py-0.5 rounded font-extrabold">Per Event</span>
              </button>
            </div>
          </div>

          <span className="text-xs text-slate-400 hidden lg:inline">
            Accounting Rule: Publication &amp; tournament revenues are fully segregated from recurring academy tuition.
          </span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
            <span>Competitions</span>
            <span>•</span>
            <span className="text-orange-400 font-semibold">Tournament Selection & Entries</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1 flex items-center gap-2.5">
            <Trophy className="w-7 h-7 text-amber-400" />
            Tournament Registrations & Athlete Roster
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Register state, national, and dojo championships, nominate academy athletes, dispatch WhatsApp alerts, and collect segregated tournament entry fees.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold shadow-lg shadow-orange-500/20"
          >
            <Plus className="w-4 h-4 mr-2" />
            Register Tournament
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4 bg-[#0F172A]/80 border-white/10 hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Championships</span>
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2">{summary.totalTournaments}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Scheduled on calendar</span>
        </Card>

        <Card className="p-4 bg-[#0F172A]/80 border-white/10 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Upcoming Events</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400 mt-2">{summary.upcomingCount}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Accepting nominations</span>
        </Card>

        <Card className="p-4 bg-[#0F172A]/80 border-white/10 hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nominated Athletes</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2">{summary.totalAthletesNominated}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Selected & WhatsApp informed</span>
        </Card>

        <Card className="p-4 bg-[#0F172A]/80 border-white/10 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fee Collected</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400 mt-2">₹{summary.totalRevenueCollected.toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Segregated tournament fund</span>
        </Card>

        <Card className="p-4 bg-[#0F172A]/80 border-white/10 hover:border-rose-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Dues</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-black text-rose-400 mt-2">₹{summary.totalDuesPending.toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-slate-400 mt-1 block">Unsettled athlete fees</span>
        </Card>
      </div>

      {/* Main Content Layout: Tournament Cards on Left, Athlete Roster Details on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Tournaments List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search championships, venue..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#0F172A] border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Status</option>
              <option value="UPCOMING">Upcoming</option>
              <option value="ONGOING">Ongoing</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <select
              value={disciplineFilter}
              onChange={(e) => setDisciplineFilter(e.target.value)}
              className="bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Arts</option>
              <option value="KALARIPPAYATTU">Kalari</option>
              <option value="KARATE_WUSHU">Karate+Wushu</option>
              <option value="BOTH">Both Arts</option>
            </select>
          </div>

          {loading ? (
            <div className="space-y-3">
              <SkeletonLoader rows={4} />
            </div>
          ) : filteredTournaments.length === 0 ? (
            <Card className="p-8 text-center bg-[#0F172A]/60 border-white/10">
              <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-300">No tournaments found</p>
              <p className="text-xs text-slate-500 mt-1">Register a new tournament to start nominating students.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredTournaments.map((tour) => {
                const isSelected = selectedTournament?.id === tour.id;
                return (
                  <div
                    key={tour.id}
                    onClick={() => handleSelectTournament(tour)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-amber-950/40 to-slate-900 border-amber-500/60 shadow-lg shadow-amber-500/10'
                        : 'bg-[#0F172A]/70 border-white/10 hover:border-white/20 hover:bg-[#0F172A]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            tour.discipline_code === 'KALARIPPAYATTU'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : tour.discipline_code === 'KARATE_WUSHU'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          }`}>
                            {(tour.discipline_code || 'GENERAL').replace('_', ' ')}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            tour.status === 'UPCOMING'
                              ? 'bg-blue-500/20 text-blue-300'
                              : tour.status === 'ONGOING'
                              ? 'bg-emerald-500/20 text-emerald-300 animate-pulse'
                              : 'bg-slate-700 text-slate-300'
                          }`}>
                            {tour.status || 'UPCOMING'}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white mt-1.5">{tour.title || tour.name || 'Untitled Tournament'}</h3>
                        <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-400 mt-2">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-amber-400" />
                            {tour.venue || 'Gurukul Main Dojo'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {tour.start_date ? new Date(tour.start_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBA'}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={`w-5 h-5 transition-transform ${isSelected ? 'text-amber-400 translate-x-1' : 'text-slate-600'}`} />
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-medium">Entry Fee:</span>
                        <span className="text-amber-400 font-bold">₹{Number(tour.entry_fee || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-300">
                        <Users className="w-3.5 h-3.5 text-blue-400" />
                        <span className="font-semibold">{tour.registrationCount || 0}</span>
                        <span className="text-slate-500">athletes</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Tournament Detail & Nominated Students */}
        <div className="lg:col-span-7">
          {selectedTournament ? (
            <Card className="p-6 bg-[#0F172A]/90 border-white/10 space-y-6">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {(selectedTournament.discipline_code || 'GENERAL').replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-400">
                      Deadline: {selectedTournament.registration_deadline ? new Date(selectedTournament.registration_deadline).toLocaleDateString('en-IN') : 'TBA'}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-white mt-1">{selectedTournament.title || selectedTournament.name || 'Untitled Tournament'}</h2>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    <span>{selectedTournament.venue || 'Gurukul Main Dojo'}</span>
                    <span>•</span>
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {selectedTournament.start_date ? new Date(selectedTournament.start_date).toLocaleDateString('en-IN') : 'Date TBA'}
                      {selectedTournament.end_date ? ` to ${new Date(selectedTournament.end_date).toLocaleDateString('en-IN')}` : ''}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      setSelectedStudentIds([]);
                      setIsNominateModalOpen(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2 px-3 shadow-md"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Nominate Athletes
                  </Button>
                </div>
              </div>

              {/* Tournament description if any */}
              {selectedTournament.description && (
                <div className="p-3 bg-slate-800/40 rounded-lg border border-white/5 text-xs text-slate-300">
                  <span className="font-semibold text-slate-200">Event Overview: </span>
                  {selectedTournament.description}
                </div>
              )}

              {/* Nominated Athletes Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    Nominated Athletes Roster ({registrations.length})
                  </h3>
                  <span className="text-xs text-slate-400">
                    Registration Fee: ₹{Number(selectedTournament.entry_fee || 0).toLocaleString('en-IN')} / athlete
                  </span>
                </div>

                {loadingRegistrations ? (
                  <SkeletonLoader rows={3} />
                ) : registrations.length === 0 ? (
                  <div className="p-8 text-center bg-slate-900/50 rounded-xl border border-white/5">
                    <Award className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-300">No athletes nominated yet</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Click "Nominate Athletes" to pick academy students. WhatsApp alerts will be sent automatically.
                    </p>
                    <Button
                      onClick={() => setIsNominateModalOpen(true)}
                      className="mt-3 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Nominate from Roster
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0A1120] text-slate-400 uppercase tracking-wider font-semibold border-b border-white/10">
                        <tr>
                          <th className="py-2.5 px-3">Athlete</th>
                          <th className="py-2.5 px-3">Selection</th>
                          <th className="py-2.5 px-3">Entry Fee</th>
                          <th className="py-2.5 px-3">WhatsApp Alert</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 bg-[#0F172A]/70">
                        {registrations.map((reg) => (
                          <tr key={reg.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-3">
                              <span className="font-bold text-white block">{reg.student_name}</span>
                              <span className="text-[11px] text-slate-400">{reg.contact_number || 'No contact'}</span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                <ShieldCheck className="w-3 h-3 text-amber-400" />
                                {reg.selection_status}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div>
                                <span className="font-semibold text-white">₹{reg.amount_paid}</span>
                                <span className="text-slate-500"> / ₹{reg.fee_amount}</span>
                              </div>
                              <span className={`text-[10px] font-bold uppercase ${
                                reg.payment_status === 'PAID'
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
                              }`}>
                                {reg.payment_status}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                {reg.whatsapp_notified ? (
                                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                    <CheckCircle2 className="w-3 h-3" /> Dispatched
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                                    <Clock className="w-3 h-3" /> Not Sent
                                  </span>
                                )}
                                <button
                                  title="Resend WhatsApp Selection Notice"
                                  onClick={() => handleSendWhatsAppNotification(reg.id)}
                                  disabled={notifyingRegId === reg.id}
                                  className="p-1 hover:bg-emerald-500/20 rounded text-emerald-400 transition-colors"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  onClick={() => {
                                    setSelectedRegForPay(reg);
                                    setPayAmount(String(reg.fee_amount - reg.amount_paid));
                                    setIsPayModalOpen(true);
                                  }}
                                  className="bg-slate-800 hover:bg-slate-700 text-white text-[11px] py-1 px-2.5 border border-white/10"
                                >
                                  <CreditCard className="w-3 h-3 mr-1 text-amber-400" />
                                  Settle Fee
                                </Button>
                                <button
                                  title="Remove athlete from squad"
                                  onClick={() => handleRemoveRegistration(reg.id)}
                                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-12 text-center bg-[#0F172A]/40 border-white/10 flex flex-col items-center justify-center min-h-[350px]">
              <Trophy className="w-16 h-16 text-slate-700 mb-4 animate-bounce" />
              <h3 className="text-lg font-bold text-white">Select a Tournament</h3>
              <p className="text-sm text-slate-400 max-w-sm mt-1">
                Click any tournament from the list on the left to view registered athletes, nominate new candidates, send WhatsApp alerts, and settle entry fees.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* MODAL 1: Create Tournament */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register New Tournament / Championship"
      >
        <form onSubmit={handleCreateTournament} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Championship Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Maharashtra State Kalarippayattu Championship 2026"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Discipline *</label>
              <select
                value={formData.discipline_code}
                onChange={(e) => setFormData({ ...formData, discipline_code: e.target.value })}
                className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              >
                <option value="KALARIPPAYATTU">Kalarippayattu</option>
                <option value="KARATE_WUSHU">Karate + Wushu</option>
                <option value="BOTH">Both (Kalarippayattu + Karate & Wushu)</option>
                <option value="ALL_DISCIPLINE">All Disciplines</option>
                <option value="GENERAL">General Athletics</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Entry Fee (₹) *</label>
              <input
                type="number"
                required
                min="0"
                value={formData.entry_fee}
                onChange={(e) => setFormData({ ...formData, entry_fee: e.target.value })}
                className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Venue / Stadium / City *</label>
            <input
              type="text"
              required
              placeholder="e.g. Balewadi Sports Complex, Pune"
              value={formData.venue}
              onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
              className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">End Date</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Deadline</label>
              <input
                type="date"
                value={formData.registration_deadline}
                onChange={(e) => setFormData({ ...formData, registration_deadline: e.target.value })}
                className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Event Rules / Guidelines</label>
            <textarea
              rows={2}
              placeholder="Weight categories, age brackets, required protective gear..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-amber-500 hover:bg-amber-600 text-white font-semibold"
            >
              Save Championship
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Nominate Athletes & View Roster */}
      <Modal
        isOpen={isNominateModalOpen}
        onClose={() => {
          setIsNominateModalOpen(false);
          setSelectedStudentIds([]);
        }}
        title={`Athlete Nomination: ${selectedTournament?.title || 'Tournament'}`}
      >
        <div className="space-y-4">
          {/* Top Tab Bar: Add More vs Previously Nominated */}
          <div className="flex items-center gap-2 p-1 bg-black/40 border border-white/10 rounded-xl">
            <button
              type="button"
              onClick={() => setNominateModalTab('nominate_new')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                nominateModalTab === 'nominate_new'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add More Athletes ({unnominatedStudents.length})
            </button>
            <button
              type="button"
              onClick={() => setNominateModalTab('view_previous')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                nominateModalTab === 'view_previous'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Previously Nominated ({registrations.length})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder={nominateModalTab === 'nominate_new' ? "Search available academy athletes..." : "Search previously nominated athletes..."}
              value={studentSearchTerm}
              onChange={(e) => setStudentSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#0F172A] border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* TAB 1: Nominate New Athletes */}
          {nominateModalTab === 'nominate_new' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Select athletes to register. WhatsApp notices will dispatch upon confirmation.</span>
                {filteredUnnominated.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedStudentIds.length === filteredUnnominated.length) {
                        setSelectedStudentIds([]);
                      } else {
                        setSelectedStudentIds(filteredUnnominated.map((s) => s.id));
                      }
                    }}
                    className="text-amber-400 hover:underline font-semibold shrink-0 ml-2"
                  >
                    {selectedStudentIds.length === filteredUnnominated.length ? 'Clear All' : 'Select All'}
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 border border-white/10 rounded-xl p-2 bg-[#0A1120]">
                {filteredUnnominated.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                    <p className="text-xs font-semibold text-slate-300">All matching students are already nominated!</p>
                    <button
                      type="button"
                      onClick={() => setNominateModalTab('view_previous')}
                      className="mt-2 text-xs text-amber-400 hover:underline font-bold"
                    >
                      View all {registrations.length} nominated athletes &rarr;
                    </button>
                  </div>
                ) : (
                  filteredUnnominated.map((student) => {
                    const isChecked = selectedStudentIds.includes(student.id);
                    return (
                      <label
                        key={student.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-amber-500/10 border-amber-500/40 text-white'
                            : 'bg-[#0F172A] border-white/5 hover:border-white/10 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStudentIds([...selectedStudentIds, student.id]);
                              } else {
                                setSelectedStudentIds(selectedStudentIds.filter((id) => id !== student.id));
                              }
                            }}
                            className="rounded border-white/20 text-amber-500 focus:ring-amber-500/30"
                          />
                          <div>
                            <span className="font-semibold text-xs text-white block">{student.fullName}</span>
                            <span className="text-[11px] text-slate-400">
                              {student.courseName || 'Academy Athlete'} • {student.contactNumber}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded font-semibold border border-amber-500/20">
                          Ready to Nominate
                        </span>
                      </label>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <span className="text-xs text-amber-400 font-semibold">
                  {selectedStudentIds.length} athletes selected
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsNominateModalOpen(false);
                      setSelectedStudentIds([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleNominateStudents}
                    disabled={selectedStudentIds.length === 0 || nominating}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                  >
                    {nominating ? 'Nominating...' : `Nominate & Send WhatsApp Alerts (${selectedStudentIds.length})`}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Previously Nominated Athletes */}
          {nominateModalTab === 'view_previous' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Athletes officially registered for {selectedTournament?.title}.</span>
                <button
                  type="button"
                  onClick={() => setNominateModalTab('nominate_new')}
                  className="text-amber-400 hover:underline font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Nominate more athletes
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 border border-white/10 rounded-xl p-2 bg-[#0A1120]">
                {filteredRegistrations.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No athletes currently registered</p>
                ) : (
                  filteredRegistrations.map((reg) => (
                    <div
                      key={reg.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-white/10 bg-[#0F172A] text-slate-200"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[11px]">
                          ✓
                        </div>
                        <div>
                          <span className="font-semibold text-xs text-white block">{reg.student_name}</span>
                          <span className="text-[11px] text-slate-400">{reg.contact_number || 'No contact'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          reg.payment_status === 'PAID'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {reg.payment_status === 'PAID' ? 'Fee Paid' : `₹${reg.fee_amount} Pending`}
                        </span>

                        {reg.whatsapp_notified ? (
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Notice Sent
                          </span>
                        ) : (
                          <button
                            title="Send WhatsApp Notice"
                            onClick={() => handleSendWhatsAppNotification(reg.id)}
                            disabled={notifyingRegId === reg.id}
                            className="p-1 hover:bg-emerald-500/20 rounded text-emerald-400 transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          title="Remove from Tournament"
                          onClick={() => handleRemoveRegistration(reg.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <span className="text-xs text-slate-400">
                  Total: <strong className="text-white">{registrations.length}</strong> athletes in squad
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => setNominateModalTab('nominate_new')}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add More Athletes
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsNominateModalOpen(false)}
                  >
                    Done
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL 3: Settle Fee */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title={`Settle Tournament Fee: ${selectedRegForPay?.student_name || ''}`}
      >
        <form onSubmit={handleSettlePayment} className="space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-200">
            Tournament Entry Fee: <strong>₹{selectedRegForPay?.fee_amount}</strong> | Already Paid: <strong>₹{selectedRegForPay?.amount_paid}</strong>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Amount to Settle (₹) *</label>
            <input
              type="number"
              required
              min="0"
              max={selectedRegForPay?.fee_amount}
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Payment Method *</label>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as any)}
              className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            >
              <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
              <option value="CASH">Cash at Dojo / Office</option>
              <option value="RAZORPAY">Razorpay Online Gateway</option>
              <option value="BANK_TRANSFER">Direct Bank Transfer / NEFT</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Transaction Ref / Receipt No.</label>
            <input
              type="text"
              placeholder="e.g. UPI Ref / Cash receipt ID"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPayModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={settling}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
            >
              {settling ? 'Updating...' : 'Confirm Fee Settlement'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
