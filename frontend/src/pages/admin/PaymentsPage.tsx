import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  Banknote,
  PlayCircle,
  FileCheck,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { PaymentRecord } from '../../types/fee';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { API_BASE } from '../../lib/api';

export const PaymentsPage: React.FC = () => {
  const { token } = useAuth();

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [providerFilter, setProviderFilter] = useState('ALL');

  // Modals
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isTestCheckoutOpen, setIsTestCheckoutOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalSuccessMessage, setModalSuccessMessage] = useState<string | null>(null);

  // Manual payment form
  const [manualForm, setManualForm] = useState({
    studentId: '',
    amount: '',
    paymentMethod: 'CASH',
    notes: '',
  });

  // Test checkout form
  const [testForm, setTestForm] = useState({
    studentId: '',
    amount: '1500',
    simulateFailure: false,
  });

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [paymentsRes, studentsRes] = await Promise.all([
        fetch(`${API_BASE}/payments`, { headers }),
        fetch(`${API_BASE}/students?status=ACTIVE`, { headers }),
      ]);

      const paymentsData = await paymentsRes.json();
      const studentsData = await studentsRes.json();

      if (paymentsData.success && Array.isArray(paymentsData.data)) setPayments(paymentsData.data);
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
          notes: manualForm.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Manual payment failed');

      setIsManualModalOpen(false);
      setManualForm({ studentId: '', amount: '', paymentMethod: 'CASH', notes: '' });
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle mock checkout simulation
  const handleTestCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    setModalSuccessMessage(null);

    try {
      // Step 1: Create Order
      const orderRes = await fetch(`${API_BASE}/payments/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentId: testForm.studentId,
          amount: parseFloat(testForm.amount),
          provider: 'MOCK',
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error?.message || 'Order creation failed');

      const { paymentRecordId, orderId } = orderData.data;

      // Step 2: Verify Payment
      const paymentId = testForm.simulateFailure ? 'mock_pay_fail_demo' : `mock_pay_${Date.now()}`;
      const signature = testForm.simulateFailure ? 'mock_fail_signature' : 'mock_valid_signature';

      const verifyRes = await fetch(`${API_BASE}/payments/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentRecordId,
          orderId,
          paymentId,
          signature,
          provider: 'MOCK',
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error?.message || 'Payment verification failed as expected');
      }

      setModalSuccessMessage(
        `Simulation Successful! Order: ${orderId} verified. Receipt: ${verifyData.data.receipt?.receipt_number}`
      );
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics
  const totalRevenue = (payments || [])
    .filter((p) => p.status === 'SUCCESS')
    .reduce((acc, p) => acc + Number(p.amount || 0), 0);

  const successCount = (payments || []).filter((p) => p.status === 'SUCCESS').length;
  const pendingCount = (payments || []).filter((p) => p.status === 'CREATED' || p.status === 'PENDING').length;
  const failedCount = (payments || []).filter((p) => p.status === 'FAILED').length;

  // Filtered payments
  const q = (searchQuery || '').trim().toLowerCase();
  const filteredPayments = (payments || []).filter((p) => {
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

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Payment Transactions & Receipts
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Auditable transaction logs, payment gateway events, and generated official receipts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => setIsTestCheckoutOpen(true)}
            className="gap-2 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 shadow-sm"
          >
            <PlayCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Test Mock Gateway</span>
          </Button>

          <Button
            onClick={() => setIsManualModalOpen(true)}
            className="gap-2 shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            <Banknote className="w-4 h-4" />
            <span>Record Cash / Offline</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm flex items-center gap-2.5 shadow-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* 4 Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Successful</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800/60">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-tight">{successCount}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Completed transactions</p>
          </div>
        </Card>

        <Card hoverEffect accent="amber" className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pending</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-800/60">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">{pendingCount}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Awaiting confirmation</p>
          </div>
        </Card>

        <Card hoverEffect accent="rose" className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Failed</span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100 dark:border-rose-800/60">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">{failedCount}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Rejected transactions</p>
          </div>
        </Card>
      </div>

      {/* Transaction Table */}
      <div className="space-y-4">
        {/* Filter Controls */}
        <Card className="p-4 border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                placeholder="Search student, receipt, or ref ID..."
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
                <option value="SUCCESS">Success</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
              </Select>

              <Select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                className="text-xs h-10 w-36"
              >
                <option value="ALL">All Providers</option>
                <option value="MOCK">MOCK Gateway</option>
                <option value="RAZORPAY">Razorpay</option>
                <option value="MANUAL">Manual Cash</option>
              </Select>
            </div>
          </div>
        </Card>

        {loading ? (
          <SkeletonLoader variant="table" rows={6} />
        ) : filteredPayments.length === 0 ? (
          <EmptyState
            title="No payment records found"
            description="Payments made through online checkout or cash at desk will appear here."
            accentColor="emerald"
          />
        ) : (
          <Card className="border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Date & Time</th>
                    <th className="px-5 py-3.5">Student</th>
                    <th className="px-5 py-3.5 text-right">Amount</th>
                    <th className="px-5 py-3.5 text-center">Provider</th>
                    <th className="px-5 py-3.5">Reference / Order</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                    <th className="px-6 py-3.5 text-right">Receipt</th>
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
                          {p.student_fee?.billing_period ? `Period: ${p.student_fee.billing_period}` : 'General Settlement'}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-extrabold text-slate-900 dark:text-slate-100">
                        ₹{Number(p.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                          {p.provider}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {p.provider_payment_id || p.provider_order_id || '—'}
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
                            className="text-xs h-7 gap-1 border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                            {p.receipt.receipt_number}
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500 italic">No receipt</span>
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

      {/* MODAL: Record Offline Payment */}
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

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount (₹) *"
              type="number"
              step="0.01"
              required
              min="1"
              placeholder="2000"
              value={manualForm.amount}
              onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
            />
            <Select
              label="Payment Method *"
              value={manualForm.paymentMethod}
              onChange={(e) => setManualForm({ ...manualForm, paymentMethod: e.target.value })}
            >
              <option value="CASH">Cash at Desk</option>
              <option value="UPI">Direct UPI</option>
              <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
              <option value="CHEQUE">Cheque</option>
            </Select>
          </div>

          <Input
            label="Internal Reference / Remarks (Optional)"
            placeholder="e.g. Received by front desk coordinator"
            value={manualForm.notes}
            onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
          />

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsManualModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Recording...' : 'Record Payment'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Test Mock Razorpay Checkout */}
      <Modal isOpen={isTestCheckoutOpen} onClose={() => setIsTestCheckoutOpen(false)} title="Test Mock Gateway Simulation">
        <form onSubmit={handleTestCheckout} className="space-y-4">
          <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/60 rounded-xl text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
            <div className="leading-relaxed">
              <strong>Simulated Gateway Flow:</strong> Demonstrates the complete lifecycle: backend order generation → provider checkout simulation → server-side verification and receipt issuance.
            </div>
          </div>

          {modalSuccessMessage && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>{modalSuccessMessage}</span>
            </div>
          )}

          <div>
            <Select
              label="Select Student *"
              required
              value={testForm.studentId}
              onChange={(e) => setTestForm({ ...testForm, studentId: e.target.value })}
            >
              <option value="">-- Choose Student --</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Input
              label="Amount (₹) *"
              type="number"
              step="0.01"
              required
              min="1"
              value={testForm.amount}
              onChange={(e) => setTestForm({ ...testForm, amount: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2.5 pt-2">
            <input
              type="checkbox"
              id="simFail"
              checked={testForm.simulateFailure}
              onChange={(e) => setTestForm({ ...testForm, simulateFailure: e.target.checked })}
              className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-rose-600 focus:ring-rose-500 w-4 h-4"
            />
            <label htmlFor="simFail" className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Simulate Payment Failure (tests negative rejection case)
            </label>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsTestCheckoutOpen(false)}>
              Close
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Running Simulation...' : 'Run Simulation'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: View Receipt */}
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
              <Button onClick={() => setSelectedReceipt(null)}>
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
