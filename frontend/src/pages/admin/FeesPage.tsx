import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PublicationsPage } from './PublicationsPage';
import { TournamentsPage } from './TournamentsPage';
import {
  CreditCard,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  Banknote,
  MessageSquare,
  Edit2,
  BookMarked,
  Trophy,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { FeePlan, StudentFee } from '../../types/fee';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { ReceiptModal } from '../../components/common/ReceiptModal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { API_BASE } from '../../lib/api';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function formatBillingPeriod(periodStr: string): string {
  if (!periodStr || !periodStr.includes('-')) return periodStr;
  const [year, month] = periodStr.split('-');
  const monthIdx = parseInt(month, 10) - 1;
  if (monthIdx >= 0 && monthIdx < 12) {
    return `${MONTH_NAMES[monthIdx]} ${year}`;
  }
  return periodStr;
}

const generateMonthlyPeriodOptions = () => {
  const options: Array<{ value: string; label: string }> = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  for (let year = currentYear - 1; year <= currentYear + 1; year++) {
    for (let m = 1; m <= 12; m++) {
      const val = `${year}-${String(m).padStart(2, '0')}`;
      const label = `${MONTH_NAMES[m - 1]} ${year}`;
      options.push({ value: val, label });
    }
  }
  return options;
};

const monthlyPeriodOptions = generateMonthlyPeriodOptions();

export const FeesPage: React.FC = () => {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const streamParam = searchParams.get('stream');
  const [activeStream, setActiveStream] = useState<'TUITION' | 'PUBLICATIONS' | 'TOURNAMENTS'>(
    streamParam === 'publications' ? 'PUBLICATIONS' : streamParam === 'tournaments' ? 'TOURNAMENTS' : 'TUITION'
  );

  useEffect(() => {
    if (streamParam === 'publications') setActiveStream('PUBLICATIONS');
    else if (streamParam === 'tournaments') setActiveStream('TOURNAMENTS');
    else if (!streamParam) setActiveStream('TUITION');
  }, [streamParam]);

  const [activeTab, setActiveTab] = useState<'student_fees' | 'fee_plans'>('student_fees');
  const [studentFees, setStudentFees] = useState<StudentFee[]>([]);
  const [feePlans, setFeePlans] = useState<FeePlan[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isEditPlanModalOpen, setIsEditPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<FeePlan | null>(null);
  const [editPlanForm, setEditPlanForm] = useState({
    name: '',
    amount: '',
    frequency: 'MONTHLY',
    dueDay: '5',
  });
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState<StudentFee | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalSuccessMessage, setModalSuccessMessage] = useState<string | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [triggeringMonthly, setTriggeringMonthly] = useState(false);
  const [reminderSuccessMessage, setReminderSuccessMessage] = useState<string | null>(null);

  // Form states
  const [planForm, setPlanForm] = useState({
    name: '',
    amount: '',
    frequency: 'MONTHLY',
    dueDay: '10',
  });

  const [assignForm, setAssignForm] = useState({
    studentId: '',
    feePlanId: '',
    billingPeriod: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    amountDue: '',
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 10).toISOString().split('T')[0],
  });

  const [createdReceiptId, setCreatedReceiptId] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({
    amount: '',
    paymentMethod: 'CASH',
    provider: 'MANUAL',
    notes: 'Cash payment received at front desk',
  });

  // Fetch data
  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [feesRes, plansRes, studentsRes] = await Promise.all([
        fetch(`${API_BASE}/fees/students`, { headers }),
        fetch(`${API_BASE}/fees/plans`, { headers }),
        fetch(`${API_BASE}/students?status=ACTIVE`, { headers }),
      ]);

      const feesData = await feesRes.json();
      const plansData = await plansRes.json();
      const studentsData = await studentsRes.json();

      if (feesData.success && Array.isArray(feesData.data)) setStudentFees(feesData.data);
      if (plansData.success && Array.isArray(plansData.data)) setFeePlans(plansData.data);
      if (studentsData.success && Array.isArray(studentsData.data)) setStudents(studentsData.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load fee information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Handle plan create
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/fees/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: planForm.name,
          amount: parseFloat(planForm.amount),
          frequency: planForm.frequency,
          dueDay: parseInt(planForm.dueDay, 10),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Plan creation failed');

      setIsPlanModalOpen(false);
      setPlanForm({ name: '', amount: '', frequency: 'MONTHLY', dueDay: '10' });
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle fee assignment
  const handleAssignFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/fees/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentId: assignForm.studentId,
          feePlanId: assignForm.feePlanId || undefined,
          billingPeriod: assignForm.billingPeriod,
          amountDue: parseFloat(assignForm.amountDue),
          dueDate: assignForm.dueDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error?.code === 'DUPLICATE_FEE_ASSIGNMENT' || data.error?.message?.includes('already assigned')) {
          throw new Error(`Duplicate Fee Period: This student already has fee assigned for ${formatBillingPeriod(assignForm.billingPeriod)}. Each student can only receive one fee assignment per monthly period.`);
        }
        throw new Error(data.error?.message || 'Fee assignment failed');
      }

      setIsAssignModalOpen(false);
      setAssignForm({
        studentId: '',
        feePlanId: '',
        billingPeriod: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        amountDue: '',
        dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 10).toISOString().split('T')[0],
      });
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-fill amount when fee plan selected
  const handlePlanSelect = (planId: string) => {
    const selected = feePlans.find((p) => p.id === planId);
    if (selected) {
      setAssignForm((prev) => ({
        ...prev,
        feePlanId: planId,
        amountDue: String(selected.amount),
      }));
    } else {
      setAssignForm((prev) => ({ ...prev, feePlanId: planId }));
    }
  };

  // Open pay modal
  const handleOpenPay = (fee: StudentFee, defaultMode: 'CASH' | 'MOCK' = 'CASH') => {
    setSelectedFee(fee);
    setPayForm({
      amount: String(fee.pending_amount),
      paymentMethod: 'CASH',
      provider: defaultMode === 'CASH' ? 'MANUAL' : 'MOCK',
      notes: defaultMode === 'CASH' ? 'Cash payment received at front desk' : '',
    });
    setModalSuccessMessage(null);
    setIsPayModalOpen(true);
  };

  // Handle payment record submission
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedFee) return;
    setSubmitting(true);
    setError(null);
    setModalSuccessMessage(null);

    try {
      const amountNum = parseFloat(payForm.amount);
      let newReceiptId: string | null = null;

      if (payForm.provider === 'MANUAL') {
        const res = await fetch(`${API_BASE}/payments/manual`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            studentId: selectedFee.student_id,
            studentFeeId: selectedFee.id,
            amount: amountNum,
            paymentMethod: payForm.paymentMethod,
            notes: payForm.notes || 'Cash payment received at front desk',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Payment recording failed');

        newReceiptId = data.data?.receipt?.id || null;
        const receiptNo = data.data?.receipt?.receipt_number || 'Issued';
        setModalSuccessMessage(`Payment recorded successfully! Receipt: ${receiptNo}`);
      } else {
        const orderRes = await fetch(`${API_BASE}/payments/order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            studentId: selectedFee.student_id,
            studentFeeId: selectedFee.id,
            amount: amountNum,
            provider: 'MOCK',
          }),
        });
        const orderData = await orderRes.json();
        if (!orderRes.ok) throw new Error(orderData.error?.message || 'Order creation failed');

        const { paymentRecordId, orderId } = orderData.data;
        const mockPaymentId = `mock_pay_${Date.now()}`;
        const verifyRes = await fetch(`${API_BASE}/payments/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            paymentRecordId,
            orderId,
            paymentId: mockPaymentId,
            signature: 'mock_valid_signature',
            provider: 'MOCK',
          }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyRes.ok) throw new Error(verifyData.error?.message || 'Payment verification failed');

        newReceiptId = verifyData.data?.receipt?.id || null;
        const receiptNo = verifyData.data?.receipt?.receipt_number || 'Generated';
        setModalSuccessMessage(
          `Verified & Completed! Receipt #${receiptNo} (Provider: MOCK)`
        );
      }

      await fetchData();
      setTimeout(() => {
        setIsPayModalOpen(false);
        if (newReceiptId) {
          setCreatedReceiptId(newReceiptId);
        }
      }, 700);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Send WhatsApp Fee Reminder with payment link
  const handleSendWhatsAppReminder = async (fee: StudentFee) => {
    if (!token) return;
    setSendingReminderId(fee.id);
    setError(null);
    setReminderSuccessMessage(null);
    try {
      const res = await fetch(`${API_BASE}/whatsapp/trigger-fee-reminder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentFeeId: fee.id,
          studentId: fee.student_id,
          eventType: fee.status === 'OVERDUE' ? 'FEE_OVERDUE' : 'FEE_DUE',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to dispatch WhatsApp fee reminder');
      }

      setReminderSuccessMessage(
        `WhatsApp reminder sent to ${fee.student?.name || 'student'} (${data.data?.recipient_phone || 'recipient'})! Queued safely for dispatch.`
      );
      setTimeout(() => setReminderSuccessMessage(null), 6000);
    } catch (err: any) {
      setError(err.message || 'Error sending WhatsApp reminder');
    } finally {
      setSendingReminderId(null);
    }
  };

  const handleTriggerMonthlyReminders = async () => {
    if (!token) return;
    setTriggeringMonthly(true);
    setError(null);
    setReminderSuccessMessage(null);
    try {
      const res = await fetch(`${API_BASE}/whatsapp/remind/monthly-fees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to trigger monthly reminders');

      setReminderSuccessMessage(
        `Monthly fee reminders queued for ${data.data?.queuedCount || 0} students! Dispatched safely via WhatsApp queue.`
      );
      setTimeout(() => setReminderSuccessMessage(null), 8000);
    } catch (err: any) {
      setError(err.message || 'Error triggering monthly fee reminders');
    } finally {
      setTriggeringMonthly(false);
    }
  };

  const handleOpenEditPlan = (plan: FeePlan) => {
    setEditingPlan(plan);
    setEditPlanForm({
      name: plan.name,
      amount: String(plan.amount),
      frequency: plan.frequency || 'MONTHLY',
      dueDay: String(plan.due_day || 5),
    });
    setIsEditPlanModalOpen(true);
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingPlan) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/fees/plans/${editingPlan.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editPlanForm.name.trim(),
          amount: parseFloat(editPlanForm.amount),
          frequency: editPlanForm.frequency,
          dueDay: parseInt(editPlanForm.dueDay, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update fee plan');
      setIsEditPlanModalOpen(false);
      setEditingPlan(null);
      setReminderSuccessMessage(`Course fee plan "${editPlanForm.name}" updated successfully!`);
      setTimeout(() => setReminderSuccessMessage(null), 5000);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Error updating fee plan');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle plan active status
  const handleTogglePlan = async (id: string, currentActive: boolean) => {
    if (!token) return;
    try {
      const endpoint = currentActive ? 'deactivate' : 'activate';
      await fetch(`${API_BASE}/fees/plans/${id}/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Metrics calculation
  const totalBilled = (studentFees || []).reduce((acc, f) => acc + Number(f?.amount_due || 0), 0);
  const totalCollected = (studentFees || []).reduce((acc, f) => acc + Number(f?.amount_paid || 0), 0);
  const totalPending = (studentFees || []).reduce((acc, f) => acc + Number(f?.pending_amount || 0), 0);
  const overdueCount = (studentFees || []).filter((f) => f?.status === 'OVERDUE').length;

  // Filtered student fees
  const q = (searchQuery || '').trim().toLowerCase();
  const filteredFees = (studentFees || []).filter((fee) => {
    const studentName = (fee.student?.name || '').toLowerCase();
    const billingPeriod = (fee.billing_period || '').toLowerCase();
    const planName = (fee.fee_plan?.name || '').toLowerCase();

    const matchesSearch =
      !q ||
      studentName.includes(q) ||
      billingPeriod.includes(q) ||
      planName.includes(q);

    const matchesStatus = statusFilter === 'ALL' || fee.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 3-Stream Segregated Fee Navigation */}
      <div className="p-3 bg-gradient-to-r from-slate-900 to-[#0F172A] border border-white/10 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fee Stream:</span>
          <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
            <button
              type="button"
              onClick={() => {
                setActiveStream('TUITION');
                setSearchParams({});
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeStream === 'TUITION'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Academy Tuition Fees
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveStream('PUBLICATIONS');
                setSearchParams({ stream: 'publications' });
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeStream === 'PUBLICATIONS'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <BookMarked className={`w-3.5 h-3.5 ${activeStream === 'PUBLICATIONS' ? 'text-slate-950' : 'text-blue-400'}`} />
              Published Document Fees
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${
                activeStream === 'PUBLICATIONS' ? 'bg-black/20 text-slate-950' : 'bg-blue-500/20 text-blue-300'
              }`}>
                Annual
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveStream('TOURNAMENTS');
                setSearchParams({ stream: 'tournaments' });
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeStream === 'TOURNAMENTS'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Trophy className={`w-3.5 h-3.5 ${activeStream === 'TOURNAMENTS' ? 'text-slate-950' : 'text-amber-400'}`} />
              Tournament Entry Fees
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${
                activeStream === 'TOURNAMENTS' ? 'bg-black/20 text-slate-950' : 'bg-amber-500/20 text-amber-300'
              }`}>
                Per Event
              </span>
            </button>
          </div>
        </div>

        <span className="text-xs text-slate-400 hidden lg:inline">
          Accounting Rule: Publication &amp; tournament revenues are fully segregated from recurring academy tuition.
        </span>
      </div>

      {activeStream === 'PUBLICATIONS' ? (
        <PublicationsPage embedded={true} />
      ) : activeStream === 'TOURNAMENTS' ? (
        <TournamentsPage embedded={true} />
      ) : (
        <>
          {/* Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-slate-800">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Fee &amp; Billing Operations
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Monitor academy receivables, configure fee plans, and manage student fee schedules.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <Button
                variant="secondary"
                onClick={handleTriggerMonthlyReminders}
                disabled={triggeringMonthly}
                className="gap-2 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-semibold text-xs sm:text-sm"
                title="Trigger automated WhatsApp fee reminders for unpaid monthly fees (15s throttle)"
              >
                <MessageSquare className={`w-4 h-4 text-emerald-600 ${triggeringMonthly ? 'animate-spin' : ''}`} />
                <span>{triggeringMonthly ? 'Queuing Reminders...' : 'Send Monthly 5th Reminders'}</span>
              </Button>

              {activeTab === 'student_fees' ? (
                <Button
                  onClick={() => setIsAssignModalOpen(true)}
                  className="gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Assign Student Fee
                </Button>
              ) : (
                <Button
                  onClick={() => setIsPlanModalOpen(true)}
                  className="gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Course / Fee Plan
                </Button>
              )}
            </div>
          </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm flex items-center gap-2.5 shadow-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {reminderSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-2.5 shadow-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium">{reminderSuccessMessage}</span>
        </div>
      )}

      {/* 4 Financial KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card hoverEffect accent="indigo" className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Billed</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800/60">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">₹{totalBilled.toLocaleString('en-IN')}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Across all assigned student fee dues</p>
          </div>
        </Card>

        <Card hoverEffect accent="emerald" className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Collected</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-800/60">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-400 tracking-tight">₹{totalCollected.toLocaleString('en-IN')}</div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
              {totalBilled > 0 ? `${Math.round((totalCollected / totalBilled) * 100)}% recovery rate` : 'No billing yet'}
            </p>
          </div>
        </Card>

        <Card hoverEffect accent="amber" className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pending Dues</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-800/60">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">₹{totalPending.toLocaleString('en-IN')}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Awaiting settlement by parents</p>
          </div>
        </Card>

        <Card hoverEffect accent="rose" className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Overdue Invoices</span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100 dark:border-rose-800/60">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">{overdueCount}</div>
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-1">Invoices past grace due date</p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-900 p-1 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <button
          onClick={() => setActiveTab('student_fees')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'student_fees'
              ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
          }`}
        >
          Student Dues Ledger ({studentFees.length})
        </button>
        <button
          onClick={() => setActiveTab('fee_plans')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'fee_plans'
              ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
          }`}
        >
          Fee Structure Plans ({feePlans.length})
        </button>
      </div>

      {/* Tab 1: Student Fees Table */}
      {activeTab === 'student_fees' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <Card className="p-4 border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by student name, period, or plan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2 text-sm border border-slate-200/90 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-slate-50/50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 transition-all"
                />
              </div>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-44 text-xs h-10"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Only</option>
                <option value="PARTIAL">Partial Only</option>
                <option value="PAID">Paid Only</option>
                <option value="OVERDUE">Overdue Only</option>
              </Select>
            </div>
          </Card>

          {loading ? (
            <SkeletonLoader variant="table" rows={6} />
          ) : filteredFees.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title={
                searchQuery || statusFilter !== 'ALL'
                  ? 'No fee records found'
                  : `No fee records for ${MONTH_NAMES[new Date().getMonth()]} ${new Date().getFullYear()}`
              }
              description={
                searchQuery || statusFilter !== 'ALL'
                  ? 'No student fee invoices match your search filters.'
                  : `Assign student fees for ${MONTH_NAMES[new Date().getMonth()]} ${new Date().getFullYear()} to begin tracking collections.`
              }
              actionLabel="Assign Student Fee"
              onAction={() => setIsAssignModalOpen(true)}
              accentColor="indigo"
            />
          ) : (
            <Card className="border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Student</th>
                      <th className="px-5 py-3.5">Fee Plan</th>
                      <th className="px-5 py-3.5">Billing Period</th>
                      <th className="px-5 py-3.5">Due Date</th>
                      <th className="px-5 py-3.5">Amount Due</th>
                      <th className="px-5 py-3.5">Paid / Pending</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {filteredFees.map((fee) => (
                      <tr key={fee.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100 leading-tight">
                            {fee.student?.name || 'Unknown Student'}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            ID: {fee.student_id.substring(0, 8)}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                            {fee.fee_plan?.name || 'Custom Plan'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {formatBillingPeriod(fee.billing_period)}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                            {fee.billing_period}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-400">
                          {fee.due_date ? new Date(fee.due_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-5 py-4 font-bold text-slate-900 dark:text-slate-100">
                          ₹{Number(fee.amount_due).toLocaleString('en-IN')}
                        </td>
                        <td className="px-5 py-4 text-xs">
                          <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                            ₹{Number(fee.amount_paid).toLocaleString('en-IN')} paid
                          </div>
                          {Number(fee.pending_amount) > 0 && (
                            <div className="text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                              ₹{Number(fee.pending_amount).toLocaleString('en-IN')} pending
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={fee.status} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          {fee.status !== 'PAID' && (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSendWhatsAppReminder(fee)}
                                disabled={sendingReminderId === fee.id}
                                className="text-xs h-8 px-2.5 gap-1.5 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/80 bg-emerald-50/50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                                title="Send WhatsApp Fee Reminder with Payment Link"
                              >
                                <MessageSquare className={`w-3.5 h-3.5 text-emerald-600 ${sendingReminderId === fee.id ? 'animate-spin' : ''}`} />
                                <span>{sendingReminderId === fee.id ? 'Sending...' : 'WhatsApp Reminder'}</span>
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleOpenPay(fee, 'CASH')}
                                className="text-xs h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 shadow-xs transition-transform active:scale-95"
                                title="Collect cash fee at front desk & issue instant receipt"
                              >
                                <Banknote className="w-3.5 h-3.5" />
                                <span>Collect Cash</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenPay(fee, 'MOCK')}
                                className="text-xs h-8 px-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Record other payment method (Online / Razorpay / Cheque)"
                              >
                                Online / Other
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Tab 2: Fee Plans Table */}
      {activeTab === 'fee_plans' && (
        <Card className="border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Plan Name</th>
                  <th className="px-5 py-3.5">Standard Amount</th>
                  <th className="px-5 py-3.5">Billing Frequency</th>
                  <th className="px-5 py-3.5">Due Day</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {feePlans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">{plan.name}</td>
                    <td className="px-5 py-4 font-bold text-indigo-700 dark:text-indigo-400">
                      ₹{Number(plan.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-transparent dark:border-slate-700">
                        {plan.frequency}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-400">
                      Day {plan.due_day} of cycle
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={plan.active ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditPlan(plan)}
                          className="text-xs h-8 px-2.5 gap-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit Course Fee Plan"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTogglePlan(plan.id, plan.active)}
                          className={`text-xs h-8 px-2.5 ${
                            plan.active
                              ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-200 dark:hover:border-rose-800/60'
                              : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-200 dark:hover:border-emerald-800/60'
                          }`}
                        >
                          {plan.active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal 1: Create Fee Plan */}
      <Modal isOpen={isPlanModalOpen} onClose={() => setIsPlanModalOpen(false)} title="Add New Course / Fee Plan">
        <form onSubmit={handleCreatePlan} className="space-y-4">
          <Input
            label="Plan / Course Name *"
            required
            placeholder="e.g. Kalarippayattu (Monthly)"
            value={planForm.name}
            onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
          />
          <Input
            label="Standard Amount (₹) *"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="e.g. 700"
            value={planForm.amount}
            onChange={(e) => setPlanForm({ ...planForm, amount: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Billing Frequency"
              value={planForm.frequency}
              onChange={(e) => setPlanForm({ ...planForm, frequency: e.target.value })}
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
              value={planForm.dueDay}
              onChange={(e) => setPlanForm({ ...planForm, dueDay: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsPlanModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Course Plan'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 1.5: Edit Fee Structure Plan */}
      <Modal isOpen={isEditPlanModalOpen} onClose={() => setIsEditPlanModalOpen(false)} title="Edit Fee Structure Plan">
        <form onSubmit={handleUpdatePlan} className="space-y-4">
          <Input
            label="Plan / Course Name *"
            required
            placeholder="e.g. Kalarippayattu (Monthly)"
            value={editPlanForm.name}
            onChange={(e) => setEditPlanForm({ ...editPlanForm, name: e.target.value })}
          />
          <Input
            label="Standard Amount (₹) *"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="e.g. 700"
            value={editPlanForm.amount}
            onChange={(e) => setEditPlanForm({ ...editPlanForm, amount: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Billing Frequency"
              value={editPlanForm.frequency}
              onChange={(e) => setEditPlanForm({ ...editPlanForm, frequency: e.target.value })}
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
              value={editPlanForm.dueDay}
              onChange={(e) => setEditPlanForm({ ...editPlanForm, dueDay: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsEditPlanModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Assign Student Fee */}
      <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title="Assign Fee to Student" maxWidth="lg">
        <form onSubmit={handleAssignFee} className="space-y-4">
          <Select
            label="Student *"
            required
            value={assignForm.studentId}
            onChange={(e) => setAssignForm({ ...assignForm, studentId: e.target.value })}
          >
            <option value="">Select a student...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.course || 'General'})
              </option>
            ))}
          </Select>

          <Select
            label="Fee Plan Template (Optional)"
            value={assignForm.feePlanId}
            onChange={(e) => handlePlanSelect(e.target.value)}
          >
            <option value="">Custom / Direct Entry</option>
            {feePlans
              .filter((p) => p.active)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (₹{p.amount} / {p.frequency})
                </option>
              ))}
          </Select>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Billing Period / Month *"
              required
              value={assignForm.billingPeriod}
              onChange={(e) => setAssignForm({ ...assignForm, billingPeriod: e.target.value })}
            >
              {monthlyPeriodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <Input
              label="Amount Due (₹) *"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="e.g. 3500"
              value={assignForm.amountDue}
              onChange={(e) => setAssignForm({ ...assignForm, amountDue: e.target.value })}
            />
          </div>

          <Input
            label="Due Date *"
            type="date"
            required
            value={assignForm.dueDate}
            onChange={(e) => setAssignForm({ ...assignForm, dueDate: e.target.value })}
          />

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Assigning...' : 'Assign Fee'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 3: Record Payment */}
      <Modal isOpen={isPayModalOpen} onClose={() => setIsPayModalOpen(false)} title="Record Fee Payment">
        <form onSubmit={handleRecordPayment} className="space-y-4">
          {modalSuccessMessage && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>{modalSuccessMessage}</span>
            </div>
          )}

          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Student:</span>
              <span className="font-bold text-slate-800 dark:text-white">{selectedFee?.student?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Total Due:</span>
              <span className="font-semibold text-slate-800 dark:text-white">₹{selectedFee?.amount_due}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Outstanding Pending:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">₹{selectedFee?.pending_amount}</span>
            </div>
          </div>

          <Input
            label="Payment Amount (₹) *"
            type="number"
            step="0.01"
            min="1"
            max={selectedFee?.pending_amount}
            required
            value={payForm.amount}
            onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
          />

          {/* Payment Mode Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Payment Mode / Gateway *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPayForm((prev) => ({ ...prev, provider: 'MANUAL', paymentMethod: 'CASH', notes: prev.notes || 'Cash payment received at front desk' }))}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  payForm.provider === 'MANUAL' && payForm.paymentMethod === 'CASH'
                    ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Cash at Desk</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Instant offline receipt
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPayForm((prev) => ({ ...prev, provider: 'MOCK', paymentMethod: 'ONLINE' }))}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  payForm.provider === 'MOCK'
                    ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Razorpay Mock</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Simulate gateway
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPayForm((prev) => ({ ...prev, provider: 'MANUAL', paymentMethod: 'BANK_TRANSFER' }))}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  payForm.provider === 'MANUAL' && payForm.paymentMethod !== 'CASH'
                    ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Bank / Cheque</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  NEFT, IMPS or Cheque
                </div>
              </button>
            </div>
          </div>

          {payForm.provider === 'MANUAL' && payForm.paymentMethod !== 'CASH' && (
            <Select
              label="Bank / Offline Method"
              value={payForm.paymentMethod}
              onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
            >
              <option value="BANK_TRANSFER">Direct Bank Transfer / NEFT / IMPS</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER">Other POS</option>
            </Select>
          )}

          <Input
            label="Remarks / Notes (Optional)"
            placeholder="e.g. Received by front desk receptionist"
            value={payForm.notes}
            onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
          />

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsPayModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className={
                payForm.provider === 'MANUAL' && payForm.paymentMethod === 'CASH'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-sm'
                  : ''
              }
            >
              {submitting
                ? 'Processing...'
                : payForm.provider === 'MANUAL' && payForm.paymentMethod === 'CASH'
                ? `Receive Cash (₹${payForm.amount || '0'}) & Issue Receipt`
                : 'Confirm Payment'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Official Receipt Modal Popup */}
      <ReceiptModal
        receiptId={createdReceiptId}
        onClose={() => setCreatedReceiptId(null)}
      />
        </>
      )}
    </div>
  );
};
