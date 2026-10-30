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

    // 1. Process all students first
    (students || []).forEach((s) => {
      const defaultPkg = Number(s.monthly_fee ?? s.monthlyFee ?? 0);
      studentMap.set(s.id, {
        id: s.id,
        studentId: s.id,
        studentName: s.name,
        parentName: s.parent_name ?? s.parentName,
        parentWhatsapp: s.parent_whatsapp ?? s.parentWhatsapp,
        studentMobile: s.student_mobile ?? s.studentMobile,
        course: s.course || 'Martial Arts Training',
        totalPackage: defaultPkg,
        amountPaid: 0,
        pendingBalance: defaultPkg,
        dueDate: null,
        admissionDate: s.admission_date ?? s.admissionDate ?? s.created_at,
        billingPeriod: 'Current Enrollment',
        status: 'PENDING',
        rawFee: null,
        feeRecords: [] as any[],
      });
    });

    // 2. Aggregate actual fee records per student
    (studentFees || []).forEach((f) => {
      const studentId = f.student_id;
      const existing = studentMap.get(studentId);
      if (!existing) {
        studentMap.set(studentId, {
          id: f.id,
          feeId: f.id,
          studentId: studentId,
          studentName: f.student?.name || 'Student',
          parentName: f.student?.parent_name,
          parentWhatsapp: f.student?.parent_whatsapp,
          studentMobile: f.student?.student_mobile,
          course: f.student?.course || 'Martial Arts Training',
          totalPackage: Number(f.amount_due || 0),
          amountPaid: Number(f.amount_paid || 0),
          pendingBalance: Math.max(0, Number(f.amount_due || 0) - Number(f.amount_paid || 0)),
          dueDate: f.due_date,
          admissionDate: f.student?.admission_date,
          billingPeriod: f.billing_period,
          planName: f.fee_plan?.name || (f.billing_period?.includes('YEARLY') ? 'Annual Package' : 'Regular Plan'),
          status: f.status || 'PENDING',
          rawFee: f,
          feeRecords: [f],
        });
      } else {
        if (existing.feeRecords.length === 0) {
          existing.totalPackage = Number(f.amount_due || 0);
          existing.amountPaid = Number(f.amount_paid || 0);
          existing.billingPeriod = f.billing_period;
          existing.dueDate = f.due_date;
          existing.status = f.status || 'PENDING';
          existing.feeId = f.id;
          existing.rawFee = f;
          existing.planName = f.fee_plan?.name || (f.billing_period?.includes('YEARLY') ? 'Annual Package' : 'Regular Plan');
        } else {
          existing.totalPackage += Number(f.amount_due || 0);
          existing.amountPaid += Number(f.amount_paid || 0);
          if (f.status === 'OVERDUE' || existing.status === 'OVERDUE') existing.status = 'OVERDUE';
          if (f.due_date && (!existing.dueDate || new Date(f.due_date) > new Date(existing.dueDate))) {
            existing.dueDate = f.due_date;
            existing.billingPeriod = f.billing_period;
          }
        }
        existing.feeRecords.push(f);
      }
    });

    // 3. Reconcile with verified SUCCESS payments from payments table
    studentMap.forEach((acc, sId) => {
      const studentPayments = (payments || []).filter(
        (p) => (p.student_id === sId || p.student?.id === sId) && p.status === 'SUCCESS'
      );
      const totalPaidLogs = studentPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      acc.amountPaid = Math.max(acc.amountPaid, totalPaidLogs);
      acc.pendingBalance = Math.max(0, acc.totalPackage - acc.amountPaid);

      if (acc.amountPaid >= acc.totalPackage && acc.totalPackage > 0) {
        acc.status = 'PAID';
      } else if (acc.amountPaid > 0 && acc.pendingBalance > 0) {
        acc.status = 'PARTIAL';
      }
    });

    return Array.from(studentMap.values());
  }, [students, studentFees, payments]);

  // Overall Financial Metrics (Identical to Fees Ledger)
  const totalBilledReceivables = useMemo(() => {
    return allStudentAccounts.reduce((acc, a) => acc + Number(a.totalPackage || 0), 0);
  }, [allStudentAccounts]);

  const totalSettledRevenue = useMemo(() => {
    return allStudentAccounts.reduce((acc, a) => acc + Number(a.amountPaid || 0), 0);
  }, [allStudentAccounts]);

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
                                onClick={() => setSelectedReceipt({ ...p.receipt, student: p.student, student_fee: p.student_fee, amount: p.amount, payment_method: p.payment_method, paid_at: p.paid_at, transaction_id: p.transaction_id })}
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
          title="Official Fee Payment Receipt (अधिकृत फी पावती)"
        >
          <div className="space-y-4 print:p-0">
            {/* Printable Receipt Card */}
            <div id="gurukul-official-receipt" className="p-5 bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 space-y-4 text-slate-900 dark:text-slate-100 shadow-sm">
              {/* Receipt Header */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b-2 border-orange-500/30">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-orange-500 text-white flex items-center justify-center font-extrabold text-xl shadow-md shadow-orange-500/20">
                    🥋
                  </div>
                  <div>
                    <h2 className="text-base font-black tracking-tight text-slate-950 dark:text-white uppercase">
                      Gurukul Sports Academy
                    </h2>
                    <p className="text-[11px] text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wider">
                      Athletics, Martial Arts & Fitness Dojo
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Official Payment Acknowledgment
                    </p>
                  </div>
                </div>

                <div className="text-right sm:text-right w-full sm:w-auto p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Receipt No</div>
                  <div className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400">
                    {selectedReceipt.receipt_number || selectedReceipt.id?.slice(0, 8).toUpperCase() || 'REC-2026-GSA'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Date: {new Date(selectedReceipt.issued_at || selectedReceipt.payment_date || selectedReceipt.created_at || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Student & Payment Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-semibold uppercase">Athlete Name:</span>
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                    {selectedReceipt.student?.name || selectedReceipt.studentName || 'Academy Athlete'}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    Discipline: <strong className="text-slate-800 dark:text-slate-200">{selectedReceipt.student?.course || selectedReceipt.course || 'Combat & Track Squad'}</strong>
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-semibold uppercase">Payment Mode:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span className="font-bold uppercase px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">{selectedReceipt.payment_method || selectedReceipt.provider || 'CASH'}</span>
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    Parent WhatsApp: <strong className="font-mono text-slate-800 dark:text-slate-200">{selectedReceipt.student?.parent_whatsapp || selectedReceipt.parentWhatsapp || 'Available'}</strong>
                  </span>
                </div>
              </div>

              {/* 5-Line Fee Breakdown Table */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Fee Item / Description</th>
                      <th className="px-3 py-2 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-medium">
                        Normal Academy Training Fee (नियमित अकॅडमी फी)
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-slate-100 font-mono">
                        ₹{(Number(selectedReceipt.student?.monthly_fee) || Number(selectedReceipt.totalPackage) || 10000).toLocaleString('en-IN')}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-medium">
                        Tournament & Event Registration (टूर्नामेंट फी)
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-slate-100 font-mono">
                        ₹{(selectedReceipt.tournamentFee || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                      <td className="px-3 py-2 font-bold text-slate-900 dark:text-slate-100">
                        Total Scheduled Fees (एकूण देय फी)
                      </td>
                      <td className="px-3 py-2 text-right font-black text-slate-950 dark:text-white font-mono">
                        ₹{(Number(selectedReceipt.student?.monthly_fee) || Number(selectedReceipt.totalPackage) || 10000).toLocaleString('en-IN')}
                      </td>
                    </tr>
                    <tr className="bg-emerald-500/5 dark:bg-emerald-500/10">
                      <td className="px-3 py-2 font-bold text-emerald-700 dark:text-emerald-400">
                        Amount Paid in this Receipt (जमा केलेली रक्कम)
                      </td>
                      <td className="px-3 py-2 text-right font-black text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                        ₹{Number(selectedReceipt.amount || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                    <tr className="bg-amber-500/5 dark:bg-amber-500/10">
                      <td className="px-3 py-2 font-bold text-amber-700 dark:text-amber-400">
                        Remaining Dues / Balance (उर्वरित शिल्लक)
                      </td>
                      <td className="px-3 py-2 text-right font-black text-amber-600 dark:text-amber-400 font-mono">
                        ₹{Math.max(0, (Number(selectedReceipt.student?.monthly_fee) || Number(selectedReceipt.totalPackage) || 10000) - Number(selectedReceipt.amount || 0)).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Receipt Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400">
                <div>
                  <p>Status: <strong className="text-emerald-600 font-bold uppercase">PAYMENT CONFIRMED</strong></p>
                  <p>Computer-generated official receipt for Gurukul Sports Academy.</p>
                </div>
                <div className="text-right">
                  <div className="w-16 border-b border-slate-400 ml-auto mb-1"></div>
                  <span className="font-bold text-slate-700 dark:text-slate-300">Authorized Signature</span>
                </div>
              </div>
            </div>

            {/* Action Buttons: WhatsApp Share & Print PDF */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button variant="outline" onClick={() => setSelectedReceipt(null)}>
                <X className="w-4 h-4 mr-1.5" /> Close
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    const studentName = selectedReceipt.student?.name || selectedReceipt.studentName || 'Student';
                    const parentPhone = selectedReceipt.student?.parent_whatsapp || selectedReceipt.parentWhatsapp || '';
                    const rNo = selectedReceipt.receipt_number || selectedReceipt.id?.slice(0, 8).toUpperCase() || 'REC-GSA';
                    const amountPaid = Number(selectedReceipt.amount || 0).toLocaleString('en-IN');
                    const totalFee = (Number(selectedReceipt.student?.monthly_fee) || Number(selectedReceipt.totalPackage) || 10000).toLocaleString('en-IN');
                    const remDues = Math.max(0, (Number(selectedReceipt.student?.monthly_fee) || Number(selectedReceipt.totalPackage) || 10000) - Number(selectedReceipt.amount || 0)).toLocaleString('en-IN');
                    const courseName = selectedReceipt.student?.course || selectedReceipt.course || 'Athletics & Martial Arts';

                    const msg = encodeURIComponent(
                      `🥋 *GURUKUL SPORTS ACADEMY — OFFICIAL FEE RECEIPT* 🥋\n` +
                      `----------------------------------------\n` +
                      `📄 Receipt No: #${rNo}\n` +
                      `👤 Athlete: ${studentName}\n` +
                      `🥋 Discipline: ${courseName}\n` +
                      `📅 Date: ${new Date().toLocaleDateString('en-IN')}\n\n` +
                      `📋 *FEE BREAKDOWN:*\n` +
                      `• Normal Academy Fee: ₹${totalFee}\n` +
                      `• Tournament Fee: ₹${selectedReceipt.tournamentFee || 0}\n` +
                      `• *Total Package: ₹${totalFee}*\n` +
                      `• *Amount Paid: ₹${amountPaid} (${selectedReceipt.payment_method || 'CASH'})*\n` +
                      `----------------------------------------\n` +
                      `💰 *Remaining Dues / Balance: ₹${remDues}*\n` +
                      `----------------------------------------\n` +
                      `Status: Payment Confirmed & Updated in Academy Records.\n` +
                      `Thank you for your timely settlement!\n\n` +
                      `_Gurukul Sports Academy Administration_`
                    );

                    if (parentPhone) {
                      window.open(`https://wa.me/${parentPhone.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
                    } else {
                      window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5"
                >
                  <MessageSquare className="w-4 h-4" /> Share on WhatsApp
                </Button>

                <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-1.5">
                  <Printer className="w-4 h-4" /> Print / PDF
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
