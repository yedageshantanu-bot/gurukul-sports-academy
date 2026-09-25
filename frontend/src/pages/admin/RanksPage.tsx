import React, { useState, useEffect } from 'react';
import {
  Award,
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  Printer,
  Sparkles,
  ShieldAlert,
  UserCheck,
  FileText,
  Layers,
  Medal,
} from 'lucide-react';
import { apiClient } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { useToast } from '../../contexts/ToastContext';

interface MartialRank {
  id: string;
  discipline_code: string;
  rank_order: number;
  rank_name: string;
  belt_color: string;
  description: string | null;
}

interface StudentRank {
  id: string;
  student_id: string;
  student_name: string;
  student_code?: string;
  dob?: string;
  contact_number: string;
  discipline_code: string;
  discipline_name?: string;
  current_rank_name: string;
  belt_color: string;
  rank_order: number;
  promoted_at: string;
  certificate_number: string | null;
  nextRank?: MartialRank | null;
}

interface CertificateRecord {
  id: string;
  student_id: string;
  student_name: string;
  student_code: string;
  dob: string;
  contact_number: string;
  discipline_code: string;
  discipline_name: string;
  from_rank_name: string | null;
  to_rank_name: string;
  belt_color: string;
  promoted_at: string;
  certificate_number: string;
  examiner_name: string;
  represented_from: string;
  notes: string | null;
}

export const RanksPage: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'STUDENTS' | 'CERTIFICATES' | 'CURRICULUM'>('STUDENTS');
  const [studentRanks, setStudentRanks] = useState<StudentRank[]>([]);
  const [allRanks, setAllRanks] = useState<MartialRank[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('ALL');

  // Certificate Registry Date Filter States (The specific feature twist requested by user)
  const [certStartDate, setCertStartDate] = useState('');
  const [certEndDate, setCertEndDate] = useState('');
  const [certDisciplineFilter, setCertDisciplineFilter] = useState('ALL');
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(false);

  // Modals
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [selectedStudentForPromotion, setSelectedStudentForPromotion] = useState<StudentRank | null>(null);
  const [promotionTargetRankId, setPromotionTargetRankId] = useState('');
  const [examinerName, setExaminerName] = useState('Chief Master (Gurukul Academy)');
  const [representedFrom, setRepresentedFrom] = useState('Gurukul Sports Academy Central Dojo');
  const [promoting, setPromoting] = useState(false);

  // Assign Student Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [academyStudents, setAcademyStudents] = useState<Array<{ id: string; fullName: string; contactNumber: string; dob?: string }>>([]);
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignDiscipline, setAssignDiscipline] = useState('KALARIPPAYATTU');
  const [assignRankName, setAssignRankName] = useState('Beginner');

  // Preview Certificate Modal
  const [previewCert, setPreviewCert] = useState<CertificateRecord | null>(null);

  // Fetch initial student ranks
  const fetchStudentRanks = async () => {
    try {
      setLoading(true);
      const res = await apiClient<any>('/ranks/students');
      const list = Array.isArray(res) ? res : res?.data || [];
      setStudentRanks(list);
    } catch (err) {
      console.error('Failed to load student ranks:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all martial arts rank definitions
  const fetchRanks = async () => {
    try {
      const res = await apiClient<any>('/ranks/list');
      const list = Array.isArray(res) ? res : res?.data || [];
      setAllRanks(list);
    } catch (err) {
      console.error('Failed to load ranks list:', err);
    }
  };

  // Fetch academy students
  const fetchAcademyStudents = async () => {
    try {
      const res = await apiClient<any>('/students');
      const list = Array.isArray(res) ? res : res?.data || [];
      setAcademyStudents(
        list.map((s: any) => ({
          id: s.id,
          fullName: s.fullName || s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Student',
          contactNumber: s.contactNumber || s.phone || '',
          dob: s.dob || s.dateOfBirth || '',
        }))
      );
    } catch (err) {
      console.error('Failed to load academy students:', err);
    }
  };

  // Fetch certificates with user-specified date range filter
  const fetchCertificates = async () => {
    try {
      setLoadingCerts(true);
      const params = new URLSearchParams();
      if (certStartDate) params.append('startDate', certStartDate);
      if (certEndDate) params.append('endDate', certEndDate);
      if (certDisciplineFilter !== 'ALL') params.append('discipline_code', certDisciplineFilter);

      const res = await apiClient<any>(`/ranks/certificates?${params.toString()}`);
      const list = Array.isArray(res) ? res : res?.certificates || res?.data || [];
      setCertificates(list);
    } catch (err) {
      console.error('Failed to load certificates:', err);
    } finally {
      setLoadingCerts(false);
    }
  };

  useEffect(() => {
    fetchStudentRanks();
    fetchRanks();
    fetchAcademyStudents();
  }, []);

  useEffect(() => {
    if (activeTab === 'CERTIFICATES') {
      fetchCertificates();
    }
  }, [activeTab, certStartDate, certEndDate, certDisciplineFilter]);

  // Open 1-Click Promote Modal
  const openPromoteModal = (studentRank: StudentRank) => {
    setSelectedStudentForPromotion(studentRank);
    // Find next rank in same discipline
    const disciplineRanks = allRanks
      .filter((r) => r.discipline_code === studentRank.discipline_code)
      .sort((a, b) => a.rank_order - b.rank_order);
    const next = disciplineRanks.find((r) => r.rank_order > studentRank.rank_order);
    if (next) {
      setPromotionTargetRankId(next.id);
    } else if (disciplineRanks.length > 0) {
      setPromotionTargetRankId(disciplineRanks[disciplineRanks.length - 1].id);
    }
    setIsPromoteModalOpen(true);
  };

  // Execute Rank Up Promotion
  const handlePromoteStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForPromotion) return;

    const chosenRank = allRanks.find((r) => r.id === promotionTargetRankId);
    if (!chosenRank) {
      toast.warning('Please select the target rank.');
      return;
    }

    try {
      setPromoting(true);
      await apiClient('/ranks/promote', {
        method: 'POST',
        body: JSON.stringify({
          student_id: selectedStudentForPromotion.student_id,
          studentId: selectedStudentForPromotion.student_id,
          discipline_code: selectedStudentForPromotion.discipline_code,
          disciplineCode: selectedStudentForPromotion.discipline_code,
          new_rank_id: chosenRank.id,
          nextRankId: chosenRank.id,
          examiner_name: examinerName,
          examinerName: examinerName,
          promotedBy: examinerName,
          represented_from: representedFrom,
          representedFrom: representedFrom,
          notes: 'Promoted via Gurukul Belt Examination System',
        }),
      });

      setIsPromoteModalOpen(false);
      setSelectedStudentForPromotion(null);
      fetchStudentRanks();
      toast.success(`Success! Athlete promoted to ${chosenRank.rank_name}. Celebratory WhatsApp notice dispatched to parents!`);
    } catch (err: any) {
      console.error('Promotion failed:', err);
      toast.error(err.message || 'Could not promote student. Please retry.');
    } finally {
      setPromoting(false);
    }
  };

  // Handle Assign initial rank
  const handleAssignStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignStudentId) return;

    try {
      await apiClient('/ranks/assign', {
        method: 'POST',
        body: JSON.stringify({
          student_id: assignStudentId,
          discipline_code: assignDiscipline,
          rank_name: assignRankName,
        }),
      });

      setIsAssignModalOpen(false);
      setAssignStudentId('');
      fetchStudentRanks();
      toast.success('Student enrolled into Martial Arts rank registry successfully!');
    } catch (err) {
      console.error('Failed to assign rank:', err);
      toast.error('Could not enroll student in martial arts rank registry.');
    }
  };

  // Print Certificate Registry sheet
  const handlePrintRegistry = () => {
    window.print();
  };

  const q = (searchTerm || '').trim().toLowerCase();
  const filteredStudentRanks = (studentRanks || []).filter((sr) => {
    const studentName = (sr.student_name || '').toLowerCase();
    const studentCode = (sr.student_code || '').toLowerCase();
    const matchesSearch = !q || studentName.includes(q) || studentCode.includes(q);
    const matchesDiscipline = disciplineFilter === 'ALL' || sr.discipline_code === disciplineFilter;
    return matchesSearch && matchesDiscipline;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
            <span>Martial Arts & Athletics</span>
            <span>•</span>
            <span className="text-orange-400 font-semibold">Belt Examinations & Certification</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1 flex items-center gap-2.5">
            <Award className="w-7 h-7 text-amber-400" />
            Martial Arts Belt Promotion & Certificate Registry
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage Kalarippayattu and Karate + Wushu belt progression, promote students with 1 click, dispatch WhatsApp congratulatory notices, and export date-filtered certificate registers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsAssignModalOpen(true)}
            className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold shadow-lg shadow-orange-500/20"
          >
            <Plus className="w-4 h-4 mr-2" />
            Enroll Student in Belt Registry
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('STUDENTS')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'STUDENTS'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Athletes & 1-Click Rank-Up
        </button>

        <button
          onClick={() => setActiveTab('CERTIFICATES')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'CERTIFICATES'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <FileText className="w-4 h-4" />
          Certificate Registry (Date Range Filter & PDF Export)
        </button>

        <button
          onClick={() => setActiveTab('CURRICULUM')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'CURRICULUM'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Layers className="w-4 h-4" />
          Belt Curriculum & Disciplines
        </button>
      </div>

      {/* TAB 1: ATHLETES & 1-CLICK RANK-UP */}
      {activeTab === 'STUDENTS' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search athlete by name or reg no..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#0F172A] border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={disciplineFilter}
                onChange={(e) => setDisciplineFilter(e.target.value)}
                className="bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Disciplines</option>
                <option value="KALARIPPAYATTU">Kalarippayattu</option>
                <option value="KARATE_WUSHU">Karate + Wushu</option>
                <option value="BOTH">Both (Dual Discipline)</option>
              </select>
            </div>
          </div>

          {loading ? (
            <SkeletonLoader rows={5} />
          ) : filteredStudentRanks.length === 0 ? (
            <Card className="p-10 text-center bg-[#0F172A]/70 border-white/10">
              <Award className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">No students found in martial arts rank registry</p>
              <p className="text-xs text-slate-500 mt-1">Enroll students to track their belt progression and issue certificates.</p>
              <Button
                onClick={() => setIsAssignModalOpen(true)}
                className="mt-3 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Enroll First Student
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStudentRanks.map((student) => {
                // Belt color styling helper
                const getBeltBadge = (color: string) => {
                  const c = (color || '').toLowerCase();
                  if (c.includes('yellow')) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
                  if (c.includes('orange')) return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
                  if (c.includes('green')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                  if (c.includes('blue')) return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
                  if (c.includes('brown')) return 'bg-amber-800/30 text-amber-200 border-amber-800/50';
                  if (c.includes('black')) return 'bg-black/60 text-slate-200 border-slate-700 shadow-sm';
                  if (c.includes('red')) return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
                  return 'bg-slate-700/40 text-slate-300 border-white/20';
                };

                return (
                  <Card
                    key={student.id}
                    className="p-5 bg-gradient-to-b from-[#0F172A] to-[#0A1120] border-white/10 hover:border-amber-500/40 transition-all shadow-md group relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            student.discipline_code === 'KALARIPPAYATTU'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : student.discipline_code === 'KARATE_WUSHU'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                          }`}>
                            {student.discipline_code === 'BOTH' ? 'Both (Kalari + Karate/Wushu)' : student.discipline_code.replace('_', ' ')}
                          </span>
                          {student.student_code && (
                            <span className="text-[10px] text-slate-500 font-mono">#{student.student_code}</span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">
                          {student.student_name}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">{student.contact_number || 'No contact'}</p>
                      </div>

                      <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
                        <Medal className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Current Belt Banner */}
                    <div className="mt-4 p-3 bg-slate-900/80 rounded-xl border border-white/5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Current Belt</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs font-black px-2.5 py-1 rounded-md border ${getBeltBadge(student.belt_color)}`}>
                            {student.current_rank_name}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Promoted On</span>
                        <span className="text-xs font-semibold text-slate-300 mt-1 block">
                          {new Date(student.promoted_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    {/* Next Belt Preview if available */}
                    {student.nextRank && (
                      <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between px-1">
                        <span>Next Target:</span>
                        <span className="font-semibold text-amber-300 flex items-center gap-1">
                          {student.nextRank.rank_name} <ArrowUpRight className="w-3 h-3" />
                        </span>
                      </div>
                    )}

                    {/* Action button */}
                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {student.certificate_number ? `Cert: ${student.certificate_number}` : 'Awaiting Cert'}
                      </span>

                      <Button
                        onClick={() => openPromoteModal(student)}
                        className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs py-1.5 px-3 shadow-md shadow-orange-500/20"
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1" />
                        1-Click Rank Up
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CERTIFICATE REGISTRY & PDF PRINT EXPORT (WITH DATE FILTER) */}
      {activeTab === 'CERTIFICATES' && (
        <div className="space-y-4">
          {/* User Request Highlight: Date Range Filter Toolbar */}
          <Card className="p-4 bg-[#0F172A]/90 border-white/10 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Filter className="w-4 h-4 text-amber-400" />
                  Examination Date Range Filter for Physical Certificate Writing
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select the date window to generate the exact roster for physical certificate inscription (Player Name, DOB, Reg No, Rank, Discipline, Dojo).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handlePrintRegistry}
                  className="bg-slate-800 hover:bg-slate-700 text-white border border-white/10 text-xs py-2 px-3"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                  Print Registry Sheet
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">From Date (Exam Window)</label>
                <input
                  type="date"
                  value={certStartDate}
                  onChange={(e) => setCertStartDate(e.target.value)}
                  className="w-full bg-[#0A1120] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">To Date</label>
                <input
                  type="date"
                  value={certEndDate}
                  onChange={(e) => setCertEndDate(e.target.value)}
                  className="w-full bg-[#0A1120] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Discipline</label>
                <select
                  value={certDisciplineFilter}
                  onChange={(e) => setCertDisciplineFilter(e.target.value)}
                  className="w-full bg-[#0A1120] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">All Disciplines</option>
                  <option value="KALARIPPAYATTU">Kalarippayattu</option>
                  <option value="KARATE_WUSHU">Karate + Wushu</option>
                  <option value="BOTH">Both (Dual Discipline)</option>
                </select>
              </div>

              <div className="flex items-end gap-2">
                <Button
                  onClick={fetchCertificates}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs py-1.5"
                >
                  Apply Filter
                </Button>
                {(certStartDate || certEndDate || certDisciplineFilter !== 'ALL') && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCertStartDate('');
                      setCertEndDate('');
                      setCertDisciplineFilter('ALL');
                    }}
                    className="text-xs py-1.5 px-2"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Certificate Records Table */}
          {loadingCerts ? (
            <SkeletonLoader rows={5} />
          ) : certificates.length === 0 ? (
            <Card className="p-10 text-center bg-[#0F172A]/60 border-white/10">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">No promotion records match this date filter</p>
              <p className="text-xs text-slate-500 mt-1">Adjust the date range above to view promotions from previous examination cycles.</p>
            </Card>
          ) : (
            <div className="bg-[#0F172A] rounded-xl border border-white/10 overflow-hidden shadow-xl print:bg-white print:text-black print:border-black">
              <div className="p-4 bg-[#0A1120] border-b border-white/10 flex items-center justify-between print:hidden">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">Showing {certificates.length} Certificate Records</span>
                  <span className="text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Ready for Inscription
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  Data format mirrors official Gurukul Certificate template
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0A1120] text-slate-400 uppercase tracking-wider font-semibold border-b border-white/10 print:bg-slate-100 print:text-black">
                    <tr>
                      <th className="py-3 px-3">Player Reg No.</th>
                      <th className="py-3 px-3">Player Full Name</th>
                      <th className="py-3 px-3">Date of Birth (DOB)</th>
                      <th className="py-3 px-3">Martial Art Subject</th>
                      <th className="py-3 px-3">Rank / Belt Secured</th>
                      <th className="py-3 px-3">Represented From</th>
                      <th className="py-3 px-3">Exam Date</th>
                      <th className="py-3 px-3">Certificate No.</th>
                      <th className="py-3 px-3 text-right print:hidden">Card View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-[#0F172A]/70 print:divide-slate-300">
                    {certificates.map((cert) => (
                      <tr key={cert.id} className="hover:bg-white/5 transition-colors print:text-black">
                        <td className="py-3 px-3 font-mono font-bold text-amber-400 print:text-black">
                          {cert.student_code || 'GSA-ATH'}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-white print:text-black block">{cert.student_name}</span>
                          <span className="text-[11px] text-slate-400 print:text-slate-600">{cert.contact_number}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-300 print:text-black">
                          {cert.dob ? new Date(cert.dob).toLocaleDateString('en-IN') : 'On File'}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-white print:text-black">{cert.discipline_name}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 print:border-black print:text-black">
                            <Award className="w-3 h-3 text-amber-400 print:hidden" />
                            {cert.to_rank_name}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300 print:text-black">
                          {cert.represented_from || 'Gurukul Sports Academy'}
                        </td>
                        <td className="py-3 px-3 text-slate-300 print:text-black">
                          {new Date(cert.promoted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3 px-3 font-mono text-emerald-400 font-bold print:text-black">
                          {cert.certificate_number}
                        </td>
                        <td className="py-3 px-3 text-right print:hidden">
                          <Button
                            onClick={() => setPreviewCert(cert)}
                            className="bg-slate-800 hover:bg-slate-700 text-white text-[11px] py-1 px-2.5 border border-white/10"
                          >
                            Preview
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CURRICULUM & DISCIPLINES */}
      {activeTab === 'CURRICULUM' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kalarippayattu Curriculum */}
          <Card className="p-5 bg-[#0F172A]/90 border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Ancient Martial Art
                </span>
                <h2 className="text-lg font-bold text-white mt-1">Kalarippayattu Progression</h2>
              </div>
              <ShieldAlert className="w-6 h-6 text-emerald-400" />
            </div>

            <div className="space-y-2">
              {allRanks
                .filter((r) => r.discipline_code === 'KALARIPPAYATTU')
                .sort((a, b) => a.rank_order - b.rank_order)
                .map((rank) => (
                  <div key={rank.id} className="p-3 bg-slate-900/60 rounded-lg border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs flex items-center justify-center">
                        {rank.rank_order}
                      </span>
                      <div>
                        <span className="text-xs font-bold text-white block">{rank.rank_name}</span>
                        <span className="text-[11px] text-slate-400">{rank.description || 'Form & Stance Mastery'}</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
                      {rank.belt_color} Belt
                    </span>
                  </div>
                ))}
            </div>
          </Card>

          {/* Karate + Wushu Curriculum */}
          <Card className="p-5 bg-[#0F172A]/90 border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Combat & Forms
                </span>
                <h2 className="text-lg font-bold text-white mt-1">Karate + Wushu Hierarchy</h2>
              </div>
              <Medal className="w-6 h-6 text-amber-400" />
            </div>

            <div className="space-y-2">
              {allRanks
                .filter((r) => r.discipline_code === 'KARATE_WUSHU')
                .sort((a, b) => a.rank_order - b.rank_order)
                .map((rank) => (
                  <div key={rank.id} className="p-3 bg-slate-900/60 rounded-lg border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center justify-center">
                        {rank.rank_order}
                      </span>
                      <div>
                        <span className="text-xs font-bold text-white block">{rank.rank_name}</span>
                        <span className="text-[11px] text-slate-400">{rank.description || 'Kata, Kumite & Stances'}</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                      {rank.belt_color} Belt
                    </span>
                  </div>
                ))}
            </div>
          </Card>

          {/* Both Dual Discipline Curriculum */}
          <Card className="p-5 bg-[#0F172A]/90 border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  Dual Arts Master
                </span>
                <h2 className="text-lg font-bold text-white mt-1">Both (Kalari + Karate/Wushu)</h2>
              </div>
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>

            <div className="space-y-2">
              {allRanks
                .filter((r) => r.discipline_code === 'BOTH')
                .sort((a, b) => a.rank_order - b.rank_order)
                .map((rank) => (
                  <div key={rank.id} className="p-3 bg-slate-900/60 rounded-lg border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 font-bold text-xs flex items-center justify-center">
                        {rank.rank_order}
                      </span>
                      <div>
                        <span className="text-xs font-bold text-white block">{rank.rank_name}</span>
                        <span className="text-[11px] text-slate-400">{rank.description || 'Dual Art Mastery'}</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded border border-purple-500/20">
                      {rank.belt_color} Belt
                    </span>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 1: 1-Click Promote Student */}
      <Modal
        isOpen={isPromoteModalOpen}
        onClose={() => setIsPromoteModalOpen(false)}
        title={`Promote Athlete: ${selectedStudentForPromotion?.student_name || ''}`}
      >
        <form onSubmit={handlePromoteStudent} className="space-y-4">
          <div className="p-3 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl text-xs text-amber-200">
            <span className="font-bold text-white block">Current Discipline: {selectedStudentForPromotion?.discipline_code.replace('_', ' ')}</span>
            Current Belt: <strong>{selectedStudentForPromotion?.current_rank_name}</strong>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Promote to New Rank / Belt *</label>
            <select
              required
              value={promotionTargetRankId}
              onChange={(e) => setPromotionTargetRankId(e.target.value)}
              className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            >
              {allRanks
                .filter((r) => r.discipline_code === selectedStudentForPromotion?.discipline_code)
                .sort((a, b) => a.rank_order - b.rank_order)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    Order {r.rank_order}: {r.rank_name} ({r.belt_color} Belt)
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Chief Examiner / Master *</label>
            <input
              type="text"
              required
              value={examinerName}
              onChange={(e) => setExaminerName(e.target.value)}
              className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Represented From (Dojo / Branch) *</label>
            <input
              type="text"
              required
              value={representedFrom}
              onChange={(e) => setRepresentedFrom(e.target.value)}
              className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            <span>Automatic celebratory WhatsApp notification will be dispatched to the parent immediately upon confirmation!</span>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPromoteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={promoting}
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold"
            >
              {promoting ? 'Promoting & Notifying...' : 'Confirm Promotion & Notify Parents'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Enroll Athlete in Belt Registry */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Enroll Student into Martial Arts Belt Registry"
      >
        <form onSubmit={handleAssignStudent} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Select Academy Student *</label>
            <select
              required
              value={assignStudentId}
              onChange={(e) => setAssignStudentId(e.target.value)}
              className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            >
              <option value="">-- Choose Athlete --</option>
              {academyStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.contactNumber})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Discipline *</label>
              <select
                value={assignDiscipline}
                onChange={(e) => setAssignDiscipline(e.target.value)}
                className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              >
                <option value="KALARIPPAYATTU">Kalarippayattu</option>
                <option value="KARATE_WUSHU">Karate + Wushu</option>
                <option value="BOTH">Both (Kalarippayattu + Karate & Wushu)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Initial Belt / Grade *</label>
              <select
                value={assignRankName}
                onChange={(e) => setAssignRankName(e.target.value)}
                className="w-full bg-[#0F172A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              >
                {allRanks
                  .filter((r) => r.discipline_code === assignDiscipline)
                  .sort((a, b) => a.rank_order - b.rank_order)
                  .map((r) => (
                    <option key={r.id} value={r.rank_name}>
                      {r.rank_name} ({r.belt_color})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAssignModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-amber-500 hover:bg-amber-600 text-white font-semibold"
            >
              Enroll in Registry
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Digital Certificate Preview Card */}
      <Modal
        isOpen={Boolean(previewCert)}
        onClose={() => setPreviewCert(null)}
        title="Official Certificate Inscription Card"
      >
        {previewCert && (
          <div className="p-6 bg-gradient-to-b from-[#0A1120] to-[#0F172A] rounded-2xl border-2 border-amber-500/40 text-center space-y-4 shadow-2xl relative">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-400">
                <Award className="w-8 h-8" />
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase tracking-widest text-amber-400 font-bold block">
                Certificate of Rank Achievement
              </span>
              <h2 className="text-xl font-black text-white mt-1">Gurukul Sports Academy</h2>
              <span className="text-xs text-slate-400">Department of Traditional & Combat Arts</span>
            </div>

            <div className="py-3 border-y border-white/10 space-y-2">
              <p className="text-xs text-slate-300">This is to certify that athlete</p>
              <h3 className="text-2xl font-black text-amber-300">{previewCert.student_name}</h3>
              <p className="text-xs text-slate-400">
                Registration No: <span className="font-mono text-white font-semibold">{previewCert.student_code || 'GSA-ATH'}</span> | DOB: <span className="text-white font-semibold">{previewCert.dob ? new Date(previewCert.dob).toLocaleDateString('en-IN') : 'On File'}</span>
              </p>
              <p className="text-xs text-slate-300 mt-2">
                has successfully passed the comprehensive examination and secured the rank of
              </p>
              <div className="inline-block bg-amber-500/20 border border-amber-400/50 rounded-lg px-4 py-1 text-sm font-black text-amber-300">
                {previewCert.to_rank_name} ({previewCert.discipline_name})
              </div>
            </div>

            <div className="grid grid-cols-2 text-left text-xs gap-3 pt-2 text-slate-400">
              <div>
                <span className="block text-[10px] text-slate-500 uppercase">Represented From</span>
                <span className="font-semibold text-white">{previewCert.represented_from}</span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] text-slate-500 uppercase">Exam Date</span>
                <span className="font-semibold text-white">{new Date(previewCert.promoted_at).toLocaleDateString('en-IN')}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 uppercase">Certificate Serial</span>
                <span className="font-mono font-bold text-amber-400">{previewCert.certificate_number}</span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] text-slate-500 uppercase">Chief Examiner</span>
                <span className="font-semibold text-white">{previewCert.examiner_name}</span>
              </div>
            </div>

            <div className="pt-4 flex justify-center">
              <Button
                onClick={() => {
                  window.print();
                }}
                className="bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Print Inscription Copy
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
