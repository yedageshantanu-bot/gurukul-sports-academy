import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { PaymentRecord, StudentFee } from '../../types/fee';
import {
  Banknote,
  Search,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  CreditCard,
  Printer,
  X,
  Clock,
  MessageSquare,
  DollarSign,
  Calendar,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { API_BASE } from '../../lib/api';
import { formatBillingPeriod } from './FeesPage';

export const PaymentsPage: React.FC = () => {
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState<'accounts' | 'receipts'>('accounts');
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [studentFees, setStudentFees] = useState<StudentFee[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [providerFilter, setProviderFilter] = useState('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState<'ALL' | '1DAY' | '7DAYS' | '30DAYS'>('ALL');

  // Modals & Actions
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendingReminderFeeId, setSendingReminderFeeId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Manual payment form
  const [manualForm, setManualForm] = useState({
    studentId: '',
    studentFeeId: '',
    amount: '',
    paymentMethod: 'CASH',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [paymentsRes, feesRes, studentsRes] = await Promise.all([
        fetch(`${API_BASE}/payments`, { headers }),
        fetch(`${API_BASE}/fees/students`, { headers }),
        fetch(`${API_BASE}/students?status=ACTIVE`, { headers }),
      ]);

      const paymentsData = await paymentsRes.json();
      const feesData = await feesRes.json();
      const studentsData = await studentsRes.json();

      if (paymentsData.success && Array.isArray(paymentsData.data)) setPayments(paymentsData.data);
      if (feesData.success && Array.isArray(feesData.data)) setStudentFees(feesData.data);
      if (studentsData.success && Array.isArray(studentsData.data)) setStudents(studentsData.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load payments history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Open modal prefilled for collecting pending fee
  const handleOpenCollectPayment = (item: any) => {
    const pending = Number(item.pendingBalance || item.pending_amount || 0);
    setManualForm({
      studentId: item.studentId || item.student_id,
      studentFeeId: item.feeId || item.rawFee?.id || '',
      amount: String(pending > 0 ? pending : item.totalPackage || item.amount_due || 700),
      paymentMethod: 'CASH',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: `Settlement for ${item.billingPeriod || item.course || 'Tuition Fee'}`,
    });
    setIsManualModalOpen(true);
  };

  // Handle manual payment submission
  const handleManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!manualForm.studentId) {
      setError('Please select a student from the dropdown list.');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/payments/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentId: manualForm.studentId,
          studentFeeId: manualForm.studentFeeId || undefined,
          amount: parseFloat(manualForm.amount),
          paymentMethod: manualForm.paymentMethod,
          paidAt: manualForm.paymentDate,
          notes: manualForm.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Manual payment recording failed');

      setIsManualModalOpen(false);
      setManualForm({
        studentId: '',
        studentFeeId: '',
        amount: '',
        paymentMethod: 'CASH',
        paymentDate: new Date().toISOString().slice(0, 10),
        notes: '',
      });
      setSuccessToast(`Payment of ₹${data.data?.payment?.amount || manualForm.amount} successfully recorded! Receipt issued.`);
      setTimeout(() => setSuccessToast(null), 6000);
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const [undoingPaymentId, setUndoingPaymentId] = useState<string | null>(null);

  const handleUndoPaymentRecord = async (paymentId: string, studentName: string, amount: number) => {
    if (!token) return;
    const confirmed = window.confirm(
      `Undo / Revert payment of ₹${Number(amount).toLocaleString('en-IN')} for ${studentName}? This will void the official receipt and restore the balance back to student dues.`
    );
    if (!confirmed) return;

    setUndoingPaymentId(paymentId);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/payments/${paymentId}/revert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.message || 'Failed to revert payment');

      setSuccessToast(`✓ Payment of ₹${Number(amount).toLocaleString('en-IN')} reverted! Balance restored for ${studentName}.`);
      setTimeout(() => setSuccessToast(null), 6000);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Error reverting payment');
    } finally {
      setUndoingPaymentId(null);
    }
  };

  const handleUndoAccountPayment = async (account: any) => {
    if (!token) return;
    const targetFeeId = account.feeId || account.rawFee?.id;
    const studentPayments = (payments || []).filter(
      (p) => (p.student_id === account.studentId || p.student?.id === account.studentId) && p.status === 'SUCCESS'
    );
    const latestPayment = studentPayments[0];

    const confirmed = window.confirm(
      `Undo / Revert payment for ${account.studentName}? This will restore the account balance back to Pending/Overdue.`
    );
    if (!confirmed) return;

    setUndoingPaymentId(account.studentId);
    setError(null);
    try {
      let res;
      if (latestPayment) {
        res = await fetch(`${API_BASE}/payments/${latestPayment.id}/revert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      } else if (targetFeeId) {
        res = await fetch(`${API_BASE}/payments/revert-fee/${targetFeeId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      } else {
        throw new Error('No confirmed payment found to revert for this student.');
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.message || 'Failed to revert payment');

      setSuccessToast(`✓ Payment reverted! Balance for ${account.studentName} restored to Pending.`);
      setTimeout(() => setSuccessToast(null), 6000);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Error reverting payment');
    } finally {
      setUndoingPaymentId(null);
    }
  };

  // Handle WhatsApp payment reminder
  const handleSendReminder = async (item: any) => {
    if (!token) return;
    const targetFeeId = item.feeId || item.id;
    if (!targetFeeId) return;

    setSendingReminderFeeId(targetFeeId);
    try {
      const res = await fetch(`${API_BASE}/whatsapp/trigger-fee-reminder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ studentFeeId: targetFeeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to dispatch reminder');
      setSuccessToast(`WhatsApp payment reminder dispatched for ${item.studentName || item.student?.name || 'student'}!`);
      setTimeout(() => setSuccessToast(null), 6000);
    } catch (err: any) {
      setError(err.message || 'Error sending reminder');
    } finally {
      setSendingReminderFeeId(null);
    }
  };

  // Date range checker
  const isWithinDateRange = (dateStr: string | null | undefined, range: 'ALL' | '1DAY' | '7DAYS' | '30DAYS') => {
    if (range === 'ALL' || !dateStr) return range === 'ALL';
    const targetTime = new Date(dateStr).getTime();
    if (isNaN(targetTime)) return true;
    const nowTime = new Date().getTime();
    const diffDays = (nowTime - targetTime) / (1000 * 60 * 60 * 24);

    if (range === '1DAY') return diffDays >= -1 && diffDays <= 1.5;
    if (range === '7DAYS') return diffDays >= -1 && diffDays <= 7.5;
    if (range === '30DAYS') return diffDays >= -1 && diffDays <= 30.5;
    return true;
  };

  // 1-to-1 Mapping: ALL students (both pending and non-pending)
  const allStudentAccounts = useMemo(() => {
    const studentMap = new Map<string, any>();

    // 1. Process all active students first
    (students || []).forEach((s) => {
      // Reconcile all confirmed payments for this student
      const studentPayments = (payments || []).filter(
        (p) => (p.student_id === s.id || p.student?.id === s.id) && p.status === 'SUCCESS'
      );
      const totalPaidLogs = studentPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
      const pkg = Number(s.monthlyFee || 0);
      const pending = Math.max(0, pkg - totalPaidLogs);

      let st = 'PENDING';
      if (totalPaidLogs >= pkg && pkg > 0) st = 'PAID';
      else if (totalPaidLogs > 0) st = 'PARTIAL';
      else if (pkg === 0) st = 'PAID';

      studentMap.set(s.id, {
        id: s.id,
        studentId: s.id,
        studentName: s.name,
        parentName: s.parentName,
        parentWhatsapp: s.parentWhatsapp,
        studentMobile: s.studentMobile,
        course: s.course || 'Martial Arts Training',
        totalPackage: pkg,
        amountPaid: totalPaidLogs,
        pendingBalance: pending,
        dueDate: null,
        admissionDate: s.admissionDate || s.admission_date || s.createdAt || s.created_at,
        billingPeriod: 'Current Enrollment',
        status: st,
        rawFee: null,
      });
    });

    // 2. Attach actual fee records
    (studentFees || []).forEach((f) => {
      const studentId = f.student_id;
      const existing = studentMap.get(studentId);
      const totalAmount = Number(f.amount_due || 0) || Number(existing?.totalPackage || 0);

      // Reconcile payments matching this student or fee
      const studentPayments = (payments || []).filter(
        (p) => (p.student_id === studentId || p.student?.id === studentId || p.student_fee_id === f.id) && p.status === 'SUCCESS'
      );
      const totalPaidLogs = studentPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
      const paid = Math.max(Number(f.amount_paid || 0), totalPaidLogs);
      const pending = Math.max(0, totalAmount - paid);

      let calculatedStatus = f.status || 'PENDING';
      if (paid >= totalAmount && totalAmount > 0) {
        calculatedStatus = 'PAID';
      } else if (paid > 0 && pending > 0) {
        calculatedStatus = 'PARTIAL';
      }

      const accountData = {
        id: f.id,
        feeId: f.id,
        studentId: studentId,
        studentName: f.student?.name || existing?.studentName || 'Student',
        parentName: existing?.parentName,
        parentWhatsapp: f.student?.parent_whatsapp || existing?.parentWhatsapp,
        studentMobile: f.student?.student_mobile || existing?.studentMobile,
        course: f.student?.course || existing?.course || 'Martial Arts Training',
        totalPackage: totalAmount,
        amountPaid: paid,
        pendingBalance: pending,
        dueDate: f.due_date,
        admissionDate: existing?.admissionDate,
        billingPeriod: f.billing_period,
        planName: f.fee_plan?.name || (f.billing_period?.includes('YEARLY') ? 'Annual Package' : 'Regular Plan'),
        status: calculatedStatus,
        rawFee: f,
      };

      studentMap.set(studentId, accountData);
    });

    return Array.from(studentMap.values());
  }, [students, studentFees, payments]);

  // Overall Financial Metrics
  const totalBilledReceivables = useMemo(() => {
    return allStudentAccounts.reduce((acc, a) => acc + Number(a.totalPackage || 0), 0);
  }, [allStudentAccounts]);

  const totalSettledRevenue = (payments || [])
    .filter((p) => p.status === 'SUCCESS')
    .reduce((acc, p) => acc + Number(p.amount || 0), 0);

  const totalPendingDues = useMemo(() => {
    return allStudentAccounts.reduce((acc, a) => acc + Number(a.pendingBalance || 0), 0);
  }, [allStudentAccounts]);

  const pendingAccountsCount = useMemo(() => {
    return allStudentAccounts.filter((a) => a.pendingBalance > 0).length;
  }, [allStudentAccounts]);

  const successCount = (payments || []).filter((p) => p.status === 'SUCCESS').length;

  // Search & Filtered Student Accounts
  const q = (searchQuery || '').trim().toLowerCase();

  const filteredStudentAccounts = useMemo(() => {
    return allStudentAccounts.filter((account) => {
      const matchSearch =
        !q ||
        account.studentName.toLowerCase().includes(q) ||
        (account.course && account.course.toLowerCase().includes(q)) ||
        (account.parentWhatsapp && account.parentWhatsapp.includes(q)) ||
        (account.billingPeriod && account.billingPeriod.toLowerCase().includes(q));

      const matchStatus =
        statusFilter === 'ALL' ||
        account.status === statusFilter ||
        (statusFilter === 'PENDING' && (account.status === 'PENDING' || account.status === 'PARTIAL' || account.status === 'OVERDUE'));

      const matchDate =
        dateRangeFilter === 'ALL' ||
        isWithinDateRange(account.dueDate || account.rawFee?.due_date || account.rawFee?.created_at || account.admissionDate, dateRangeFilter);

      return matchSearch && matchStatus && matchDate;
    });
  }, [allStudentAccounts, q, statusFilter, dateRangeFilter]);

  // Filtered Receipts / Transactions
  const filteredPayments = useMemo(() => {
    return (payments || []).filter((p) => {
      const studentName = (p.student?.name || '').toLowerCase();
      const providerPaymentId = (p.provider_payment_id || '').toLowerCase();
      const providerOrderId = (p.provider_order_id || '').toLowerCase();
      const receiptNum = (p.receipt?.receipt_number || '').toLowerCase();

      const matchesSearch =
        !q ||
        studentName.includes(q) ||
        providerPaymentId.includes(q) ||
        providerOrderId.includes(q) ||
        receiptNum.includes(q);

      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
      const matchesProvider = providerFilter === 'ALL' || p.provider === providerFilter;
      const matchesDate =
        dateRangeFilter === 'ALL' ||
        isWithinDateRange(p.created_at, dateRangeFilter);

      return matchesSearch && matchesStatus && matchesProvider && matchesDate;
    });
  }, [payments, q, statusFilter, providerFilter, dateRangeFilter]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Payment Transactions &amp; Student Ledger
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track all student fee accounts, uncollected dues, confirmed payments, and issued receipts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => {
              setManualForm({
                studentId: '',
                studentFeeId: '',
                amount: '',
                paymentMethod: 'CASH',
                paymentDate: new Date().toISOString().split('T')[0],
                notes: '',
              });
              setIsManualModalOpen(true);
            }}
            className="gap-2 shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
          >
            <Banknote className="w-4 h-4" />
            <span>Record Cash / Offline Payment</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
            <span className="font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-rose-600 p-1 cursor-pointer"
            title="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successToast && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-2.5 shadow-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium">{successToast}</span>
        </div>
      )}

      {/* 4 Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card hoverEffect accent="indigo" className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Receivables</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800/60">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">₹{totalBilledReceivables.toLocaleString('en-IN')}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Across all {allStudentAccounts.length} enrolled students</p>
          </div>
        </Card>

        <Card hoverEffect accent="emerald" className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Collected</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-800/60">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-400 tracking-tight">₹{totalSettledRevenue.toLocaleString('en-IN')}</div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
              {totalBilledReceivables > 0 ? `${Math.round((totalSettledRevenue / totalBilledReceivables) * 100)}% recovery rate` : 'Confirmed payments'}
            </p>
          </div>
        </Card>

        <Card hoverEffect accent="amber" className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Pending Dues</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-800/60">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">₹{totalPendingDues.toLocaleString('en-IN')}</div>
            <p className="text-xs text-amber-600/90 dark:text-amber-400/90 font-semibold mt-1">{pendingAccountsCount} student accounts with balance</p>
          </div>
        </Card>

        <Card hoverEffect accent="purple" className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Official Receipts</span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-800/60">
              <FileCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 tracking-tight">{successCount}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Issued receipts &amp; audit records</p>
          </div>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'accounts'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Student Payment Accounts ({filteredStudentAccounts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('receipts')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'receipts'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Receipts &amp; Transaction Logs ({filteredPayments.length})</span>
        </button>
      </div>

      {/* Search & Date Filter Bar */}
      <Card className="p-4 border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
          {/* Search box */}
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              placeholder="Search student, course, phone, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 text-sm border border-slate-200/90 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-slate-50/50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 transition-all"
            />
          </div>

          {/* Quick Date Range Buttons requested by user */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 self-start lg:self-auto flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 px-2 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Filter:
            </span>
            <button
              type="button"
              onClick={() => setDateRangeFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dateRangeFilter === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setDateRangeFilter('1DAY')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dateRangeFilter === '1DAY'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Today (1 Day)
            </button>
            <button
              type="button"
              onClick={() => setDateRangeFilter('7DAYS')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dateRangeFilter === '7DAYS'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => setDateRangeFilter('30DAYS')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dateRangeFilter === '30DAYS'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Last 30 Days
            </button>
          </div>

          {/* Status & Provider Dropdowns */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs h-9 w-36"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Only</option>
              <option value="PARTIAL">Partial Only</option>
              <option value="PAID">Paid / Cleared</option>
              <option value="OVERDUE">Overdue Only</option>
            </Select>

            {activeTab === 'receipts' && (
              <Select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                className="text-xs h-9 w-36"
              >
                <option value="ALL">All Methods</option>
                <option value="MANUAL">Manual Cash/UPI</option>
                <option value="RAZORPAY">Razorpay</option>
              </Select>
            )}
          </div>
        </div>
      </Card>

      {/* TAB 1: ALL STUDENT PAYMENT ACCOUNTS (Both pending & paid) */}
      {activeTab === 'accounts' && (
        <div>
          {loading ? (
            <SkeletonLoader variant="table" rows={6} />
          ) : filteredStudentAccounts.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No student accounts found"
              description="No student accounts match the selected search or date range filters."
              accentColor="indigo"
            />
          ) : (
            <Card className="border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Athlete / Student</th>
                      <th className="px-5 py-3.5">Enrolled Course</th>
                      <th className="px-5 py-3.5">Total Package</th>
                      <th className="px-5 py-3.5">Paid So Far</th>
                      <th className="px-5 py-3.5">Remaining Balance</th>
                      <th className="px-5 py-3.5">Due Date</th>
                      <th className="px-5 py-3.5 text-center">Status</th>
                      <th className="px-6 py-3.5 text-right">Settlement Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {filteredStudentAccounts.map((account) => (
                      <tr key={account.studentId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                        {/* Student Name */}
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100 leading-tight">
                            {account.studentName}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>ID: {account.studentId.substring(0, 8)}</span>
                            {account.parentWhatsapp && (
                              <span className="text-emerald-500 font-mono text-[11px]">
                                WA: {account.parentWhatsapp}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Enrolled Course */}
                        <td className="px-5 py-4 text-xs">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {account.course}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {formatBillingPeriod(account.billingPeriod)}
                          </div>
                        </td>

                        {/* Total Package */}
                        <td className="px-5 py-4 font-bold text-slate-900 dark:text-slate-100">
                          ₹{Number(account.totalPackage).toLocaleString('en-IN')}
                        </td>

                        {/* Paid So Far */}
                        <td className="px-5 py-4 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          ₹{Number(account.amountPaid).toLocaleString('en-IN')}
                        </td>

                        {/* Remaining Balance */}
                        <td className="px-5 py-4">
                          {account.pendingBalance > 0 ? (
                            <div>
                              <div className="font-black text-amber-600 dark:text-amber-400 text-sm">
                                ₹{Number(account.pendingBalance).toLocaleString('en-IN')}
                              </div>
                              <div className="text-[10px] uppercase font-bold text-amber-600/70 dark:text-amber-400/70 tracking-wider">
                                Balance Remaining
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" /> ₹0 (Fully Cleared)
                            </span>
                          )}
                        </td>

                        {/* Due Date */}
                        <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-400">
                          {account.dueDate ? new Date(account.dueDate).toLocaleDateString() : 'Annual / Cycle'}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4 text-center">
                          <StatusBadge status={account.status} />
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            {account.pendingBalance > 0 ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenCollectPayment(account)}
                                  className="text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer shadow-xs"
                                >
                                  <Banknote className="w-3.5 h-3.5" />
                                  <span>Collect Fee</span>
                                </Button>

                                {account.feeId && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSendReminder(account)}
                                    disabled={sendingReminderFeeId === account.feeId}
                                    className="text-xs h-8 gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                                    title="Send WhatsApp payment reminder alert to parent"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>{sendingReminderFeeId === account.feeId ? 'Sending...' : 'Remind'}</span>
                                  </Button>
                                )}
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenCollectPayment(account)}
                                className="text-xs h-8 gap-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <span>+ Record Advance</span>
                              </Button>
                            )}

                            {account.amountPaid > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUndoAccountPayment(account)}
                                disabled={undoingPaymentId === account.studentId}
                                className="text-xs h-8 gap-1 border-rose-300 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                title="Undo / Revert recent payment for this student"
                              >
                                <RotateCcw className={`w-3.5 h-3.5 ${undoingPaymentId === account.studentId ? 'animate-spin' : ''}`} />
                                <span>Undo</span>
                              </Button>
                            )}
                          </div>
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

      {/* TAB 2: SETTLED TRANSACTIONS & RECEIPTS */}
      {activeTab === 'receipts' && (
        <div>
          {loading ? (
            <SkeletonLoader variant="table" rows={6} />
          ) : filteredPayments.length === 0 ? (
            <EmptyState
              title="No payment records found"
              description="No transaction receipts match your selected date or method filters."
              accentColor="emerald"
            />
          ) : (
            <Card className="border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Date &amp; Time</th>
                      <th className="px-5 py-3.5">Student</th>
                      <th className="px-5 py-3.5 text-right">Amount Paid</th>
                      <th className="px-5 py-3.5 text-center">Method / Mode</th>
                      <th className="px-5 py-3.5">Reference / Notes</th>
                      <th className="px-5 py-3.5 text-center">Status</th>
                      <th className="px-6 py-3.5 text-right">Official Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {filteredPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap font-mono">
                          {new Date(p.created_at).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100 leading-tight">
                            {p.student?.name || 'Unknown Student'}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            {p.student_fee?.billing_period ? `Period: ${p.student_fee.billing_period}` : 'Annual Settlement'}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                          ₹{Number(p.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                            {(p as any).payment_method || p.provider || 'CASH'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-300">
                          {(p as any).notes || (p as any).transaction_id || p.provider_payment_id || '—'}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {p.receipt ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedReceipt(p.receipt)}
                                className="text-xs h-7 gap-1 border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                              >
                                <FileCheck className="w-3.5 h-3.5" />
                                {p.receipt.receipt_number}
                              </Button>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500 italic">Settled Direct</span>
                            )}

                            {p.status === 'SUCCESS' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUndoPaymentRecord(p.id, p.student?.name || 'student', Number(p.amount))}
                                disabled={undoingPaymentId === p.id}
                                className="text-xs h-7 gap-1 border-rose-300 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                title="Undo / Void this payment record and restore dues"
                              >
                                <RotateCcw className={`w-3 h-3 ${undoingPaymentId === p.id ? 'animate-spin' : ''}`} />
                                <span>Undo</span>
                              </Button>
                            )}
                          </div>
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

      {/* MODAL: Record Offline Cash / Bank Payment */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title="Record Student Fee Payment"
      >
        <form onSubmit={handleManualPayment} className="space-y-4">
          <Select
            label="Select Student *"
            required
            value={manualForm.studentId}
            onChange={(e) => {
              const sid = e.target.value;
              const account = allStudentAccounts.find((a) => a.studentId === sid);
              setManualForm({
                ...manualForm,
                studentId: sid,
                amount: account && account.pendingBalance > 0 ? String(account.pendingBalance) : manualForm.amount,
              });
            }}
          >
            <option value="">Select a student...</option>
            {allStudentAccounts.map((s) => (
              <option key={s.studentId} value={s.studentId}>
                {s.studentName} — Pending: ₹{s.pendingBalance} ({s.course})
              </option>
            ))}
          </Select>

          <Input
            label="Payment Amount (₹) *"
            type="number"
            step="0.01"
            min="1"
            required
            placeholder="e.g. 5000"
            value={manualForm.amount}
            onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
          />

          <Select
            label="Payment Mode *"
            value={manualForm.paymentMethod}
            onChange={(e) => setManualForm({ ...manualForm, paymentMethod: e.target.value })}
          >
            <option value="CASH">Cash at Desk</option>
            <option value="UPI">Direct UPI Transfer</option>
            <option value="BANK_TRANSFER">Bank Wire / IMPS</option>
            <option value="CHEQUE">Cheque / Demand Draft</option>
          </Select>

          <Input
            label="Payment Date *"
            type="date"
            required
            value={manualForm.paymentDate}
            onChange={(e) => setManualForm({ ...manualForm, paymentDate: e.target.value })}
          />

          <Input
            label="Reference / Transaction Notes"
            placeholder="e.g. Cash collected by Coach at evening session"
            value={manualForm.notes}
            onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
          />

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsManualModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Recording...' : 'Record Payment & Issue Receipt'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* RECEIPT DETAIL MODAL */}
      {selectedReceipt && (
        <Modal
          isOpen={Boolean(selectedReceipt)}
          onClose={() => setSelectedReceipt(null)}
          title="Official Payment Receipt"
        >
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 dark:text-slate-400">Receipt No:</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {selectedReceipt.receipt_number}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 dark:text-slate-400">Amount Paid:</span>
                <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                  ₹{Number(selectedReceipt.amount).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 dark:text-slate-400">Date Issued:</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {new Date(selectedReceipt.issued_at || selectedReceipt.created_at).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSelectedReceipt(null)}>
                <X className="w-4 h-4 mr-1.5" /> Close
              </Button>
              <Button onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-1.5" /> Print Receipt
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
