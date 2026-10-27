import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { apiClient } from '../../lib/api';
import { BatchItem, StudentItem } from '../../types/crm';
import { validatePhoneNumber } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  Phone,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldCheck,
  ExternalLink,
  CreditCard,
  Send,
  Award,
  Clock,
  Banknote,
  QrCode,
  Calendar,
  Smartphone,
} from 'lucide-react';

const avatarColors = [
  'from-indigo-500 to-indigo-700',
  'from-sky-500 to-sky-700',
  'from-emerald-500 to-emerald-700',
  'from-violet-500 to-violet-700',
  'from-amber-500 to-amber-700',
  'from-rose-500 to-rose-700',
];

export const StudentsPage: React.FC = () => {
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Add/Edit Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete Student Modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<StudentItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Student PWA Onboarding & Chaser Bot Feature Flag (Dormant per user request)
  const ENABLE_STUDENT_APP_INVITES = false;
  const [sendingInviteStudentId, setSendingInviteStudentId] = useState<string | null>(null);
  const [chaserLoading, setChaserLoading] = useState(false);

  // Form Fields - Prioritized for Real Data Entry
  const [name, setName] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentWhatsapp, setParentWhatsapp] = useState('');
  const [studentMobile, setStudentMobile] = useState('');
  const [batchId, setBatchId] = useState('');
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [admissionDate, setAdmissionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [backfillPastFees, setBackfillPastFees] = useState(false);
  const [pastFeesStatus, setPastFeesStatus] = useState<'PAID' | 'PENDING'>('PAID');

  const isPastAdmission = useMemo(() => {
    if (!admissionDate) return false;
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const selectedPeriod = admissionDate.slice(0, 7);
    return selectedPeriod < currentPeriod;
  }, [admissionDate]);

  // Secondary/Optional Fields
  const [feePlans, setFeePlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [isCreateCourseModalOpen, setIsCreateCourseModalOpen] = useState(false);
  const [newCourseForm, setNewCourseForm] = useState({
    name: '',
    amount: '',
    frequency: 'MONTHLY',
    dueDay: '5',
  });
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [course, setCourse] = useState('');
  const [monthlyFee, setMonthlyFee] = useState<number>(0);
  const [feeDueDay, setFeeDueDay] = useState<number>(5);

  // Initial Payment & Balance Settlement on Admission
  const [initialPaymentAmount, setInitialPaymentAmount] = useState<string>('');
  // Payment mode: Real Cash & UPI only
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI'>('CASH');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  // Martial Arts & Multi-Sport Progression (Dynamic 1, 2, 3+ sports with database-backed ranks)
  interface SelectedSportItem {
    id: string;
    disciplineCode: string;
    rankName: string;
  }
  const [availableDisciplines, setAvailableDisciplines] = useState<any[]>([]);
  const [availableRanks, setAvailableRanks] = useState<any[]>([]);
  const [selectedSports, setSelectedSports] = useState<SelectedSportItem[]>([
    { id: '1', disciplineCode: 'KARATE_WUSHU', rankName: '' }
  ]);
  const [keepModalOpen, setKeepModalOpen] = useState(false);

  // Admission Type: EXISTING vs FRESH
  const [admissionType, setAdmissionType] = useState<'EXISTING' | 'FRESH'>('EXISTING');
  const [sendingPdfStudentId, setSendingPdfStudentId] = useState<string | null>(null);

  // Fee Frequency & Payment Settlement
  const [feeFrequency, setFeeFrequency] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [feePaymentType, setFeePaymentType] = useState<'PAID_UP_TO' | 'YEARLY_PAID' | 'YEARLY_PARTIAL' | 'FRESH_TODAY' | 'UNPAID_PENDING'>('PAID_UP_TO');
  const [yearlyPaymentMode, setYearlyPaymentMode] = useState<'FULL' | 'INSTALLMENT' | 'UNPAID'>('FULL');
  const [yearlyPaidAmount, setYearlyPaidAmount] = useState<string>('');
  const nextInstallmentDueDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  // Multiple Installments Schedule
  interface ScheduledInstallmentItem {
    id: string;
    dueDate: string;
    amount: number | string;
  }
  const [scheduledInstallments, setScheduledInstallments] = useState<ScheduledInstallmentItem[]>([]);

  const currentMonthStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Default to CURRENT MONTH: Auto all-clear without stuck on September!
  const [paidUpToMonth, setPaidUpToMonth] = useState(currentMonthStr);

  const monthOptions = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 2; i >= -12; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const name = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      let tag = '';
      if (i > 0) tag = ` (Advance Paid - Valid through ${name})`;
      else if (i === 0) tag = ' (Current Month - All Cleared / Paid In Full)';
      else if (i === -1) tag = ' (Last Month Paid - Current Month Dues Pending)';
      else tag = ` (${Math.abs(i)} Months Dues Pending)`;
      list.push({ value, label: `${name}${tag}` });
    }
    return list;
  }, []);

  // Dynamic Discipline & Rank resolution
  const getRanksForDiscipline = (discCode: string) => {
    const list = availableRanks.filter((r) => r.discipline_code === discCode);
    if (list.length > 0) return list;
    if (discCode === 'KARATE_WUSHU') {
      return [
        { id: '1', rank_name: 'White Belt (10th Kyu)', belt_color: 'White' },
        { id: '2', rank_name: 'Yellow Belt (8th Kyu)', belt_color: 'Yellow' },
        { id: '3', rank_name: 'Orange Belt (7th Kyu)', belt_color: 'Orange' },
        { id: '4', rank_name: 'Green Belt (6th Kyu)', belt_color: 'Green' },
        { id: '5', rank_name: 'Blue Belt (5th Kyu)', belt_color: 'Blue' },
        { id: '6', rank_name: 'Purple Belt (4th Kyu)', belt_color: 'Purple' },
        { id: '7', rank_name: 'Brown Belt (3rd-1st Kyu)', belt_color: 'Brown' },
        { id: '8', rank_name: 'Black Belt (1st Dan)', belt_color: 'Black' },
      ];
    }
    if (discCode === 'KALARIPPAYATTU') {
      return [
        { id: '1', rank_name: 'Level 1 - बालशिष्य (Balshishya)', belt_color: 'White' },
        { id: '2', rank_name: 'Level 2 - शिष्य (Shishya)', belt_color: 'Yellow' },
        { id: '3', rank_name: 'Level 3 - अभ्यासी (Abhyasi)', belt_color: 'Orange' },
        { id: '4', rank_name: 'Level 4 - वीर (Veer)', belt_color: 'Green' },
        { id: '5', rank_name: 'Level 5 - योद्धा (Yoddha)', belt_color: 'Blue' },
        { id: '6', rank_name: 'Level 6 - नायक (Nayak)', belt_color: 'Purple' },
        { id: '7', rank_name: 'Level 7 - महारथी (Maharathi)', belt_color: 'Brown' },
        { id: '8', rank_name: 'Level 8 - गुरुशिष्य / उस्ताद (Master)', belt_color: 'Black' },
      ];
    }
    return [
      { id: '1', rank_name: 'Level 1 - Beginner (White Belt)', belt_color: 'White' },
      { id: '2', rank_name: 'Level 2 - Intermediate (Yellow/Orange)', belt_color: 'Yellow' },
      { id: '3', rank_name: 'Level 3 - Advanced (Green/Blue)', belt_color: 'Green' },
      { id: '4', rank_name: 'Level 4 - Senior (Brown/Black)', belt_color: 'Black' },
    ];
  };

  const updateCourseFromSports = (sportsList: SelectedSportItem[]) => {
    if (sportsList.length === 0) return;
    const names = sportsList.map((s) => {
      const d = availableDisciplines.find((x) => x.code === s.disciplineCode);
      return d ? d.name : (s.disciplineCode === 'KALARIPPAYATTU' ? 'Kalarippayattu' : s.disciplineCode === 'KARATE_WUSHU' ? 'Karate & Wushu' : s.disciplineCode);
    });
    if (sportsList.length === 1) {
      setCourse(`${names[0]} (Regular)`);
    } else if (sportsList.length === 2) {
      setCourse(`Dual Discipline (${names[0]} + ${names[1]})`);
    } else {
      setCourse(`Multi-Discipline (${names.join(' + ')})`);
    }
  };

  const handleSetSportCount = (count: number) => {
    setSelectedSports((prev) => {
      let updated: SelectedSportItem[] = [...prev];
      if (count === 1) {
        updated = updated.slice(0, 1);
      } else if (count === 2) {
        if (updated.length < 2) {
          const nextDisc = availableDisciplines.find((d) => d.code !== updated[0]?.disciplineCode) || { code: 'KALARIPPAYATTU', name: 'Kalarippayattu' };
          const firstRank = getRanksForDiscipline(nextDisc.code)[0]?.rank_name || 'Level 1';
          updated.push({ id: String(Date.now()), disciplineCode: nextDisc.code, rankName: firstRank });
        } else {
          updated = updated.slice(0, 2);
        }
      } else if (count >= 3) {
        while (updated.length < count) {
          const usedCodes = new Set(updated.map((u) => u.disciplineCode));
          const nextDisc = availableDisciplines.find((d) => !usedCodes.has(d.code)) || availableDisciplines[0] || { code: 'KICKBOXING', name: 'Kickboxing' };
          const firstRank = getRanksForDiscipline(nextDisc.code)[0]?.rank_name || 'Level 1';
          updated.push({ id: String(Date.now() + updated.length), disciplineCode: nextDisc.code, rankName: firstRank });
        }
      }
      updateCourseFromSports(updated);
      return updated;
    });
  };

  const handleAddSport = () => {
    setSelectedSports((prev) => {
      const usedCodes = new Set(prev.map((u) => u.disciplineCode));
      const nextDisc = availableDisciplines.find((d) => !usedCodes.has(d.code)) || availableDisciplines[0] || { code: 'KICKBOXING', name: 'Kickboxing' };
      const firstRank = getRanksForDiscipline(nextDisc.code)[0]?.rank_name || 'Level 1';
      const updated = [
        ...prev,
        { id: String(Date.now()), disciplineCode: nextDisc.code, rankName: firstRank }
      ];
      updateCourseFromSports(updated);
      return updated;
    });
  };

  const handleRemoveSport = (index: number) => {
    setSelectedSports((prev) => {
      if (prev.length <= 1) return prev;
      const updated = prev.filter((_, i) => i !== index);
      updateCourseFromSports(updated);
      return updated;
    });
  };

  const handleSportDisciplineChange = (index: number, newCode: string) => {
    setSelectedSports((prev) => {
      const updated = [...prev];
      const firstRank = getRanksForDiscipline(newCode)[0]?.rank_name || 'Level 1';
      updated[index] = { ...updated[index], disciplineCode: newCode, rankName: firstRank };
      updateCourseFromSports(updated);
      return updated;
    });
  };

  const handleSportRankChange = (index: number, newRank: string) => {
    setSelectedSports((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], rankName: newRank };
      return updated;
    });
  };

  // Multiple Installments calculations
  const calculatedRemainingDues = useMemo(() => {
    const total = Number(monthlyFee) || 0;
    const initial = Number(yearlyPaidAmount) || 0;
    return Math.max(0, total - initial);
  }, [monthlyFee, yearlyPaidAmount]);

  const totalScheduledAmount = useMemo(() => {
    return scheduledInstallments.reduce((sum, inst) => sum + (Number(inst.amount) || 0), 0);
  }, [scheduledInstallments]);

  const unscheduledDues = useMemo(() => {
    return Math.max(0, calculatedRemainingDues - totalScheduledAmount);
  }, [calculatedRemainingDues, totalScheduledAmount]);

  const handleAddScheduledInstallment = () => {
    setScheduledInstallments((prev) => {
      const baseDate = new Date();
      baseDate.setMonth(baseDate.getMonth() + (prev.length + 1));
      const nextDateStr = baseDate.toISOString().split('T')[0];
      const defaultAmount = unscheduledDues > 0 ? unscheduledDues : 1000;
      return [
        ...prev,
        {
          id: String(Date.now()),
          dueDate: nextDateStr,
          amount: defaultAmount,
        },
      ];
    });
  };

  const handleUpdateScheduledInstallment = (index: number, field: 'dueDate' | 'amount', value: any) => {
    setScheduledInstallments((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveScheduledInstallment = (index: number) => {
    setScheduledInstallments((prev) => prev.filter((_, i) => i !== index));
  };

  // Custom WhatsApp message sender modal
  const [isWaModalOpen, setIsWaModalOpen] = useState(false);
  const [waTargetStudent, setWaTargetStudent] = useState<StudentItem | null>(null);
  const [waCustomMessage, setWaCustomMessage] = useState('');
  const [sendingWa, setSendingWa] = useState(false);

  const handleSendStudentMonthlyPdf = async (s: StudentItem) => {
    if (!s.parentWhatsapp && !s.studentMobile) {
      toast.error('Student does not have a registered WhatsApp number.');
      return;
    }
    setSendingPdfStudentId(s.id);
    try {
      const res = await apiClient<any>(`/whatsapp/reports/send-student/${s.id}`, {
        method: 'POST',
      });
      if (res?.success) {
        toast.success(`Official Monthly PDF statement dispatched to ${s.name}'s parent WhatsApp!`);
      } else {
        toast.error(res?.error || 'Failed to dispatch monthly report.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send PDF statement.');
    } finally {
      setSendingPdfStudentId(null);
    }
  };

  const handleSendStudentInvite = async (s: StudentItem) => {
    if (!s.parentWhatsapp && !s.studentMobile) {
      toast.error('Student does not have a registered mobile number for WhatsApp invite.');
      return;
    }
    setSendingInviteStudentId(s.id);
    try {
      const res = await apiClient<any>(`/student-portal/admin/invite/${s.id}`, {
        method: 'POST',
      });
      if (res?.success) {
        toast.success(`WhatsApp Mobile App invite dispatched to ${s.name} with PWA link & credentials!`);
      } else {
        toast.error(res?.message || 'Failed to dispatch WhatsApp invite.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send WhatsApp invite.');
    } finally {
      setSendingInviteStudentId(null);
    }
  };

  const handleRunChaserBot = async () => {
    setChaserLoading(true);
    try {
      const res = await apiClient<any>('/student-portal/admin/run-chaser', {
        method: 'POST',
      });
      const count = res?.data?.remindedCount || 0;
      if (count > 0) {
        toast.success(`Chaser Bot: Sent follow-up WhatsApp reminders to ${count} students!`);
      } else {
        toast.info('Chaser Bot: All invited students have already logged in or no follow-ups due.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to run chaser bot.');
    } finally {
      setChaserLoading(false);
    }
  };

  const filteredStudents = useMemo(() => {
    const list = !search.trim()
      ? students
      : students.filter((s) => {
          const q = search.toLowerCase();
          const matchName = s.name?.toLowerCase().includes(q);
          const matchParent = s.parentName?.toLowerCase().includes(q);
          const matchWa = s.parentWhatsapp?.toLowerCase().includes(q);
          const matchMob = s.studentMobile?.toLowerCase().includes(q);
          const matchCourse = s.course?.toLowerCase().includes(q);
          const matchBatch = s.batchName?.toLowerCase().includes(q);
          const matchRank = s.martialArtsRanks?.some((r: any) =>
            r.rankName?.toLowerCase().includes(q) ||
            r.beltColor?.toLowerCase().includes(q) ||
            r.disciplineName?.toLowerCase().includes(q)
          );
          return matchName || matchParent || matchWa || matchMob || matchCourse || matchBatch || matchRank;
        });

    // Guarantee 1-to-1: each student ID appears at most once
    const seen = new Set<string>();
    return list.filter((s) => {
      if (!s.id || seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [students, search]);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);

      const [studentsData, batchesData, plansData, disciplinesRes, ranksRes] = await Promise.all([
        apiClient<StudentItem[]>(`/students?${params.toString()}`),
        apiClient<BatchItem[]>('/batches?status=ACTIVE'),
        apiClient<{ success: boolean; data: any[] }>('/fees/plans').catch(() => ({ success: false, data: [] })),
        apiClient<any>('/ranks/disciplines').catch(() => []),
        apiClient<any>('/ranks/list').catch(() => []),
      ]);

      setStudents(Array.isArray(studentsData) ? studentsData : []);
      window.dispatchEvent(new CustomEvent('academy:sync_counts'));
      setBatches(Array.isArray(batchesData) ? batchesData : []);
      const planList = Array.isArray(plansData) ? plansData : ((plansData as any)?.data || []);
      setFeePlans(planList);

      const dList = Array.isArray(disciplinesRes) ? disciplinesRes : (disciplinesRes?.data || []);
      const rList = Array.isArray(ranksRes) ? ranksRes : (ranksRes?.data || []);
      setAvailableDisciplines(dList);
      setAvailableRanks(rList);
    } catch (err: any) {
      console.error('Failed to fetch students/batches:', err);
      if (!silent) setStudents([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const handleQuickCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseForm.name.trim() || !newCourseForm.amount) return;
    setCreatingCourse(true);
    try {
      const res = await apiClient<{ success: boolean; data: any }>('/fees/plans', {
        method: 'POST',
        body: JSON.stringify({
          name: newCourseForm.name.trim(),
          amount: parseFloat(newCourseForm.amount),
          frequency: newCourseForm.frequency,
          dueDay: parseInt(newCourseForm.dueDay, 10) || 5,
        }),
      });
      if (res && res.data) {
        setFeePlans((prev) => [res.data, ...prev]);
        setSelectedPlanId(res.data.id);
        setCourse(res.data.name);
        setMonthlyFee(Number(res.data.amount));
        if (res.data.due_day) setFeeDueDay(res.data.due_day);
        setIsCreateCourseModalOpen(false);
        setNewCourseForm({ name: '', amount: '', frequency: 'MONTHLY', dueDay: '5' });
        toast.success(`Course "${res.data.name}" created successfully!`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create course');
    } finally {
      setCreatingCourse(false);
    }
  };

  const toggleBatch = (bId: string) => {
    setSelectedBatchIds((prev) => {
      const next = prev.includes(bId) ? prev.filter((id) => id !== bId) : [...prev, bId];
      if (next.length > 0) {
        setBatchId(next[0]);
      } else {
        setBatchId('');
      }
      return next;
    });
  };

  const handleOpenAdd = () => {
    setName('');
    setParentName('');
    setParentWhatsapp('');
    setStudentMobile('');
    setBatchId(batches.length > 0 ? batches[0].id : '');
    setSelectedBatchIds(batches.length > 0 ? [batches[0].id] : []);
    setWhatsappOptIn(true);
    const defaultPlan = feePlans.find((p) => p.active !== false) || feePlans[0];
    if (defaultPlan) {
      setSelectedPlanId(defaultPlan.id);
      setCourse(defaultPlan.name);
      setMonthlyFee(Number(defaultPlan.amount));
      if (defaultPlan.due_day) setFeeDueDay(defaultPlan.due_day);
      if (defaultPlan.frequency === 'YEARLY') {
        setFeeFrequency('YEARLY');
        setFeePaymentType('YEARLY_PAID');
      } else {
        setFeeFrequency('MONTHLY');
      }
    } else {
      setSelectedPlanId('');
      setCourse('Kalarippayattu (Regular)');
      setMonthlyFee(700);
      setFeeFrequency('MONTHLY');
    }
    setFeeDueDay(5);
    setInitialPaymentAmount('');
    setPaymentMethod('CASH');
    setPaymentNotes('');
    setAdmissionDate(new Date().toISOString().split('T')[0]);
    setAdmissionType('EXISTING');
    setBackfillPastFees(false);
    setPastFeesStatus('PAID');
    const d1 = availableDisciplines[0]?.code || 'KARATE_WUSHU';
    const r1 = getRanksForDiscipline(d1)[0]?.rank_name || 'White Belt (10th Kyu)';
    setSelectedSports([{ id: '1', disciplineCode: d1, rankName: r1 }]);
    setFeePaymentType('PAID_UP_TO');
    setYearlyPaymentMode('FULL');
    setYearlyPaidAmount('');
    setScheduledInstallments([]);
    setPaidUpToMonth(currentMonthStr);
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleOpenWhatsAppModal = (s: StudentItem) => {
    if (!s.parentWhatsapp) {
      toast.error('Student does not have a registered WhatsApp number.');
      return;
    }
    setWaTargetStudent(s);
    setWaCustomMessage(`Namaskar ${s.parentName || s.name} ji, this is an update regarding ${s.name}'s classes at Gurukul Sports Academy.`);
    setIsWaModalOpen(true);
  };

  const handleSendCustomWhatsApp = async () => {
    if (!waTargetStudent || !waTargetStudent.parentWhatsapp) return;
    if (!waCustomMessage.trim()) {
      toast.error('Message body cannot be empty.');
      return;
    }
    setSendingWa(true);
    try {
      await apiClient('/whatsapp/send', {
        method: 'POST',
        body: JSON.stringify({
          recipientPhone: waTargetStudent.parentWhatsapp,
          messageBody: waCustomMessage.trim(),
          studentId: waTargetStudent.id,
          eventType: 'CUSTOM_NOTIFICATION',
        }),
      });
      toast.success(`WhatsApp message sent to ${waTargetStudent.name}!`);
      setIsWaModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch WhatsApp message');
    } finally {
      setSendingWa(false);
    }
  };

  const handleOpenEdit = (s: StudentItem) => {
    setEditingStudent(s);
    setName(s.name);
    setParentName(s.parentName || '');
    setParentWhatsapp(s.parentWhatsapp || '');
    setStudentMobile(s.studentMobile || '');

    const currentBatchId = s.batchId || (s.enrolledBatches && s.enrolledBatches[0]?.id) || '';
    setBatchId(currentBatchId);
    const enrolledIds = (s.enrolledBatches?.map((b: any) => b.id) || (s.batchId ? [s.batchId] : [])).filter(Boolean);
    setSelectedBatchIds(enrolledIds.length > 0 ? enrolledIds : (currentBatchId ? [currentBatchId] : []));
    setWhatsappOptIn(s.whatsappOptIn !== false);
    setStatus(s.status || 'ACTIVE');
    const studentCourse = (s.course || '').trim();
    setCourse(studentCourse);
    setMonthlyFee(s.monthlyFee || 0);
    setFeeDueDay(s.feeDueDay || 5);
    setAdmissionDate(s.admissionDate ? s.admissionDate.split('T')[0] : '');

    // Match plan from feePlans or preserve current enrolled course
    const matchedPlan = feePlans.find(
      (p) =>
        p.id === (s as any).feePlanId ||
        p.name.trim().toLowerCase() === studentCourse.toLowerCase()
    );

    if (matchedPlan) {
      setSelectedPlanId(matchedPlan.id);
    } else if (studentCourse) {
      setSelectedPlanId('CURRENT');
    } else {
      setSelectedPlanId('');
    }

    setFormError('');
    setIsEditModalOpen(true);
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');

    if (!name.trim()) {
      setFormError('Student full name is required.');
      setFormLoading(false);
      return;
    }

    if (!parentName.trim()) {
      setFormError('Parent/Guardian name is required.');
      setFormLoading(false);
      return;
    }

    // Validate Parent WhatsApp Number (Primary contact)
    const pCheck = validatePhoneNumber(parentWhatsapp, true);
    if (!pCheck.valid) {
      setFormError(pCheck.error || 'Please provide a valid 10-digit or international Parent WhatsApp number.');
      setFormLoading(false);
      return;
    }

    // Validate Batch Assignment
    if (selectedBatchIds.length === 0 && !batchId) {
      setFormError('Please select at least 1 training batch for the student.');
      setFormLoading(false);
      return;
    }

    // Validate Student Mobile if provided
    let normalizedStudentMobile: string | undefined = undefined;
    if (studentMobile && studentMobile.trim()) {
      const sCheck = validatePhoneNumber(studentMobile, false);
      if (!sCheck.valid) {
        setFormError(sCheck.error || 'Invalid student mobile number format.');
        setFormLoading(false);
        return;
      }
      normalizedStudentMobile = sCheck.normalized;
    }

    try {
      const sportsPayload = selectedSports
        .filter((s) => s.disciplineCode && s.disciplineCode !== 'NONE')
        .map((s) => ({
          disciplineCode: s.disciplineCode,
          rankName: s.rankName || undefined,
        }));

      const compositeDiscipline = selectedSports.map((s) => s.disciplineCode).join(' + ') || 'KARATE_WUSHU';
      const compositeBelt = selectedSports.map((s) => s.rankName).filter(Boolean).join(' & ') || 'Level 1';

      let finalFeePaymentType = feePaymentType;
      let finalInitialPayment = Number(initialPaymentAmount) || 0;
      let finalNextDueDate: string | undefined = undefined;

      if (feeFrequency === 'YEARLY') {
        if (yearlyPaymentMode === 'FULL') {
          finalFeePaymentType = 'YEARLY_PAID';
          finalInitialPayment = Number(monthlyFee) || 0;
        } else if (yearlyPaymentMode === 'INSTALLMENT') {
          finalFeePaymentType = 'YEARLY_PARTIAL';
          finalInitialPayment = Number(yearlyPaidAmount) || 0;
          finalNextDueDate = scheduledInstallments[0]?.dueDate || nextInstallmentDueDate;
        } else {
          finalFeePaymentType = 'UNPAID_PENDING';
          finalInitialPayment = 0;
          finalNextDueDate = nextInstallmentDueDate;
        }
      }

      await apiClient('/students', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          parentName: parentName.trim(),
          parentWhatsapp: pCheck.normalized,
          studentMobile: normalizedStudentMobile,
          batchId: selectedBatchIds[0] || batchId || undefined,
          batchIds: selectedBatchIds.length > 0 ? selectedBatchIds : (batchId ? [batchId] : undefined),
          initialBatchIds: selectedBatchIds.length > 0 ? selectedBatchIds : (batchId ? [batchId] : undefined),
          whatsappOptIn,
          status,
          course: course.trim() || undefined,
          monthlyFee: Number(monthlyFee) || 0,
          feeDueDay: Number(feeDueDay) || 5,
          admissionDate: admissionDate || undefined,
          backfillPastFees: isPastAdmission && backfillPastFees,
          pastFeesStatus: pastFeesStatus,
          paymentMethod,
          paymentNotes: paymentNotes.trim() || undefined,
          sports: sportsPayload,
          sportDiscipline: compositeDiscipline,
          initialBeltRank: compositeBelt,
          feeFrequency,
          paidUpToMonth: feePaymentType === 'PAID_UP_TO' && feeFrequency === 'MONTHLY' ? paidUpToMonth : undefined,
          feePaymentType: finalFeePaymentType,
          initialPaymentAmount: finalInitialPayment,
          nextInstallmentDueDate: finalNextDueDate,
          installments: feeFrequency === 'YEARLY' && yearlyPaymentMode === 'INSTALLMENT' && scheduledInstallments.length > 0
            ? scheduledInstallments.map((inst) => ({
                amount: Number(inst.amount) || 0,
                dueDate: inst.dueDate,
              }))
            : undefined,
        }),
      });

      if (keepModalOpen) {
        // Continuous addition mode for 30-40 students: keep modal open and reset only student-specific fields
        setName('');
        setParentName('');
        setParentWhatsapp('');
        setStudentMobile('');
        setInitialPaymentAmount('');
        setPaymentNotes('');
        toast.success(`Student "${name.trim()}" enrolled! Ready to enter next student.`);
      } else {
        setIsAddModalOpen(false);
        setInitialPaymentAmount('');
        setPaymentMethod('CASH');
        setPaymentNotes('');
        toast.success(`Student "${name.trim()}" enrolled successfully!`);
      }
      fetchData(true);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create student');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setFormLoading(true);
    setFormError('');

    if (!name.trim()) {
      setFormError('Student full name is required.');
      setFormLoading(false);
      return;
    }

    if (!parentName.trim()) {
      setFormError('Parent/Guardian name is required.');
      setFormLoading(false);
      return;
    }

    // Validate Parent WhatsApp if provided
    let normalizedParentWhatsapp: string | null = null;
    if (parentWhatsapp && parentWhatsapp.trim()) {
      const pCheck = validatePhoneNumber(parentWhatsapp, true);
      if (!pCheck.valid) {
        setFormError(pCheck.error || 'Please provide a valid Parent WhatsApp number.');
        setFormLoading(false);
        return;
      }
      normalizedParentWhatsapp = pCheck.normalized;
    }

    let normalizedStudentMobile: string | null = null;
    if (studentMobile && studentMobile.trim()) {
      const sCheck = validatePhoneNumber(studentMobile, false);
      if (!sCheck.valid) {
        setFormError(sCheck.error || 'Invalid student mobile number format.');
        setFormLoading(false);
        return;
      }
      normalizedStudentMobile = sCheck.normalized;
    }

    try {
      await apiClient(`/students/${editingStudent.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          parentName: parentName.trim(),
          parentWhatsapp: normalizedParentWhatsapp,
          studentMobile: normalizedStudentMobile,
          batchId: selectedBatchIds[0] || batchId || undefined,
          batchIds: selectedBatchIds,
          whatsappOptIn,
          status,
          course: course.trim() || undefined,
          monthlyFee: Number(monthlyFee),
          feeDueDay: Number(feeDueDay),
          admissionDate: admissionDate || undefined,
        }),
      });
      setIsEditModalOpen(false);
      toast.success(`Student "${name.trim()}" updated successfully!`);
      fetchData(true);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update student');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteClick = (student: StudentItem) => {
    setStudentToDelete(student);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;
    setDeleteLoading(true);
    const targetId = studentToDelete.id;

    // Optimistic UI update: remove row immediately (zero screen flash or jumping)
    setStudents((prev) => prev.filter((s) => s.id !== targetId));
    setIsDeleteModalOpen(false);

    try {
      await apiClient(`/students/${targetId}`, {
        method: 'DELETE',
      });
    } catch (err: any) {
      fetchData(true);
      toast.error(`Failed to delete student: ${err.message || 'Unknown error'}`);
    } finally {
      setDeleteLoading(false);
      setStudentToDelete(null);
    }
  };

  const totalCount = students.length;
  const activeCount = students.filter((s) => s.status === 'ACTIVE').length;
  const pendingFeeCount = students.filter((s) => s.currentMonthFeeStatus === 'OVERDUE' || s.currentMonthFeeStatus === 'PENDING').length;
  const feeCompliantCount = totalCount > 0 ? Math.round(((totalCount - pendingFeeCount) / totalCount) * 100) : 100;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header - Stitch Style */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Students Directory
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage active enrollments, batch rosters, parent WhatsApp contacts, and fee profiles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ENABLE_STUDENT_APP_INVITES && (
            <button
              onClick={handleRunChaserBot}
              disabled={chaserLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="Scan and send WhatsApp follow-up reminders to students who have not logged in yet"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{chaserLoading ? 'Scanning Chaser...' : 'WhatsApp Chaser Bot 🤖'}</span>
            </button>
          )}
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg text-sm font-semibold shadow-md shadow-orange-500/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards (Stitch Students Directory) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Enrolled</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">All Batches</span>
          </div>
          <div className="kpi-value">{totalCount}</div>
          <div className="kpi-sublabel text-slate-500 dark:text-slate-400">Registered academy athletes</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Status</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">On Duty</span>
          </div>
          <div className="kpi-value text-emerald-600 dark:text-emerald-400">{activeCount}</div>
          <div className="kpi-sublabel text-slate-500 dark:text-slate-400">Actively attending training</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fee Compliant</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400">Current Cycle</span>
          </div>
          <div className="kpi-value text-sky-600 dark:text-sky-400">{feeCompliantCount}%</div>
          <div className="kpi-sublabel text-slate-500 dark:text-slate-400">Cleared monthly subscriptions</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fee Pending</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">Action Required</span>
          </div>
          <div className="kpi-value text-amber-600 dark:text-amber-400">{pendingFeeCount}</div>
          <div className="kpi-sublabel text-slate-500 dark:text-slate-400">Athletes requiring follow-up</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-white/10 rounded-xl shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name, parent, phone, batch, sport, or belt..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-[#F97316] bg-slate-50 dark:bg-[#0F172A] text-slate-900 dark:text-white placeholder:text-slate-400 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-36 text-xs h-9 bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </Select>
            <button
              type="submit"
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-[#273549] hover:bg-slate-200 dark:hover:bg-[#334155] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white transition-colors cursor-pointer"
            >
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Students Table */}
      {loading ? (
        <SkeletonLoader variant="table" rows={5} />
      ) : filteredStudents.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'No matching students found' : 'No students found'}
          description={search ? 'Try clearing your search query or status filter.' : 'Add your first student to start managing attendance and fees.'}
          actionLabel={search ? 'Clear Search' : 'Add Student'}
          onAction={search ? () => setSearch('') : handleOpenAdd}
          accentColor="indigo"
        />
      ) : (
        <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm dark:shadow-lg">
          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Student &amp; ID</th>
                  <th>Parent Contact</th>
                  <th>Sport &amp; Belt Rank</th>
                  <th>WhatsApp</th>
                  <th>Fee Status</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredStudents.map((s, idx) => {
                  const initials = s.name
                    ? s.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .substring(0, 2)
                    : 'ST';
                  const gradient = avatarColors[idx % avatarColors.length];

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                      {/* Student Name */}
                      <td className="px-6 py-4">
                        <Link
                          to={`/admin/students/${s.id}`}
                          className="flex items-center gap-3 cursor-pointer group no-underline"
                          title="Click to view full student profile"
                        >
                          <div
                            className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${gradient} text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0 group-hover:scale-105 transition-transform`}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                              {s.name}
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-indigo-500 transition-opacity" />
                            </div>
                            {s.course && (
                              <div className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">
                                {s.course}
                              </div>
                            )}
                          </div>
                        </Link>
                      </td>

                      {/* Parent / Primary WhatsApp */}
                      <td className="px-5 py-4 text-xs">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {s.parentName || <span className="text-slate-400 italic">No parent name</span>}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          {s.parentWhatsapp ? (
                            <button
                              type="button"
                              onClick={() => handleOpenWhatsAppModal(s)}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
                              title="Click to send custom WhatsApp message"
                            >
                              <MessageSquare className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              {s.parentWhatsapp}
                            </button>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 text-[11px]">
                              <AlertCircle className="w-3 h-3" />
                              No WhatsApp
                            </span>
                          )}
                          {s.studentMobile && (
                            <span className="text-slate-400 dark:text-slate-400 text-[11px] flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5" />
                              {s.studentMobile}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Sport & Belt Rank (Batch pill hidden per academy requirements) */}
                      <td className="px-5 py-4 text-xs">
                        <div className="space-y-1.5">
                          {s.martialArtsRanks && s.martialArtsRanks.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {s.martialArtsRanks.map((r: any, rIdx: number) => (
                                <span
                                  key={r.id || rIdx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25"
                                  title={`${r.disciplineName}: ${r.rankName} (${r.beltColor} Belt)`}
                                >
                                  <Award className="w-3 h-3 text-amber-500" />
                                  <span>{r.disciplineCode === 'KALARIPPAYATTU' ? 'Kalari' : r.disciplineCode === 'KARATE_WUSHU' ? 'Karate' : r.disciplineName}:</span>
                                  <span className="font-extrabold">{r.rankName}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic block text-[11px]">
                              {s.course || 'Rank Pending'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* WhatsApp Opt-in */}
                      <td className="px-5 py-4 text-xs">
                        {s.whatsappOptIn !== false ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            Opted In
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-400 font-medium text-xs">
                            <XCircle className="w-4 h-4 text-slate-400" />
                            Opted Out
                          </span>
                        )}
                      </td>

                      {/* This Month Fee Status */}
                      <td className="px-5 py-4 text-xs font-semibold">
                        {s.currentMonthFeeStatus === 'PAID' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            PAID
                          </span>
                        )}
                        {s.currentMonthFeeStatus === 'PARTIAL' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            PARTIAL (₹{s.currentMonthPendingAmount})
                          </span>
                        )}
                        {s.currentMonthFeeStatus === 'PENDING' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            PENDING
                          </span>
                        )}
                        {s.currentMonthFeeStatus === 'OVERDUE' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            OVERDUE
                          </span>
                        )}
                        {(!s.currentMonthFeeStatus || s.currentMonthFeeStatus === 'NOT_ASSIGNED') && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            No Fee
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <StatusBadge status={s.status} />
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          {/* 1-Click Send Mobile App Onboarding WhatsApp Invite (Dormant when ENABLE_STUDENT_APP_INVITES is false) */}
                          {ENABLE_STUDENT_APP_INVITES && (
                            <button
                              type="button"
                              onClick={() => handleSendStudentInvite(s)}
                              disabled={sendingInviteStudentId === s.id}
                              className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                              title="Send Student Mobile App (PWA) Login Credentials & Link via WhatsApp"
                            >
                              <Smartphone className={`w-4 h-4 ${sendingInviteStudentId === s.id ? 'animate-bounce text-amber-500' : ''}`} />
                            </button>
                          )}

                          {/* 1-Click Send Monthly Progress PDF via WhatsApp */}
                          <button
                            type="button"
                            onClick={() => handleSendStudentMonthlyPdf(s)}
                            disabled={sendingPdfStudentId === s.id}
                            className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                            title="Dispatch Official Monthly Progress PDF to Parent WhatsApp"
                          >
                            <Send className={`w-4 h-4 ${sendingPdfStudentId === s.id ? 'animate-pulse text-amber-500' : ''}`} />
                          </button>

                          <Link
                            to={`/admin/students/${s.id}`}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer inline-flex items-center justify-center"
                            title="View Full Profile & Belt Examination History"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(s)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                            title="Edit Student"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(s)}
                            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Delete Student"
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD STUDENT MODAL — CLEAN, COMPACT, REAL-DATA ORDER */}
      {/* ========================================================================= */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add Student" maxWidth="lg">
        <form onSubmit={handleCreateStudent} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-3.5">
            {/* ZERO-CONFUSION ADMISSION TYPE SELECTOR */}
            <div className="p-3 bg-slate-900 border border-slate-700/80 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-white tracking-wide">
                Kaisa Student Add Kar Rahe Hain? (Select Admission Type) *
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAdmissionType('EXISTING');
                    setFeePaymentType('PAID_UP_TO');
                  }}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                    admissionType === 'EXISTING'
                      ? 'bg-indigo-600/20 border-indigo-500 text-white ring-2 ring-indigo-500/30'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5 text-indigo-300">
                    <span>📋 Purana / Existing Student</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Pehle se academy mein hai. Pichli fees already le chuke hain.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAdmissionType('FRESH');
                    setFeePaymentType('FRESH_TODAY');
                    setAdmissionDate(new Date().toISOString().split('T')[0]);
                  }}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                    admissionType === 'FRESH'
                      ? 'bg-emerald-600/20 border-emerald-500 text-white ring-2 ring-emerald-500/30'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5 text-emerald-300">
                    <span>🌟 Naya Admission (Joining Today)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Aaj naye student ka fresh admission hua hai.
                  </p>
                </button>
              </div>
            </div>

            {/* 1. Student Full Name */}
            <Input
              label="Student Full Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Rahul Sharma"
            />

            {/* 2. Parent / Guardian Name */}
            <Input
              label="Parent / Guardian Name *"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              required
              placeholder="e.g. Rajesh Sharma"
            />

            {/* 3. Parent WhatsApp Number (Primary contact) */}
            <PhoneInput
              label="Parent WhatsApp Number (Primary contact)"
              required
              value={parentWhatsapp}
              onChange={setParentWhatsapp}
              placeholder="98765 43210"
              helperText="Attendance alerts and fee receipts will be dispatched to this WhatsApp number."
            />

            {/* 4. Student Mobile Number (Optional) */}
            <PhoneInput
              label="Student Mobile Number (Optional)"
              value={studentMobile}
              onChange={setStudentMobile}
              placeholder="98765 43211"
              helperText="Only if student carries a personal mobile."
            />

            {/* 4. Sport / Martial Arts Disciplines & Starting Belt Ranks (Dynamic Multi-Sport) */}
            <div className="p-4 bg-slate-900/80 dark:bg-slate-900 border border-slate-700/60 rounded-xl space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <span className="text-xs font-bold text-white tracking-wide">
                    Sports &amp; Martial Arts Disciplines *
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-black/40 p-0.5 rounded-lg border border-white/5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => handleSetSportCount(1)}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      selectedSports.length === 1
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    1 Sport
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetSportCount(2)}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      selectedSports.length === 2
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    2 Sports
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetSportCount(3)}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      selectedSports.length >= 3
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    3+ Sports
                  </button>
                  <button
                    type="button"
                    onClick={handleAddSport}
                    className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-1 cursor-pointer"
                    title="Add another discipline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Sports Cards */}
              <div className="space-y-3">
                {selectedSports.map((sp, idx) => {
                  const disciplineRanks = getRanksForDiscipline(sp.disciplineCode);
                  return (
                    <div key={sp.id || idx} className="p-3 bg-slate-950/40 rounded-lg border border-white/5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-300">
                          {idx === 0 ? 'Primary Sport / Discipline' : `Sport / Discipline #${idx + 1}`}
                        </span>
                        {selectedSports.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSport(idx)}
                            className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Discipline
                          </label>
                          <Select
                            value={sp.disciplineCode}
                            onChange={(e) => handleSportDisciplineChange(idx, e.target.value)}
                          >
                            {availableDisciplines.length > 0 ? (
                              availableDisciplines.map((d: any) => (
                                <option key={d.code} value={d.code}>
                                  {d.name}
                                </option>
                              ))
                            ) : (
                              <>
                                <option value="KARATE_WUSHU">Karate &amp; Wushu</option>
                                <option value="KALARIPPAYATTU">Kalarippayattu</option>
                                <option value="KICKBOXING">Kickboxing</option>
                                <option value="GYMNASTICS">Gymnastics &amp; Acrobatics</option>
                                <option value="NONE">General Fitness / Athletics</option>
                              </>
                            )}
                          </Select>
                        </div>

                        {sp.disciplineCode !== 'NONE' && (
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                              Current Belt / Rank
                            </label>
                            <Select
                              value={sp.rankName}
                              onChange={(e) => handleSportRankChange(idx, e.target.value)}
                            >
                              {disciplineRanks.map((r: any) => (
                                <option key={r.id || r.rank_name} value={r.rank_name}>
                                  {r.rank_name} {r.belt_color ? `(${r.belt_color} Belt)` : ''}
                                </option>
                              ))}
                            </Select>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-slate-400">
                Directly registers athlete in Belt &amp; Rank tracking. Supports independent belt levels for multi-sport athletes.
              </p>
            </div>

            {/* 5. Admission / Joining Date */}
            <div className="space-y-1.5">
              <Input
                label="Admission / Joining Date *"
                type="date"
                required
                value={admissionDate}
                onChange={(e) => setAdmissionDate(e.target.value)}
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                For older/existing students, select their original enrollment date.
              </p>
            </div>

            {/* 6. FEE PLAN & CLEARANCE SETTLEMENT */}
            <div className="p-4 bg-indigo-950/40 rounded-xl border border-indigo-500/30 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-indigo-400" />
                  {admissionType === 'EXISTING'
                    ? 'Previous Fee Clearance Status (Existing Student) *'
                    : 'Initial Fee Setup (Fresh Enrollment) *'}
                </span>

                {/* Plan Frequency Switcher: Monthly vs Yearly */}
                <div className="inline-flex rounded-lg p-0.5 bg-slate-900 border border-slate-700 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setFeeFrequency('MONTHLY');
                      if (admissionType === 'EXISTING') {
                        setFeePaymentType('PAID_UP_TO');
                      } else {
                        setFeePaymentType('FRESH_TODAY');
                      }
                      if (monthlyFee === 7000) setMonthlyFee(700);
                    }}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      feeFrequency === 'MONTHLY'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Monthly Plan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFeeFrequency('YEARLY');
                      setFeePaymentType('YEARLY_PAID');
                      if (monthlyFee <= 1000) setMonthlyFee(7000);
                    }}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      feeFrequency === 'YEARLY'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    1-Year Annual
                  </button>
                </div>
              </div>

              {/* Course Selector Dropdown & Fee Amount */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Course / Training Plan *
                    </label>
                    <Select
                      value={selectedPlanId}
                      onChange={(e) => {
                        const planId = e.target.value;
                        setSelectedPlanId(planId);
                        if (planId === 'CUSTOM') {
                          // Manual custom course entry
                        } else if (planId) {
                          const found = feePlans.find((p) => p.id === planId);
                          if (found) {
                            setCourse(found.name);
                            setMonthlyFee(Number(found.amount));
                            if (found.due_day) setFeeDueDay(found.due_day);
                            if (found.frequency === 'YEARLY') {
                              setFeeFrequency('YEARLY');
                              setFeePaymentType('YEARLY_PAID');
                            } else {
                              setFeeFrequency('MONTHLY');
                            }
                          }
                        }
                      }}
                      className="bg-slate-900 text-white border-slate-700 font-medium"
                    >
                      <option value="">-- Select Registered Academy Course --</option>
                      {feePlans.filter((p) => p.active !== false).map((p) => (
                        <option key={p.id} value={p.id}>
                          🥋 {p.name} — ₹{Number(p.amount).toLocaleString('en-IN')} / {p.frequency ? p.frequency.toLowerCase() : 'cycle'}
                        </option>
                      ))}
                      <option value="CUSTOM">✏️ Custom Course Name...</option>
                    </Select>
                  </div>

                  <div>
                    <Input
                      label={feeFrequency === 'YEARLY' ? 'Annual Fee Amount (₹) *' : 'Monthly Fee (₹) *'}
                      type="number"
                      min="0"
                      step="1"
                      value={monthlyFee === 0 ? '' : monthlyFee}
                      onChange={(e) => setMonthlyFee(Number(e.target.value))}
                      required
                      placeholder={feeFrequency === 'YEARLY' ? 'e.g. 10000' : 'e.g. 700'}
                    />
                  </div>
                </div>

                {selectedPlanId === 'CUSTOM' && (
                  <div className="pt-1">
                    <Input
                      label="Custom Course Name *"
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      required
                      placeholder="e.g. Mixed Martial Arts Pro Batch"
                    />
                  </div>
                )}
              </div>

              {/* CASE 1: EXISTING STUDENT MONTHLY CLEARANCE */}
              {admissionType === 'EXISTING' && feeFrequency === 'MONTHLY' && (
                <div className="p-3.5 rounded-xl bg-slate-900 border border-indigo-500/40 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-indigo-300 mb-1.5">
                      📅 Fees Paid Up To Month:
                    </label>
                    <Select
                      value={paidUpToMonth}
                      onChange={(e) => {
                        setPaidUpToMonth(e.target.value);
                        setFeePaymentType('PAID_UP_TO');
                      }}
                      className="text-xs bg-slate-950 text-white border-slate-700"
                    >
                      {monthOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {/* Dynamic Status Banner: Green if Current/Future, RED if Past */}
                  {paidUpToMonth >= currentMonthStr ? (
                    <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-xs text-emerald-200 space-y-1">
                      <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>All Cleared (Zero Dues Pending)</span>
                      </div>
                      <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                        Student is fully paid through <strong>{monthOptions.find((o) => o.value === paidUpToMonth)?.label.split(' (')[0] || paidUpToMonth}</strong>. All previous billing cycles are recorded as PAID with no pending dues.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-500/70 text-xs text-rose-200 space-y-1.5 shadow-sm">
                      <div className="font-bold text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span>Notice: Dues Pending for Current Month</span>
                      </div>
                      <p className="text-[11px] text-rose-200 leading-relaxed">
                        Student fees are only cleared up to <strong>{monthOptions.find((o) => o.value === paidUpToMonth)?.label.split(' (')[0] || paidUpToMonth}</strong>.
                        The current month will be recorded as <strong>PENDING DUES (₹{monthlyFee} Overdue)</strong> in the student ledger, and automated fee reminders will be active.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* CASE 2: FRESH ADMISSION MONTHLY */}
              {admissionType === 'FRESH' && feeFrequency === 'MONTHLY' && (
                <div className="p-3.5 rounded-xl bg-slate-900 border border-indigo-500/40 space-y-3">
                  <label className="block text-xs font-bold text-slate-200">
                    Fee Collection on Enrollment:
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setFeePaymentType('FRESH_TODAY')}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        feePaymentType === 'FRESH_TODAY'
                          ? 'bg-emerald-600/20 border-emerald-500 text-white ring-2 ring-emerald-500/30'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5 text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Collect Payment Today</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Current month ({new Date().toLocaleString('en-IN', { month: 'long' })}) fee marked as paid immediately.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFeePaymentType('UNPAID_PENDING')}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        feePaymentType === 'UNPAID_PENDING'
                          ? 'bg-amber-600/20 border-amber-500 text-white ring-2 ring-amber-500/30'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5 text-amber-300">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span>Pending / Pay Later</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Student enrolled with current month dues recorded in ledger.
                      </p>
                    </button>
                  </div>

                  {feePaymentType === 'FRESH_TODAY' && (
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          label="Amount Paid Today (₹)"
                          type="number"
                          min="0"
                          value={initialPaymentAmount}
                          onChange={(e) => setInitialPaymentAmount(e.target.value)}
                          placeholder={`e.g. ${monthlyFee || 700}`}
                        />
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                            Payment Mode *
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setPaymentMethod('CASH')}
                              className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold text-xs transition-all cursor-pointer ${
                                paymentMethod === 'CASH'
                                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
                                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                              }`}
                            >
                              <Banknote className="w-4 h-4 text-emerald-400" />
                              <span>Cash</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPaymentMethod('UPI')}
                              className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold text-xs transition-all cursor-pointer ${
                                paymentMethod === 'UPI'
                                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md ring-2 ring-indigo-500/30'
                                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                              }`}
                            >
                              <QrCode className="w-4 h-4 text-indigo-400" />
                              <span>UPI</span>
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs p-2 rounded bg-slate-900 border border-slate-800">
                        <span className="text-slate-400">Remaining Balance:</span>
                        <strong className="text-white font-mono">
                          ₹{Math.max(0, (Number(monthlyFee) || 0) - (Number(initialPaymentAmount) || 0)).toLocaleString('en-IN')}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CASE 3: YEARLY PACKAGE (Full, Multiple Installments, or Pay Later) */}
              {feeFrequency === 'YEARLY' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Option 1: Full 1-Year Paid */}
                    <button
                      type="button"
                      onClick={() => {
                        setYearlyPaymentMode('FULL');
                        setFeePaymentType('YEARLY_PAID');
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        yearlyPaymentMode === 'FULL'
                          ? 'bg-emerald-600/20 border-emerald-500 text-white ring-2 ring-emerald-500/30'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Full Annual Payment</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        ₹{Number(monthlyFee || 0).toLocaleString('en-IN')} paid in full. Valid 365 days.
                      </p>
                    </button>

                    {/* Option 2: Flexible Multiple Installments */}
                    <button
                      type="button"
                      onClick={() => {
                        setYearlyPaymentMode('INSTALLMENT');
                        setFeePaymentType('YEARLY_PARTIAL');
                        if (!yearlyPaidAmount && monthlyFee > 0) {
                          const half = Math.round(monthlyFee / 2);
                          setYearlyPaidAmount(String(half));
                          const bal = monthlyFee - half;
                          if (scheduledInstallments.length === 0 && bal > 0) {
                            const d = new Date();
                            d.setMonth(d.getMonth() + 1);
                            setScheduledInstallments([
                              { id: '1', dueDate: d.toISOString().split('T')[0], amount: bal }
                            ]);
                          }
                        }
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        yearlyPaymentMode === 'INSTALLMENT'
                          ? 'bg-amber-600/20 border-amber-500 text-white ring-2 ring-amber-500/30'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-bold text-amber-300 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span>Pay in Installments</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Pay initial amount today; balance scheduled in installments.
                      </p>
                    </button>

                    {/* Option 3: Pay Later */}
                    <button
                      type="button"
                      onClick={() => {
                        setYearlyPaymentMode('UNPAID');
                        setFeePaymentType('UNPAID_PENDING');
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        yearlyPaymentMode === 'UNPAID'
                          ? 'bg-indigo-600/20 border-indigo-500 text-white ring-2 ring-indigo-500/30'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-bold text-indigo-300 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-indigo-400" />
                        <span>Pay Later (Pending)</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Enrolls with annual dues marked pending.
                      </p>
                    </button>
                  </div>

                  {yearlyPaymentMode === 'FULL' && (
                    <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 space-y-3 text-xs">
                      <div>
                        <label className="block text-xs font-semibold text-emerald-300 mb-1.5">
                          Payment Mode *
                        </label>
                        <div className="grid grid-cols-2 gap-2 max-w-xs">
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('CASH')}
                            className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold text-xs transition-all cursor-pointer ${
                              paymentMethod === 'CASH'
                                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
                                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                            }`}
                          >
                            <Banknote className="w-4 h-4 text-emerald-400" />
                            <span>Cash</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('UPI')}
                            className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold text-xs transition-all cursor-pointer ${
                              paymentMethod === 'UPI'
                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md ring-2 ring-indigo-500/30'
                                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                            }`}
                          >
                            <QrCode className="w-4 h-4 text-indigo-400" />
                            <span>UPI</span>
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-emerald-400">
                        ✓ <strong>Complete 365-Day Access:</strong> Zero monthly overdue notices. Renewal notice after 1 year.
                      </p>
                    </div>
                  )}

                  {yearlyPaymentMode === 'INSTALLMENT' && (
                    <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/40 space-y-4">
                      {/* 1st Installment Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          label="1st Installment Paid Today (₹) *"
                          type="number"
                          min="0"
                          max={monthlyFee}
                          value={yearlyPaidAmount}
                          onChange={(e) => {
                            const val = e.target.value;
                            setYearlyPaidAmount(val);
                            const bal = Math.max(0, (Number(monthlyFee) || 0) - (Number(val) || 0));
                            if (bal > 0 && scheduledInstallments.length === 0) {
                              const d = new Date();
                              d.setMonth(d.getMonth() + 1);
                              setScheduledInstallments([
                                { id: '1', dueDate: d.toISOString().split('T')[0], amount: bal }
                              ]);
                            }
                          }}
                          placeholder={`e.g. ${Math.round(monthlyFee / 2) || 3500}`}
                        />
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                            Payment Mode *
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setPaymentMethod('CASH')}
                              className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold text-xs transition-all cursor-pointer ${
                                paymentMethod === 'CASH'
                                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
                                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                              }`}
                            >
                              <Banknote className="w-4 h-4 text-emerald-400" />
                              <span>Cash</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPaymentMethod('UPI')}
                              className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold text-xs transition-all cursor-pointer ${
                                paymentMethod === 'UPI'
                                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md ring-2 ring-indigo-500/30'
                                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                              }`}
                            >
                              <QrCode className="w-4 h-4 text-indigo-400" />
                              <span>UPI</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Remaining Balance Card */}
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
                        <span className="text-amber-300 font-semibold">Remaining Balance Dues:</span>
                        <span className="font-bold font-mono text-base text-amber-400">
                          ₹{calculatedRemainingDues.toLocaleString('en-IN')}
                        </span>
                      </div>

                      {/* Multiple Scheduled Subsequent Installments */}
                      {calculatedRemainingDues > 0 && (
                        <div className="space-y-3 pt-2 border-t border-white/5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-amber-400" />
                              Scheduled Subsequent Installments
                            </span>
                            <button
                              type="button"
                              onClick={handleAddScheduledInstallment}
                              className="text-xs px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-1 cursor-pointer font-semibold"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add Next Installment</span>
                            </button>
                          </div>

                          <div className="space-y-2.5">
                            {scheduledInstallments.map((inst, iIdx) => (
                              <div
                                key={inst.id || iIdx}
                                className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2"
                              >
                                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                                  <span>Installment #{iIdx + 2} Details</span>
                                  {scheduledInstallments.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveScheduledInstallment(iIdx)}
                                      className="text-rose-400 hover:text-rose-300 text-[11px] flex items-center gap-1 cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Remove</span>
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-[11px] text-slate-400 mb-1">
                                      Due Date *
                                    </label>
                                    <input
                                      type="date"
                                      value={inst.dueDate}
                                      onChange={(e) => handleUpdateScheduledInstallment(iIdx, 'dueDate', e.target.value)}
                                      className="w-full px-3 py-1.5 text-xs border border-slate-700 rounded-lg bg-slate-900 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                      required
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] text-slate-400 mb-1">
                                      Expected Amount (₹) *
                                    </label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={inst.amount}
                                      onChange={(e) => handleUpdateScheduledInstallment(iIdx, 'amount', e.target.value)}
                                      className="w-full px-3 py-1.5 text-xs border border-slate-700 rounded-lg bg-slate-900 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                      placeholder="e.g. 2000"
                                      required
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Allocation Status Indicator */}
                          {unscheduledDues > 0 ? (
                            <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/40 text-[11px] text-amber-200 flex items-center justify-between">
                              <span>
                                ⏳ <strong>₹{unscheduledDues.toLocaleString('en-IN')}</strong> balance remaining to schedule.
                              </span>
                              <button
                                type="button"
                                onClick={handleAddScheduledInstallment}
                                className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-all text-xs cursor-pointer"
                              >
                                Auto Schedule Next
                              </button>
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-[11px] text-emerald-200 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>
                                ✓ 100% of remaining balance (₹{calculatedRemainingDues.toLocaleString('en-IN')}) scheduled across {scheduledInstallments.length} installment(s).
                              </span>
                            </div>
                          )}

                          <p className="text-[11px] text-slate-400">
                            📲 Automated WhatsApp dues reminder will be dispatched to parent before each scheduled installment date.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 5. Multi-Batch Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Assign Training Batches (Select 1, 2 or more) *
                </label>
                <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                  {selectedBatchIds.length} batch{selectedBatchIds.length === 1 ? '' : 'es'} selected
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {batches.map((b) => {
                  const isSelected = selectedBatchIds.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleBatch(b.id)}
                      className={`text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                        isSelected
                          ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-500 shadow-sm ring-1 ring-indigo-500/50'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 pointer-events-none"
                      />
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-950 dark:text-indigo-200' : 'text-slate-800 dark:text-slate-200'}`}>
                          {b.name}
                        </div>
                        {b.subject && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {b.subject}
                          </div>
                        )}
                        {(b.startTime || b.endTime) && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            ⏰ {b.startTime || ''}{b.endTime ? ` - ${b.endTime}` : ''}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedBatchIds.length === 0 ? (
                <p className="text-[11px] font-medium text-rose-500">
                  ⚠️ Mandatory: Select at least 1 batch so student appears in attendance roll-call.
                </p>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  💡 Student will automatically appear in attendance roll-call for each selected batch.
                </p>
              )}
            </div>

            {/* 6. Continuous Entry / Fast Batch Mode for 30-40 Students */}
            <div className="p-3 bg-indigo-50/80 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/80 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-base flex-shrink-0">
                  ⚡
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Continuous Entry Mode (Fast 30–40 Students)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Keep form open after saving to immediately enter the next student.
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-3">
                <input
                  type="checkbox"
                  checked={keepModalOpen}
                  onChange={(e) => setKeepModalOpen(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* 7. Status */}
            <Select
              label="Enrollment Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="ACTIVE">Active Student</option>
              <option value="INACTIVE">Inactive / Archived</option>
            </Select>
          </div>

          <div className="flex justify-between items-center gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-400">
              {keepModalOpen ? '⚡ Fast Batch Mode ON' : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={formLoading}>
                {formLoading ? 'Saving...' : keepModalOpen ? 'Save & Add Next Student' : 'Enroll Student'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* EDIT STUDENT MODAL — CLEAN, PRESERVES EXISTING DATA */}
      {/* ========================================================================= */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Student Record" maxWidth="lg">
        <form onSubmit={handleUpdateStudent} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-3.5">
            {/* 1. Student Full Name */}
            <Input
              label="Student Full Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            {/* 2. Parent / Guardian Name */}
            <Input
              label="Parent / Guardian Name *"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              required
            />

            {/* 3. Parent WhatsApp Number */}
            <PhoneInput
              label="Parent WhatsApp Number (Primary contact)"
              required
              value={parentWhatsapp}
              onChange={setParentWhatsapp}
              placeholder="98765 43210"
              helperText="Attendance and receipts are dispatched to this WhatsApp number."
            />

            {/* 4. Student Mobile Number */}
            <PhoneInput
              label="Student Mobile Number (Optional)"
              value={studentMobile}
              onChange={setStudentMobile}
              placeholder="98765 43211"
              helperText="Leave empty if not required"
            />

            {/* Admission / Joining Date */}
            <Input
              label="Admission / Joining Date"
              type="date"
              value={admissionDate}
              onChange={(e) => setAdmissionDate(e.target.value)}
            />

            {/* Course & Fee Plan Selection */}
            <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/60 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Select
                    label="Course / Training Plan *"
                    value={selectedPlanId}
                    onChange={(e) => {
                      const planId = e.target.value;
                      setSelectedPlanId(planId);
                      if (planId === 'CURRENT') {
                        if (editingStudent) {
                          setCourse(editingStudent.course || '');
                          setMonthlyFee(editingStudent.monthlyFee || 0);
                          if (editingStudent.feeDueDay) setFeeDueDay(editingStudent.feeDueDay);
                        }
                      } else if (planId === 'CUSTOM') {
                        // Manual entry mode
                      } else if (planId) {
                        const found = feePlans.find((p) => p.id === planId);
                        if (found) {
                          setCourse(found.name);
                          setMonthlyFee(Number(found.amount));
                          if (found.due_day) setFeeDueDay(found.due_day);
                        }
                      }
                    }}
                  >
                    {/* Current course option if not already a standard plan ID match */}
                    {course && !feePlans.some((p) => p.id === selectedPlanId) && (
                      <option value="CURRENT">
                        🎯 Current: {course} ({monthlyFee ? `₹${monthlyFee}` : 'No Fee'})
                      </option>
                    )}
                    <option value="">-- Select Course / Training Plan --</option>
                    {feePlans.filter((p) => p.active !== false).map((p) => (
                      <option key={p.id} value={p.id}>
                        🥋 {p.name} — ₹{Number(p.amount).toLocaleString('en-IN')} / {p.frequency ? p.frequency.toLowerCase() : 'cycle'}
                      </option>
                    ))}
                    <option value="CUSTOM">✏️ Custom Course / Other Entry</option>
                  </Select>
                </div>

                <div>
                  <Input
                    label="Fee Amount (₹) *"
                    type="number"
                    min="0"
                    step="1"
                    value={monthlyFee === 0 ? '' : monthlyFee}
                    onChange={(e) => setMonthlyFee(Number(e.target.value))}
                    placeholder="e.g. 700"
                    required
                  />
                </div>
              </div>

              {selectedPlanId === 'CUSTOM' && (
                <div className="pt-1">
                  <Input
                    label="Custom Course Name *"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    placeholder="e.g. Kalarippayattu (Special Batch)"
                    required
                  />
                </div>
              )}
            </div>

            {/* 5. Multi-Batch Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Assigned Training Batches (Select 1, 2 or more) *
                </label>
                <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                  {selectedBatchIds.length} batch{selectedBatchIds.length === 1 ? '' : 'es'} assigned
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {batches.map((b) => {
                  const isSelected = selectedBatchIds.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleBatch(b.id)}
                      className={`text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                        isSelected
                          ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-500 shadow-sm ring-1 ring-indigo-500/50'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 pointer-events-none"
                      />
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-950 dark:text-indigo-200' : 'text-slate-800 dark:text-slate-200'}`}>
                          {b.name}
                        </div>
                        {b.subject && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {b.subject}
                          </div>
                        )}
                        {(b.startTime || b.endTime) && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            ⏰ {b.startTime || ''}{b.endTime ? ` - ${b.endTime}` : ''}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedBatchIds.length === 0 ? (
                <p className="text-[11px] font-medium text-rose-500">
                  ⚠️ Please select at least 1 batch for attendance tracking.
                </p>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  💡 Student will appear in attendance roll-call for all selected batches.
                </p>
              )}
            </div>

            {/* 6. WhatsApp Opt-in Card */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    WhatsApp Automated Notifications
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Enable or disable automated WhatsApp dispatches for this parent.
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-3">
                <input
                  type="checkbox"
                  checked={whatsappOptIn}
                  onChange={(e) => setWhatsappOptIn(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* 7. Status */}
            <Select
              label="Enrollment Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="ACTIVE">Active Student</option>
              <option value="INACTIVE">Inactive / Archived</option>
            </Select>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={formLoading}>
              {formLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !deleteLoading && setIsDeleteModalOpen(false)}
        title="Delete Student Record"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400" />
            <div className="text-xs">
              <span className="font-semibold">Permanent Action:</span> Are you sure you want to permanently delete{' '}
              <span className="font-bold">{studentToDelete?.name}</span>? This will unenroll them from batches, remove their attendance records, and delete pending fees.
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            This action cannot be undone.
          </p>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              disabled={deleteLoading}
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              isLoading={deleteLoading}
              onClick={handleConfirmDelete}
            >
              Delete Student
            </Button>
          </div>
        </div>
      </Modal>

      {/* Quick Add Course Modal */}
      <Modal isOpen={isCreateCourseModalOpen} onClose={() => setIsCreateCourseModalOpen(false)} title="Add New Course Plan">
        <form onSubmit={handleQuickCreateCourse} className="space-y-4">
          <Input
            label="Course / Plan Name *"
            required
            placeholder="e.g. Boxing & Kickboxing"
            value={newCourseForm.name}
            onChange={(e) => setNewCourseForm({ ...newCourseForm, name: e.target.value })}
          />
          <Input
            label="Standard Fee Amount (₹) *"
            type="number"
            min="0"
            step="1"
            required
            placeholder="e.g. 700"
            value={newCourseForm.amount}
            onChange={(e) => setNewCourseForm({ ...newCourseForm, amount: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Billing Frequency"
              value={newCourseForm.frequency}
              onChange={(e) => setNewCourseForm({ ...newCourseForm, frequency: e.target.value })}
            >
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="ONE_TIME">One Time</option>
            </Select>
            <Input
              label="Due Day of Month (1-31)"
              type="number"
              min="1"
              max="31"
              required
              value={newCourseForm.dueDay}
              onChange={(e) => setNewCourseForm({ ...newCourseForm, dueDay: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsCreateCourseModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={creatingCourse}>
              {creatingCourse ? 'Creating...' : 'Save & Select Course'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Custom WhatsApp Composer Modal for Students */}
      <Modal
        isOpen={isWaModalOpen}
        onClose={() => setIsWaModalOpen(false)}
        title="Compose WhatsApp Message"
        maxWidth="md"
      >
        {waTargetStudent && (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Recipient: </span>
                <span className="font-bold text-slate-900 dark:text-white">{waTargetStudent.name}</span>
                {waTargetStudent.parentName && (
                  <span className="text-slate-500 dark:text-slate-400"> ({waTargetStudent.parentName})</span>
                )}
              </div>
              <div className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                {waTargetStudent.parentWhatsapp}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Message Body (Editable) *
              </label>
              <textarea
                rows={5}
                value={waCustomMessage}
                onChange={(e) => setWaCustomMessage(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none leading-relaxed"
                placeholder="Type your message here..."
              />
              <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
                <span>Direct delivery via Gurukul WhatsApp bridge</span>
                <span>{waCustomMessage.length} characters</span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setIsWaModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSendCustomWhatsApp}
                disabled={sendingWa || !waCustomMessage.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                <span>{sendingWa ? 'Sending...' : 'Send WhatsApp'}</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
