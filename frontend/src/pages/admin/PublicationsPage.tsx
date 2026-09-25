import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Send,
  Truck,
  DollarSign,
  UserCheck,
  MessageSquare,
  PackageCheck,
  Printer,
  CreditCard,
  BookMarked,
  Trophy,
} from 'lucide-react';
import { apiClient } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../contexts/ToastContext';

interface PublicationStudent {
  id: string;
  student_id: string | null;
  is_external: boolean;
  student_name: string;
  parent_name: string | null;
  contact_number: string;
  email: string | null;
  publication_title: string;
  academic_year: string;
  annual_fee: number;
  amount_paid: number;
  fee_status: 'PAID' | 'PENDING' | 'PARTIAL' | 'OVERDUE';
  renewal_due_date: string;
  delivery_status: 'DISPATCHED' | 'HANDED_OVER' | 'IN_PRINT' | 'PENDING';
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

interface PublicationSummary {
  totalStudents: number;
  totalAnnualExpected: number;
  totalCollected: number;
  totalPending: number;
  dispatchedCount: number;
}

interface AcademyStudentOption {
  id: string;
  name: string;
  parentName: string;
  contact: string;
  email: string;
  courseName?: string;
}

export interface PublicationsPageProps {
  embedded?: boolean;
}

export const PublicationsPage: React.FC<PublicationsPageProps> = ({ embedded = false }) => {
  const { toast } = useToast();
  const [students, setStudents] = useState<PublicationStudent[]>([]);
  const [summary, setSummary] = useState<PublicationSummary>({
    totalStudents: 0,
    totalAnnualExpected: 0,
    totalCollected: 0,
    totalPending: 0,
    dispatchedCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [feeFilter, setFeeFilter] = useState('ALL');
  const [deliveryFilter, setDeliveryFilter] = useState('ALL');
  const [sendingWaId, setSendingWaId] = useState<string | null>(null);

  const handleDirectWhatsApp = async (s: PublicationStudent) => {
    if (!s.contact_number) {
      toast.error('No contact number available.');
      return;
    }
    setSendingWaId(s.id);
    try {
      await apiClient<any>('/whatsapp/send', {
        method: 'POST',
        body: JSON.stringify({
          phone: s.contact_number,
          message: `Hello ${s.student_name}, this is an update regarding your publication materials "${s.publication_title}" (${s.academic_year}) from Gurukul Sports Academy. Delivery Status: ${s.delivery_status}, Fee Status: ${s.fee_status}.`,
        }),
      });
      toast.success(`Direct WhatsApp update dispatched to ${s.student_name} via OpenWA gateway!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch WhatsApp message via OpenWA');
    } finally {
      setSendingWaId(null);
    }
  };
  const [typeFilter, setTypeFilter] = useState('ALL'); // ALL, INTERNAL, EXTERNAL

  // Academy students for quick selection with full parent & contact info
  const [academyStudents, setAcademyStudents] = useState<AcademyStudentOption[]>([]);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedStudentForPay, setSelectedStudentForPay] = useState<PublicationStudent | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('UPI');
  const [payNotes, setPayNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // New Student Form state
  const [isExternal, setIsExternal] = useState(false);
  const [selectedAcademyStudentId, setSelectedAcademyStudentId] = useState('');
  const [formName, setFormName] = useState('');
  const [formParent, setFormParent] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTitle, setFormTitle] = useState('Gurukul Martial Arts & Sports Annual Manual - Vol 2026');
  const [formYear, setFormYear] = useState('2026-2027');
  const [formFee, setFormFee] = useState('2500');
  const [formDelivery, setFormDelivery] = useState<'DISPATCHED' | 'HANDED_OVER' | 'IN_PRINT' | 'PENDING'>('PENDING');
  const [formNotes, setFormNotes] = useState('');

  const fetchPublications = async () => {
    try {
      setLoading(true);
      const res = await apiClient<any>('/publications');
      const studentsList = res?.students || res?.data?.students || [];
      const summaryData = res?.summary || res?.data?.summary || {
        totalStudents: 0,
        totalAnnualExpected: 0,
        totalCollected: 0,
        totalPending: 0,
        dispatchedCount: 0,
      };
      setStudents(studentsList);
      setSummary(summaryData);
    } catch (err: any) {
      console.error('Failed to load publications:', err);
      toast.error(err.message || 'Error fetching publications');
    } finally {
      setLoading(false);
    }
  };

  const fetchAcademyStudents = async () => {
    try {
      const res = await apiClient<any>('/students');
      const list = Array.isArray(res) ? res : res?.data || [];
      setAcademyStudents(
        list.map((s: any) => ({
          id: s.id,
          name: s.fullName || s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Student',
          parentName: s.parentName || s.parent_name || '',
          contact: s.contactNumber || s.parentWhatsapp || s.parent_whatsapp || s.studentMobile || s.student_mobile || s.phone || '',
          email: s.email || '',
          courseName: s.course?.title || s.course || s.batch?.name || '',
        }))
      );
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchPublications();
    fetchAcademyStudents();
  }, []);

  const handleSelectAcademyStudent = (id: string) => {
    setSelectedAcademyStudentId(id);
    if (!id) {
      setFormName('');
      setFormParent('');
      setFormContact('');
      setFormEmail('');
      return;
    }
    const found = academyStudents.find((s) => s.id === id);
    if (found) {
      setFormName(found.name || '');
      setFormParent(found.parentName || '');
      setFormContact(found.contact || '');
      setFormEmail(found.email || '');
      toast.info(`Auto-filled: ${found.name}${found.parentName ? ` (Parent: ${found.parentName})` : ''}`);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formContact) {
      toast.warning('Name and contact number are required');
      return;
    }

    try {
      setActionLoading(true);
      await apiClient('/publications', {
        method: 'POST',
        body: JSON.stringify({
          studentId: !isExternal && selectedAcademyStudentId ? selectedAcademyStudentId : undefined,
          isExternal,
          studentName: formName,
          parentName: formParent,
          contactNumber: formContact,
          email: formEmail,
          publicationTitle: formTitle,
          academicYear: formYear,
          annualFee: Number(formFee) || 2500,
          deliveryStatus: formDelivery,
          notes: formNotes,
        }),
      });

      toast.success('Publication student registered successfully!');
      setIsCreateModalOpen(false);
      resetForm();
      fetchPublications();
    } catch (err: any) {
      toast.error(err.message || 'Failed to register student');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForPay || !payAmount) return;

    try {
      setActionLoading(true);
      await apiClient(`/publications/${selectedStudentForPay.id}/fee`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(payAmount),
          paymentMethod: payMethod,
          notes: payNotes,
        }),
      });

      toast.success(`Payment of ₹${Number(payAmount).toLocaleString('en-IN')} recorded successfully!`);
      setIsPaymentModalOpen(false);
      setSelectedStudentForPay(null);
      setPayAmount('');
      fetchPublications();
    } catch (err: any) {
      toast.error(err.message || 'Payment recording failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendReminder = async (student: PublicationStudent) => {
    try {
      await apiClient(`/publications/${student.id}/whatsapp-reminder`, {
        method: 'POST',
      });
      toast.success(`WhatsApp renewal reminder dispatched to ${student.student_name} (${student.contact_number})`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch reminder');
    }
  };

  const handleToggleDelivery = async (student: PublicationStudent, nextStatus: any) => {
    try {
      await apiClient(`/publications/${student.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ deliveryStatus: nextStatus }),
      });
      toast.success(`Delivery status updated to ${nextStatus}`);
      fetchPublications();
    } catch (err: any) {
      toast.error(err.message || 'Status update failed');
    }
  };

  const resetForm = () => {
    setIsExternal(false);
    setSelectedAcademyStudentId('');
    setFormName('');
    setFormParent('');
    setFormContact('');
    setFormEmail('');
    setFormTitle('Gurukul Martial Arts & Sports Annual Manual - Vol 2026');
    setFormFee('2500');
    setFormDelivery('PENDING');
    setFormNotes('');
  };

  // Filtered List
  const filteredStudents = (students || []).filter((s) => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const studentName = (s.student_name || '').toLowerCase();
      const parentName = (s.parent_name || '').toLowerCase();
      const contactNo = (s.contact_number || '').toLowerCase();
      const pubTitle = (s.publication_title || '').toLowerCase();

      const match =
        studentName.includes(q) ||
        parentName.includes(q) ||
        contactNo.includes(q) ||
        pubTitle.includes(q);
      if (!match) return false;
    }
    if (feeFilter !== 'ALL' && s.fee_status !== feeFilter) return false;
    if (deliveryFilter !== 'ALL' && s.delivery_status !== deliveryFilter) return false;
    if (typeFilter === 'INTERNAL' && s.is_external) return false;
    if (typeFilter === 'EXTERNAL' && !s.is_external) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">

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
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 shadow-sm flex items-center gap-1.5 cursor-default font-extrabold"
              >
                <BookMarked className="w-3.5 h-3.5 text-slate-950" />
                Published Document Fees
                <span className="text-[10px] bg-black/20 text-slate-950 px-1.5 py-0.5 rounded font-extrabold">Annual</span>
              </button>
              <Link
                to="/admin/tournaments"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 flex items-center gap-1.5 transition-colors"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                Tournament Entry Fees
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold">Per Event</span>
              </Link>
            </div>
          </div>

          <span className="text-xs text-slate-400 hidden lg:inline">
            Accounting Rule: Publication &amp; tournament revenues are fully segregated from recurring academy tuition.
          </span>
        </div>
      )}

      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <BookOpen className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Published Document &amp; Book Register
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Manage annual curriculum publications, internal &amp; external subscribers, delivery tracking, and separate annual fee renewals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={() => {
              resetForm();
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Publishing Student</span>
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-[#1E293B] border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Enrolled Readers</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-white mt-2">{summary.totalStudents}</p>
          <p className="text-xs text-slate-400 mt-1">Internal Athletes &amp; External Subscribers</p>
        </Card>

        <Card className="p-5 bg-[#1E293B] border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Annual Publication Fees</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-400 mt-2">
            ₹{summary.totalCollected.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Collected of ₹{summary.totalAnnualExpected.toLocaleString('en-IN')} Expected
          </p>
        </Card>

        <Card className="p-5 bg-[#1E293B] border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Pending Annual Dues</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-amber-400 mt-2">
            ₹{summary.totalPending.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-slate-400 mt-1">Segregated from monthly tuition</p>
        </Card>

        <Card className="p-5 bg-[#1E293B] border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Editions Dispatched</span>
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-teal-300 mt-2">{summary.dispatchedCount}</p>
          <p className="text-xs text-slate-400 mt-1">Handed over or shipped via courier</p>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 bg-[#1E293B] border-white/10 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by student, parent, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-[#0F172A] border-white/10 text-white placeholder-slate-500 text-sm"
            />
          </div>

          <div>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-[#0F172A] border-white/10 text-white text-sm"
            >
              <option value="ALL">All Student Types (Internal &amp; External)</option>
              <option value="INTERNAL">Academy Students Only</option>
              <option value="EXTERNAL">Outside External Subscribers</option>
            </Select>
          </div>

          <div>
            <Select
              value={feeFilter}
              onChange={(e) => setFeeFilter(e.target.value)}
              className="bg-[#0F172A] border-white/10 text-white text-sm"
            >
              <option value="ALL">All Fee Statuses</option>
              <option value="PAID">Paid in Full</option>
              <option value="PARTIAL">Partially Settled</option>
              <option value="PENDING">Pending Renewal</option>
            </Select>
          </div>

          <div>
            <Select
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value)}
              className="bg-[#0F172A] border-white/10 text-white text-sm"
            >
              <option value="ALL">All Delivery Statuses</option>
              <option value="HANDED_OVER">Handed Over in Academy</option>
              <option value="DISPATCHED">Dispatched via Courier</option>
              <option value="IN_PRINT">In Print / Queue</option>
              <option value="PENDING">Pending Action</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Publication Students Table */}
      {loading ? (
        <SkeletonLoader variant="table" rows={5} />
      ) : filteredStudents.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No Published Document Students Found"
          description="Register external subscribers or enroll academy students who subscribe to annual publication manuals."
          accentColor="indigo"
        />
      ) : (
        <Card className="border-white/10 bg-[#1E293B] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-[#0F172A] text-slate-400 uppercase text-[11px] font-bold border-b border-white/10">
                <tr>
                  <th className="px-5 py-3.5">Student / Subscriber</th>
                  <th className="px-5 py-3.5">Contact (WhatsApp)</th>
                  <th className="px-5 py-3.5">Document / Edition</th>
                  <th className="px-5 py-3.5">Annual Fee</th>
                  <th className="px-5 py-3.5">Delivery Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredStudents.map((s) => {
                  const pendingDue = Math.max(0, Number(s.annual_fee) - Number(s.amount_paid));
                  return (
                    <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-base">{s.student_name}</span>
                            {s.is_external ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                                External Learner
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                                Academy Athlete
                              </span>
                            )}
                          </div>
                          {s.parent_name && (
                            <span className="text-xs text-slate-400 mt-0.5">Parent: {s.parent_name}</span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-300">{s.contact_number}</span>
                          <button
                            type="button"
                            onClick={() => handleDirectWhatsApp(s)}
                            disabled={sendingWaId === s.id}
                            title="Send direct WhatsApp message via OpenWA Gateway"
                            className="p-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-amber-300">{s.publication_title}</span>
                          <span className="text-[11px] text-slate-400">Year: {s.academic_year}</span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">₹{Number(s.annual_fee).toLocaleString('en-IN')}</span>
                            <StatusBadge status={s.fee_status} />
                          </div>
                          {pendingDue > 0 && (
                            <span className="text-[11px] text-amber-400 mt-0.5">
                              Due: ₹{pendingDue.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {s.delivery_status === 'HANDED_OVER' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <PackageCheck className="w-3.5 h-3.5" /> Handed Over
                            </span>
                          )}
                          {s.delivery_status === 'DISPATCHED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20">
                              <Truck className="w-3.5 h-3.5" /> Dispatched
                            </span>
                          )}
                          {s.delivery_status === 'IN_PRINT' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                              <Printer className="w-3.5 h-3.5" /> In Print
                            </span>
                          )}
                          {s.delivery_status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                              <Clock className="w-3.5 h-3.5" /> Pending
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {pendingDue > 0 && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                setSelectedStudentForPay(s);
                                setPayAmount(String(pendingDue));
                                setIsPaymentModalOpen(true);
                              }}
                              className="text-xs h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                            >
                              Collect Fee
                            </Button>
                          )}

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            title="Send WhatsApp Renewal Notice"
                            onClick={() => handleSendReminder(s)}
                            className="text-xs h-8 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                          >
                            <Send className="w-3 h-3 mr-1" />
                            <span>Remind</span>
                          </Button>

                          {/* Quick delivery toggle */}
                          {s.delivery_status !== 'HANDED_OVER' && (
                            <button
                              type="button"
                              title="Mark Handed Over"
                              onClick={() => handleToggleDelivery(s, 'HANDED_OVER')}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors text-xs"
                            >
                              <PackageCheck className="w-4 h-4 text-emerald-400" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL 1: REGISTER PUBLICATION STUDENT */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register Published Document Student"
      >
        <form onSubmit={handleCreateStudent} className="space-y-4 text-slate-200">
          {/* Internal or External Toggle */}
          <div className="p-3 bg-[#0F172A] rounded-xl border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-sm font-bold text-white block">Student Category</span>
              <span className="text-xs text-slate-400">Is this learner outside our academy or enrolled student?</span>
            </div>
            <div className="inline-flex rounded-lg bg-[#1E293B] p-1 border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setIsExternal(false);
                }}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                  !isExternal ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'
                }`}
              >
                Academy Student
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsExternal(true);
                  setSelectedAcademyStudentId('');
                  setFormName('');
                  setFormParent('');
                  setFormContact('');
                  setFormEmail('');
                }}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                  isExternal ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400'
                }`}
              >
                Outside Learner
              </button>
            </div>
          </div>

          {!isExternal && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Select Existing Academy Student (Auto-fills Profile & Parent Details)
              </label>
              <Select
                value={selectedAcademyStudentId}
                onChange={(e) => handleSelectAcademyStudent(e.target.value)}
                className="bg-[#0F172A] border-white/10 text-white text-sm"
              >
                <option value="">-- Choose enrolled student --</option>
                {academyStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.parentName ? `• Parent: ${s.parentName}` : ''} • {s.contact}
                  </option>
                ))}
              </Select>

              {selectedAcademyStudentId && (
                <div className="flex items-center gap-2 mt-2 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Verified Academy Student: Student, Parent & WhatsApp contact auto-filled from database.</span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Student / Reader Name *</label>
              <Input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Full Name"
                className="bg-[#0F172A] border-white/10 text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Parent / Guardian Name</label>
              <Input
                type="text"
                value={formParent}
                onChange={(e) => setFormParent(e.target.value)}
                placeholder="Parent Name"
                className="bg-[#0F172A] border-white/10 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">WhatsApp Contact *</label>
              <Input
                type="text"
                required
                value={formContact}
                onChange={(e) => setFormContact(e.target.value)}
                placeholder="+919876543210"
                className="bg-[#0F172A] border-white/10 text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Email Address (Optional)</label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="student@example.com"
                className="bg-[#0F172A] border-white/10 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Publication / Document Title *</label>
            <Input
              type="text"
              required
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="bg-[#0F172A] border-white/10 text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Annual Fee (₹)</label>
              <Input
                type="number"
                value={formFee}
                onChange={(e) => setFormFee(e.target.value)}
                className="bg-[#0F172A] border-white/10 text-white font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Academic Year</label>
              <Input
                type="text"
                value={formYear}
                onChange={(e) => setFormYear(e.target.value)}
                className="bg-[#0F172A] border-white/10 text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Delivery Status</label>
              <Select
                value={formDelivery}
                onChange={(e: any) => setFormDelivery(e.target.value)}
                className="bg-[#0F172A] border-white/10 text-white text-sm"
              >
                <option value="PENDING">Pending</option>
                <option value="IN_PRINT">In Print Queue</option>
                <option value="DISPATCHED">Dispatched Courier</option>
                <option value="HANDED_OVER">Handed Over</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Notes / Courier Tracking</label>
            <Input
              type="text"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="e.g. Speed Post Tracking # / Handed over in Dojo"
              className="bg-[#0F172A] border-white/10 text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={actionLoading}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
            >
              {actionLoading ? 'Saving...' : 'Register Student'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: RECORD PUBLICATION FEE */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Publication Annual Fee"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4 text-slate-200">
          <div className="p-3 bg-[#0F172A] rounded-xl border border-white/10">
            <p className="text-xs text-slate-400">Student / Subscriber</p>
            <p className="text-base font-bold text-white">{selectedStudentForPay?.student_name}</p>
            <p className="text-xs text-amber-300 mt-0.5">{selectedStudentForPay?.publication_title}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Settlement Amount (₹) *</label>
            <Input
              type="number"
              required
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="bg-[#0F172A] border-white/10 text-white font-mono font-bold text-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Payment Method</label>
            <Select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              className="bg-[#0F172A] border-white/10 text-white"
            >
              <option value="UPI">UPI / Google Pay / PhonePe</option>
              <option value="CASH">Cash in Dojo</option>
              <option value="RAZORPAY">Razorpay Online</option>
              <option value="BANK_TRANSFER">Direct Bank Transfer (NEFT/IMPS)</option>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Settlement Notes</label>
            <Input
              type="text"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              placeholder="e.g. Annual renewal cleared via UPI ref 109283"
              className="bg-[#0F172A] border-white/10 text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
            <Button type="button" variant="outline" onClick={() => setIsPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              {actionLoading ? 'Recording...' : 'Confirm Payment'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
