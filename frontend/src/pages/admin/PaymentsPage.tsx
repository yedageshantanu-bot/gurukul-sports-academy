import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  Banknote,
  FileCheck,
  MessageSquare,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { PaymentRecord, StudentFee } from '../../types/fee';
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

  const [activeTab, setActiveTab] = useState<'pending' | 'settled'>('pending');
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [studentFees, setStudentFees] = useState<StudentFee[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [providerFilter, setProviderFilter] = useState('ALL');

  // Modals & Actions
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendingReminderFeeId, setSendingReminderFeeId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Manual payment form
  const [manualForm, setManualForm] = useState({
    studentId: '',
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
  const handleOpenCollectPayment = (fee: any) => {
    const pending = Number(fee.pending_amount || Math.max(0, Number(fee.amount_due) - Number(fee.amount_paid)));
    setManualForm({
      studentId: fee.student_id,
      amount: String(pending > 0 ? pending : fee.amount_due),
      paymentMethod: 'CASH',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: `Settlement for ${fee.billing_period || 'Tuition Fee'}`,
    });
    setIsManualModalOpen(true);
  };

  // Handle manual payment submission
  const handleManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
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

  // Handle WhatsApp payment reminder
  const handleSendReminder = async (fee: any) => {
    if (!token) return;
    setSendingReminderFeeId(fee.id);
    try {
      const res = await fetch(`${API_BASE}/whatsapp/trigger-fee-reminder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ studentFeeId: fee.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to dispatch reminder');
      setSuccessToast(`WhatsApp payment reminder dispatched for ${fee.student?.name || 'student'}!`);
      setTimeout(() => setSuccessToast(null), 6000);
    } catch (err: any) {
      setError(err.message || 'Error sending reminder');
    } finally {
      setSendingReminderFeeId(null);
    }
  };

  // Financial Metrics
  const totalRevenue = (payments || [])
    .filter((p) => p.status === 'SUCCESS')
    .reduce((acc, p) => acc + Number(p.amount || 0), 0);

  const successCount = (payments || []).filter((p) => p.status === 'SUCCESS').length;

  const consolidatedPendingFees = useMemo(() => {
    const yearlyMap = new Map<string, any>();
    const subInstallments: any[] = [];
    const regularPending: any[] = [];

    (studentFees || []).forEach((fee) => {
      const amountDue = Number(fee.amount_due || 0);
      const amountPaid = Number(fee.amount_paid || 0);
      const pending = Number(fee.pending_amount !== undefined ? fee.pending_amount : Math.max(0, amountDue - amountPaid));

      if (pending <= 0 && fee.status === 'PAID') return;

      const p = fee.billing_period || '';
      if (p.includes('_YEARLY')) {
        yearlyMap.set(fee.student_id, { ...fee, computedPending: pending, subInstallments: [] });
      } else if (p.includes('_INST_')) {
        subInstallments.push({ ...fee, computedPending: pending });
      } else {
        regularPending.push({ ...fee, computedPending: pending });
      }
    });

    subInstallments.forEach((inst) => {
      if (yearlyMap.has(inst.student_id)) {
        yearlyMap.get(inst.student_id).subInstallments.push(inst);
      } else {
        regularPending.push(inst);
      }
    });

    return [...Array.from(yearlyMap.values()), ...regularPending];
  }, [studentFees]);

  const totalPendingDues = useMemo(() => {
    return consolidatedPendingFees.reduce((acc, f) => acc + Number(f.computedPending || 0), 0);
  }, [consolidatedPendingFees]);

  const pendingAccountsCount = consolidatedPendingFees.length;

  // Search filter
  const q = (searchQuery || '').trim().toLowerCase();

  const filteredPendingFees = useMemo(() => {
    return consolidatedPendingFees.filter((f) => {
      const studentName = (f.student?.name || '').toLowerCase();
      const period = (f.billing_period || '').toLowerCase();
      const plan = (f.fee_plan?.name || '').toLowerCase();

      const matchesSearch = !q || studentName.includes(q) || period.includes(q) || plan.includes(q);
      const matchesStatus = statusFilter === 'ALL' || f.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [consolidatedPendingFees, q, statusFilter]);

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

      return matchesSearch && matchesStatus && matchesProvider;
    });
  }, [payments, q, statusFilter, providerFilter]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Payment Transactions & Collections
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track uncollected student fees, pending dues, confirmed transaction receipts, and cash settlements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => {
              setManualForm({
                studentId: '',
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
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm flex items-center gap-2.5 shadow-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
          <span className="font-medium">{error}</span>
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
        <Card hoverEffect accent="amber" className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Pending Dues</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-800/60">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">₹{totalPendingDues.toLocaleString('en-IN')}</div>
            <p className="text-xs text-amber-600/90 dark:text-amber-400/90 font-semibold mt-1">{pendingAccountsCount} student accounts with dues</p>
          </div>
        </Card>

        <Card hoverEffect accent="emerald" className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Settled</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-800/60">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">₹{totalRevenue.toLocaleString('en-IN')}</div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">Confirmed payments to date</p>
          </div>
        </Card>

        <Card hoverEffect accent="indigo" className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Settled Transactions</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800/60">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-tight">{successCount}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Official receipts generated</p>
          </div>
        </Card>

        <Card hoverEffect accent="purple" className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Payment Health</span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-800/60">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 tracking-tight">
              {totalRevenue + totalPendingDues > 0
                ? `${Math.round((totalRevenue / (totalRevenue + totalPendingDues)) * 100)}%`
                : '100%'}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Settled vs total receivables</p>
          </div>
        </Card>
      </div>

      {/* Tabs Navigation: Pending Dues vs Settled Receipts */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'pending'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Pending Dues &amp; Uncollected Fees</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400">
            {pendingAccountsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settled')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'settled'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Settled Transactions &amp; Receipts</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            {payments.length}
          </span>
        </button>
      </div>

      {/* Search Bar */}
      <Card className="p-4 border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              placeholder={activeTab === 'pending' ? 'Search student name, phone, or package...' : 'Search student, receipt, or ref ID...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 text-sm border border-slate-200/90 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-slate-50/50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs h-10 w-36"
            >
              <option value="ALL">All Statuses</option>
              {activeTab === 'pending' ? (
                <>
                  <option value="PENDING">Pending Only</option>
                  <option value="PARTIAL">Partial Only</option>
                  <option value="OVERDUE">Overdue Only</option>
                </>
              ) : (
                <>
                  <option value="SUCCESS">Success Only</option>
                  <option value="PENDING">Pending Orders</option>
                  <option value="FAILED">Failed Only</option>
                </>
              )}
            </Select>

            {activeTab === 'settled' && (
              <Select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                className="text-xs h-10 w-36"
              >
                <option value="ALL">All Providers</option>
                <option value="MANUAL">Manual Cash</option>
                <option value="RAZORPAY">Razorpay</option>
              </Select>
            )}
          </div>
        </div>
      </Card>

      {/* TAB 1: PENDING DUES & UNCOLLECTED FEES */}
      {activeTab === 'pending' && (
        <div>
          {loading ? (
            <SkeletonLoader variant="table" rows={6} />
          ) : filteredPendingFees.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="All Fees Fully Settled! 🎉"
              description="No active pending dues found matching your filters. All registered athlete accounts are clear."
              accentColor="emerald"
            />
          ) : (
            <Card className="border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Athlete / Student</th>
                      <th className="px-5 py-3.5">Package / Period</th>
                      <th className="px-5 py-3.5">Total Package</th>
                      <th className="px-5 py-3.5">Paid So Far</th>
                      <th className="px-5 py-3.5">Pending Balance</th>
                      <th className="px-5 py-3.5">Due Date</th>
                      <th className="px-5 py-3.5 text-center">Status</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {filteredPendingFees.map((fee) => (
                      <tr key={fee.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100 leading-tight">
                            {fee.student?.name || 'Unknown Student'}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>ID: {fee.student_id?.substring(0, 8)}</span>
                            {fee.student?.parent_whatsapp && (
                              <span className="text-emerald-500 font-mono text-[11px]">
                                {fee.student.parent_whatsapp}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-xs">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {formatBillingPeriod(fee.billing_period)}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {fee.fee_plan?.name || (fee.billing_period?.includes('YEARLY') ? 'Annual Package' : 'Custom Plan')}
                          </div>
                          {fee.subInstallments && fee.subInstallments.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {fee.subInstallments.map((inst: any) => (
                                <span
                                  key={inst.id}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                >
                                  Inst #2: ₹{Number(inst.amount_due).toLocaleString('en-IN')} (Due {inst.due_date ? new Date(inst.due_date).toLocaleDateString() : 'TBD'})
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 font-bold text-slate-900 dark:text-slate-100">
                          ₹{Number(fee.amount_due).toLocaleString('en-IN')}
                        </td>

                        <td className="px-5 py-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          ₹{Number(fee.amount_paid || 0).toLocaleString('en-IN')}
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-black text-rose-600 dark:text-rose-400 text-sm">
                            ₹{Number(fee.computedPending).toLocaleString('en-IN')}
                          </div>
                          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            Pending Due
                          </div>
                        </td>

                        <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-400">
                          {fee.due_date ? new Date(fee.due_date).toLocaleDateString() : '—'}
                        </td>

                        <td className="px-5 py-4 text-center">
                          <StatusBadge status={fee.status} />
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleOpenCollectPayment(fee)}
                              className="text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer shadow-xs"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              <span>Record Payment</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSendReminder(fee)}
                              disabled={sendingReminderFeeId === fee.id}
                              className="text-xs h-8 gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                              title="Send WhatsApp payment reminder alert to parent"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>{sendingReminderFeeId === fee.id ? 'Sending...' : 'Remind'}</span>
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
        </div>
      )}

      {/* TAB 2: SETTLED TRANSACTIONS & RECEIPTS */}
      {activeTab === 'settled' && (
        <div>
          {loading ? (
            <SkeletonLoader variant="table" rows={6} />
          ) : filteredPayments.length === 0 ? (
            <EmptyState
              title="No payment records found"
              description="Payments made through offline desk settlement or gateway checkouts will appear here."
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
      <Modal isOpen={isManualModalOpen} onClose={() => setIsManualModalOpen(false)} title="Record Offline Cash / Bank Payment">
        <form onSubmit={handleManualPayment} className="space-y-4">
          <div>
            <Select
              label="Select Student *"
              required
              value={manualForm.studentId}
              onChange={(e) => setManualForm({ ...manualForm, studentId: e.target.value })}
            >
              <option value="">-- Choose Student --</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.course || 'No Course'})
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Amount (₹) *"
              type="number"
              step="0.01"
              required
              min="1"
              placeholder="e.g. 5000"
              value={manualForm.amount}
              onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
            />
            <Input
              label="Payment Date *"
              type="date"
              required
              value={manualForm.paymentDate}
              onChange={(e) => setManualForm({ ...manualForm, paymentDate: e.target.value })}
            />
            <Select
              label="Payment Method *"
              value={manualForm.paymentMethod}
              onChange={(e) => setManualForm({ ...manualForm, paymentMethod: e.target.value })}
            >
              <option value="CASH">Cash at Front Desk</option>
              <option value="UPI">Direct UPI / QR Code</option>
              <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
              <option value="CHEQUE">Cheque Deposit</option>
            </Select>
          </div>

          <Input
            label="Internal Reference / Remarks (Optional)"
            placeholder="e.g. Front desk settlement for annual fee"
            value={manualForm.notes}
            onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
          />

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsManualModalOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer">
              {submitting ? 'Recording...' : 'Record Payment & Issue Receipt'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: View Official Receipt */}
      <Modal isOpen={Boolean(selectedReceipt)} onClose={() => setSelectedReceipt(null)} title="Official Payment Receipt">
        {selectedReceipt && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl space-y-2.5">
              <div className="flex justify-between items-center border-b border-slate-200/80 dark:border-slate-700 pb-2.5">
                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Receipt Number</span>
                <span className="font-mono text-sm font-bold text-indigo-700 dark:text-indigo-400">{selectedReceipt.receipt_number}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 dark:text-slate-400">Issued On:</span>
                <span className="text-slate-900 dark:text-slate-100 font-medium">
                  {new Date(selectedReceipt.issued_at).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 dark:text-slate-400">Amount Paid:</span>
                <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                  ₹{Number(selectedReceipt.amount).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setSelectedReceipt(null)} className="cursor-pointer">
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PaymentsPage;
