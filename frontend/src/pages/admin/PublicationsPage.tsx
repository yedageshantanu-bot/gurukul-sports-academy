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
  CreditCard,
  BookMarked,
  Trophy,
  Edit2,
  Calendar,
  CalendarDays,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { apiClient } from '../../lib/api';
import { normalizePhoneNumber } from '../../lib/utils';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { Select } from '../../components/ui/Select';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../contexts/ToastContext';

export interface PublicationStudent {
  id: string;
  student_id: string | null;
  is_external: boolean;
  student_name: string; // Customer Name
  parent_name: string | null;
  contact_number: string;
  email: string | null;
  publication_title: string;
  academic_year: string; // Used for Validity Period e.g. "2026-06-07 to 2027-06-07"
  annual_fee: number;
  amount_paid: number;
  fee_status: 'PAID' | 'PENDING' | 'PARTIAL' | 'OVERDUE';
  renewal_due_date: string;
  delivery_status: 'DISPATCHED' | 'HANDED_OVER' | 'IN_PRINT' | 'PENDING';
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

export interface PublicationSummary {
  totalStudents: number;
  totalAnnualExpected: number;
  totalCollected: number;
  totalPending: number;
  dispatchedCount: number;
}

export interface AcademyStudentOption {
  id: string;
  name: string;
  parentName: string;
  contact: string;
  courseName?: string;
}

export interface PublicationsPageProps {
  embedded?: boolean;
}

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  const d = new Date(clean);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDisplayPeriod(academicYear: string, renewalDueDate?: string): string {
  if (!academicYear) {
    if (renewalDueDate) return `Valid till ${formatDisplayDate(renewalDueDate)}`;
    return '1 Year Validity';
  }
  if (academicYear.includes(' to ')) {
    const [start, end] = academicYear.split(' to ');
    return `${formatDisplayDate(start)} – ${formatDisplayDate(end)}`;
  }
  if (renewalDueDate) {
    return `${academicYear} (Till ${formatDisplayDate(renewalDueDate)})`;
  }
  return academicYear;
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
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Multi-select & Custom WhatsApp Composer State
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isWaComposerOpen, setIsWaComposerOpen] = useState(false);
  const [waRecipients, setWaRecipients] = useState<PublicationStudent[]>([]);
  const [waMessageTemplate, setWaMessageTemplate] = useState('');
  const [isSendingBatch, setIsSendingBatch] = useState(false);

  // Academy students for quick selection
  const [academyStudents, setAcademyStudents] = useState<AcademyStudentOption[]>([]);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedStudentForPay, setSelectedStudentForPay] = useState<PublicationStudent | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('UPI');
  const [payNotes, setPayNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // New Customer Form state (Defaults to Outside / External student per client instructions)
  const [isExternal, setIsExternal] = useState(true);
  const [selectedAcademyStudentId, setSelectedAcademyStudentId] = useState('');
  const [formName, setFormName] = useState('');
  const [formParent, setFormParent] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formTitle, setFormTitle] = useState('Gurukul Martial Arts & Sports Annual Manual - Vol 2026');
  
  // Default fee is strictly 200 (standard publication fee requested by user)
  const [formFee, setFormFee] = useState<string>('200');

  // Date Range: Start Date & End Date (Kab Se Kab Hai)
  const [formStartDate, setFormStartDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [formEndDate, setFormEndDate] = useState<string>(() => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    return nextYear.toISOString().split('T')[0];
  });

  const handleStartDateChange = (newStart: string) => {
    setFormStartDate(newStart);
    if (newStart) {
      const d = new Date(newStart);
      d.setFullYear(d.getFullYear() + 1);
      setFormEndDate(d.toISOString().split('T')[0]);
    }
  };

  const [formDelivery, setFormDelivery] = useState<'DISPATCHED' | 'HANDED_OVER' | 'IN_PRINT' | 'PENDING'>('PENDING');
  const [formNotes, setFormNotes] = useState('');

  // Edit Customer Modal State
  const [editingCustomer, setEditingCustomer] = useState<PublicationStudent | null>(null);
  const [editName, setEditName] = useState('');
  const [editParent, setEditParent] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editFee, setEditFee] = useState('200');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editDelivery, setEditDelivery] = useState<'DISPATCHED' | 'HANDED_OVER' | 'IN_PRINT' | 'PENDING'>('PENDING');
  const [editNotes, setEditNotes] = useState('');

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
      return;
    }
    const found = academyStudents.find((s) => s.id === id);
    if (found) {
      setFormName(found.name || '');
      setFormParent(found.parentName || '');
      setFormContact(found.contact || '');
      toast.info(`Auto-filled: ${found.name}${found.parentName ? ` (Parent: ${found.parentName})` : ''}`);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formContact.trim()) {
      toast.warning('Customer name and contact number are required');
      return;
    }

    try {
      setActionLoading(true);
      const cleanPhone = normalizePhoneNumber(formContact.trim());
      await apiClient('/publications', {
        method: 'POST',
        body: JSON.stringify({
          studentId: !isExternal && selectedAcademyStudentId ? selectedAcademyStudentId : undefined,
          isExternal,
          studentName: formName.trim(),
          parentName: formParent.trim() || undefined,
          contactNumber: cleanPhone,
          publicationTitle: formTitle.trim(),
          academicYear: `${formStartDate} to ${formEndDate}`,
          renewalDueDate: formEndDate,
          annualFee: Number(formFee) || 200,
          deliveryStatus: formDelivery,
          notes: formNotes.trim() || undefined,
        }),
      });

      toast.success('Publication customer registered successfully!');
      setIsCreateModalOpen(false);
      resetForm();
      fetchPublications();
    } catch (err: any) {
      toast.error(err.message || 'Failed to register customer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEdit = (c: PublicationStudent) => {
    setEditingCustomer(c);
    setEditName(c.student_name);
    setEditParent(c.parent_name || '');
    setEditContact(c.contact_number);
    setEditTitle(c.publication_title);
    setEditFee(String(c.annual_fee || 200));

    let start = '';
    let end = c.renewal_due_date || '';
    if (c.academic_year && c.academic_year.includes(' to ')) {
      const parts = c.academic_year.split(' to ');
      start = parts[0];
      end = parts[1];
    } else {
      start = c.created_at ? c.created_at.split('T')[0] : new Date().toISOString().split('T')[0];
      if (!end) {
        const d = new Date(start);
        d.setFullYear(d.getFullYear() + 1);
        end = d.toISOString().split('T')[0];
      }
    }
    setEditStartDate(start);
    setEditEndDate(end);
    setEditDelivery(c.delivery_status);
    setEditNotes(c.notes || '');
    setIsEditModalOpen(true);
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    if (!editName.trim() || !editContact.trim()) {
      toast.warning('Customer name and contact number are required');
      return;
    }

    try {
      setActionLoading(true);
      const cleanPhone = normalizePhoneNumber(editContact.trim());
      await apiClient(`/publications/${editingCustomer.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          studentName: editName.trim(),
          parentName: editParent.trim() || undefined,
          contactNumber: cleanPhone,
          publicationTitle: editTitle.trim(),
          annualFee: Number(editFee) || 200,
          academicYear: `${editStartDate} to ${editEndDate}`,
          renewalDueDate: editEndDate,
          deliveryStatus: editDelivery,
          notes: editNotes.trim() || undefined,
        }),
      });

      toast.success('Customer details updated successfully!');
      setIsEditModalOpen(false);
      setEditingCustomer(null);
      fetchPublications();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update customer');
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
      setPayNotes('');
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
    setStudents((prev) =>
      prev.map((s) => (s.id === student.id ? { ...s, delivery_status: nextStatus } : s))
    );
    try {
      await apiClient(`/publications/${student.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ deliveryStatus: nextStatus }),
      });
      toast.success(`Delivery status updated to ${nextStatus.replace('_', ' ')}`);
      fetchPublications();
    } catch (err: any) {
      toast.error(err.message || 'Status update failed');
      fetchPublications();
    }
  };

  const handleDeleteStudent = async (student: PublicationStudent) => {
    const confirmDelete = window.confirm(
      `Delete publication record for "${student.student_name}"? This will permanently remove the record from the database.`
    );
    if (!confirmDelete) return;

    // Optimistic removal
    setStudents((prev) => prev.filter((p) => p.id !== student.id));

    try {
      await apiClient(`/publications/${student.id}`, { method: 'DELETE' });
      toast.success(`Publication record for "${student.student_name}" deleted.`);
      fetchPublications();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete publication record');
      fetchPublications();
    }
  };

  const resetForm = () => {
    setIsExternal(true);
    setSelectedAcademyStudentId('');
    setFormName('');
    setFormParent('');
    setFormContact('');
    setFormTitle('Gurukul Martial Arts & Sports Annual Manual - Vol 2026');
    setFormFee('200');
    const today = new Date().toISOString().split('T')[0];
    setFormStartDate(today);
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setFormEndDate(nextYear.toISOString().split('T')[0]);
    setFormDelivery('PENDING');
    setFormNotes('');
  };

  const handleOpenSingleWa = (s: PublicationStudent) => {
    if (!s.contact_number) {
      toast.error('No contact number available.');
      return;
    }
    setWaRecipients([s]);
    setWaMessageTemplate(
      `Hello ${s.student_name}, this is an update regarding your publication materials "${s.publication_title}" from Gurukul Sports Academy. Validity Period: ${formatDisplayPeriod(s.academic_year, s.renewal_due_date)}. Delivery Status: ${s.delivery_status}, Fee Status: ${s.fee_status}.`
    );
    setIsWaComposerOpen(true);
  };

  const handleOpenBatchWa = () => {
    const targets = filteredStudents.filter((s) => selectedStudentIds.includes(s.id) && s.contact_number);
    if (targets.length === 0) {
      toast.error('No selected customers with valid contact numbers.');
      return;
    }
    setWaRecipients(targets);
    setWaMessageTemplate(
      `Hello {customer_name}, this is an update regarding your publication materials "{publication_title}" from Gurukul Sports Academy. Delivery Status: {delivery_status}, Fee Status: {fee_status}.`
    );
    setIsWaComposerOpen(true);
  };

  const handleSendWaFromComposer = async () => {
    if (waRecipients.length === 0 || !waMessageTemplate.trim()) return;
    setIsSendingBatch(true);
    let successCount = 0;
    try {
      for (const r of waRecipients) {
        const msg = waMessageTemplate
          .replace(/{customer_name}/g, r.student_name)
          .replace(/{student_name}/g, r.student_name)
          .replace(/{publication_title}/g, r.publication_title)
          .replace(/{academic_year}/g, formatDisplayPeriod(r.academic_year, r.renewal_due_date))
          .replace(/{delivery_status}/g, r.delivery_status)
          .replace(/{fee_status}/g, r.fee_status);

        try {
          await apiClient('/whatsapp/send', {
            method: 'POST',
            body: JSON.stringify({
              recipientPhone: r.contact_number,
              messageBody: msg,
              studentId: r.student_id || undefined,
            }),
          });
          successCount++;
        } catch {
          // continue with rest
        }
      }
      toast.success(`WhatsApp message dispatched to ${successCount} customer(s)!`);
      setIsWaComposerOpen(false);
      setSelectedStudentIds([]);
    } finally {
      setIsSendingBatch(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map((s) => s.id));
    }
  };

  const toggleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Filtered List
  const filteredStudents = (students || []).filter((s) => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const customerName = (s.student_name || '').toLowerCase();
      const parentName = (s.parent_name || '').toLowerCase();
      const contactNo = (s.contact_number || '').toLowerCase();
      const pubTitle = (s.publication_title || '').toLowerCase();

      const match =
        customerName.includes(q) ||
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
                <span className="text-[10px] bg-black/20 text-slate-950 px-1.5 py-0.5 rounded font-extrabold">Annual ₹200</span>
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
            Accounting Rule: Publication &amp; tournament revenues are segregated from recurring academy tuition.
          </span>
        </div>
      )}

      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20">
              <BookOpen className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Published Document &amp; Book Register
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage annual curriculum publications, internal &amp; external subscribers, validity periods, and publication fees (Standard ₹200).
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
            <span>Add Customer</span>
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-white dark:bg-[#1E293B] border-slate-200 dark:border-white/10 relative overflow-hidden shadow-xs dark:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Registered Customers</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500 dark:text-indigo-400">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">{summary.totalStudents}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Academy Athletes &amp; Outside Customers</p>
        </Card>

        <Card className="p-5 bg-white dark:bg-[#1E293B] border-slate-200 dark:border-white/10 relative overflow-hidden shadow-xs dark:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Annual Publication Fees</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
            ₹{summary.totalCollected.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Collected of ₹{summary.totalAnnualExpected.toLocaleString('en-IN')} Expected
          </p>
        </Card>

        <Card className="p-5 bg-white dark:bg-[#1E293B] border-slate-200 dark:border-white/10 relative overflow-hidden shadow-xs dark:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pending Annual Dues</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-2">
            ₹{summary.totalPending.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Segregated from monthly tuition</p>
        </Card>

        <Card className="p-5 bg-white dark:bg-[#1E293B] border-slate-200 dark:border-white/10 relative overflow-hidden shadow-xs dark:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Editions Dispatched</span>
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-500 dark:text-teal-400">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-teal-600 dark:text-teal-300 mt-2">{summary.dispatchedCount}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Handed over or shipped via courier</p>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 bg-white dark:bg-[#1E293B] border-slate-200 dark:border-white/10 shadow-xs dark:shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by customer, parent, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 text-sm"
            />
          </div>

          <div>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm"
            >
              <option value="ALL">All Customer Types (Academy &amp; Outside)</option>
              <option value="INTERNAL">Academy Students Only</option>
              <option value="EXTERNAL">Outside External Customers</option>
            </Select>
          </div>

          <div>
            <Select
              value={feeFilter}
              onChange={(e) => setFeeFilter(e.target.value)}
              className="bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm"
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
              className="bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm"
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

      {/* Multi-Select Floating Bar */}
      {selectedStudentIds.length > 0 && (
        <div className="p-3.5 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-500/40 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-2xl animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 text-xs text-indigo-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              <b>{selectedStudentIds.length}</b> customer(s) selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedStudentIds([])}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Clear Selection
            </button>
            <Button
              type="button"
              onClick={handleOpenBatchWa}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3.5 py-1.5 font-bold shadow-md shadow-emerald-500/20"
            >
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
              <span>Compose &amp; Send WhatsApp ({selectedStudentIds.length})</span>
            </Button>
          </div>
        </div>
      )}

      {/* Publication Customers Table */}
      {loading ? (
        <SkeletonLoader variant="table" rows={5} />
      ) : filteredStudents.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No Publication Customers Found"
          description="Register outside customers or enroll academy athletes who subscribe to annual publication manuals."
          accentColor="indigo"
        />
      ) : (
        <Card className="border-slate-200 dark:border-white/10 bg-white dark:bg-[#1E293B] overflow-hidden shadow-sm dark:shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-[#0F172A] text-slate-600 dark:text-slate-400 uppercase text-[11px] font-bold border-b border-slate-200 dark:border-white/10">
                <tr>
                  <th className="px-4 py-3.5 w-10">
                    <input
                      type="checkbox"
                      checked={filteredStudents.length > 0 && selectedStudentIds.length === filteredStudents.length}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-5 py-3.5">Customer Name</th>
                  <th className="px-5 py-3.5">Contact (WhatsApp)</th>
                  <th className="px-5 py-3.5">Document Title &amp; Validity</th>
                  <th className="px-5 py-3.5">Annual Fee</th>
                  <th className="px-5 py-3.5">Delivery Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredStudents.map((s) => {
                  const pendingDue = Math.max(0, Number(s.annual_fee) - Number(s.amount_paid));
                  const isExpired = s.renewal_due_date && new Date(s.renewal_due_date) < new Date();

                  return (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(s.id)}
                          onChange={() => toggleSelectStudent(s.id)}
                          className="rounded border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>

                      {/* Customer Name */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            {s.student_id ? (
                              <Link
                                to={`/admin/students/${s.student_id}`}
                                className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline text-base inline-flex items-center gap-1.5"
                                title="View Academy Student Profile"
                              >
                                <span>{s.student_name}</span>
                                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                              </Link>
                            ) : (
                              <span className="font-bold text-slate-900 dark:text-white text-base">{s.student_name}</span>
                            )}
                            {s.is_external ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                                Outside Customer
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                                Academy Athlete
                              </span>
                            )}
                          </div>
                          {s.parent_name && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Parent: {s.parent_name}</span>
                          )}
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-5 py-4 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-700 dark:text-slate-300">{s.contact_number}</span>
                          <button
                            type="button"
                            onClick={() => handleOpenSingleWa(s)}
                            title="Edit & send WhatsApp message"
                            className="p-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Document Title & Validity (Kab Se Kab Hai) */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-amber-600 dark:text-amber-300">{s.publication_title}</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-200 dark:border-white/10">
                              <Calendar className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                              <span>{formatDisplayPeriod(s.academic_year, s.renewal_due_date)}</span>
                            </span>
                            {isExpired ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30">
                                Expired / Renewal Due
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20">
                                Active
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Annual Fee */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">₹{Number(s.annual_fee).toLocaleString('en-IN')}</span>
                            <StatusBadge status={s.fee_status} />
                          </div>
                          {pendingDue > 0 ? (
                            <span className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                              Due: ₹{pendingDue.toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400/80 mt-0.5">
                              100% Settled
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Delivery Status */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <select
                            value={s.delivery_status}
                            onChange={(e) => handleToggleDelivery(s, e.target.value)}
                            className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 border transition-all cursor-pointer focus:outline-none ${
                              s.delivery_status === 'HANDED_OVER'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                : s.delivery_status === 'DISPATCHED'
                                ? 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30'
                                : s.delivery_status === 'IN_PRINT'
                                ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                            }`}
                          >
                            <option value="PENDING">⏳ Pending</option>
                            <option value="IN_PRINT">🖨️ In Print</option>
                            <option value="DISPATCHED">🚚 Dispatched</option>
                            <option value="HANDED_OVER">✅ Handed Over</option>
                          </select>
                        </div>
                      </td>

                      {/* Actions */}
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

                          {/* Edit Customer Button */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            title="Edit Customer & Validity Dates"
                            onClick={() => handleOpenEdit(s)}
                            className="text-xs h-8 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 px-2"
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-1 text-indigo-500 dark:text-indigo-400" />
                            <span>Edit</span>
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            title="Send WhatsApp Renewal Notice"
                            onClick={() => handleSendReminder(s)}
                            className="text-xs h-8 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 px-2"
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
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors text-xs cursor-pointer"
                            >
                              <PackageCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                            </button>
                          )}

                          {/* Delete Publication Customer */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            title="Delete Publication Record"
                            onClick={() => handleDeleteStudent(s)}
                            className="text-xs h-8 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
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

      {/* MODAL 1: REGISTER PUBLICATION CUSTOMER */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register Publication Customer / Subscriber"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4 text-slate-800 dark:text-slate-200">
          {/* Internal or External Toggle */}
          <div className="p-3 bg-slate-50 dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between">
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-white block">Customer Category</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Is this customer an academy athlete or an outside learner?</span>
            </div>
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-[#1E293B] p-1 border border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => {
                  setIsExternal(false);
                }}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                  !isExternal ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Academy Athlete
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsExternal(true);
                  setSelectedAcademyStudentId('');
                  setFormName('');
                  setFormParent('');
                  setFormContact('');
                }}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                  isExternal ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Outside Customer
              </button>
            </div>
          </div>

          {/* If Academy Student: Quick Auto-Fill Dropdown */}
          {!isExternal && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Link Existing Academy Athlete
              </label>
              <Select
                value={selectedAcademyStudentId}
                onChange={(e) => handleSelectAcademyStudent(e.target.value)}
                className="bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm"
              >
                <option value="">-- Choose Athlete to Auto-Fill --</option>
                {academyStudents.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} {st.courseName ? `(${st.courseName})` : ''} — Contact: {st.contact}
                  </option>
                ))}
              </Select>

              {selectedAcademyStudentId && (
                <div className="flex items-center gap-2 mt-2 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span>Verified Academy Athlete: Customer, Parent &amp; WhatsApp contact auto-filled from database.</span>
                </div>
              )}
            </div>
          )}

          {/* Customer Name & Parent Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Customer / Reader Name *</label>
              <Input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Full Customer Name"
                className="bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Parent / Guardian Name (Optional)</label>
              <Input
                type="text"
                value={formParent}
                onChange={(e) => setFormParent(e.target.value)}
                placeholder="Parent Name"
                className="bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* WhatsApp Contact with Fixed +91 and 10 Digits & Annual Fee */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <PhoneInput
              label="WhatsApp Contact Number"
              required
              value={formContact}
              onChange={setFormContact}
              placeholder="98765 43210"
              helperText="Fixed +91 prefix. Enter 10-digit mobile number."
            />

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Annual Publication Fee (₹) *</label>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">Standard ₹200</span>
              </div>
              <Input
                type="number"
                min="0"
                required
                value={formFee}
                onChange={(e) => setFormFee(e.target.value)}
                placeholder="200"
                className="bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Publication / Book Title *</label>
            <Input
              type="text"
              required
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
            />
          </div>

          {/* Date Range: Kab Se Kab Tak (Start Date to End Date) */}
          <div className="p-3 bg-slate-50 dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>Validity Period (Kab Se Kab Tak) *</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  if (formStartDate) {
                    const d = new Date(formStartDate);
                    d.setFullYear(d.getFullYear() + 1);
                    setFormEndDate(d.toISOString().split('T')[0]);
                  }
                }}
                className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 transition-colors"
              >
                +1 Year Auto-Fill
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Start Date (Shuruat Ki Date)</label>
                <Input
                  type="date"
                  required
                  value={formStartDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="bg-white dark:bg-[#1E293B] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">End Date / Valid Till (Renewal Date)</label>
                <Input
                  type="date"
                  required
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="bg-white dark:bg-[#1E293B] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs"
                />
              </div>
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-white/5">
              <span>Customer Validity Preview:</span>
              <span className="font-semibold text-amber-600 dark:text-amber-300">
                {formatDisplayPeriod(`${formStartDate} to ${formEndDate}`, formEndDate)}
              </span>
            </div>
          </div>

          {/* Delivery & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Delivery Status</label>
              <Select
                value={formDelivery}
                onChange={(e: any) => setFormDelivery(e.target.value)}
                className="bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm"
              >
                <option value="PENDING">⏳ Pending Action</option>
                <option value="IN_PRINT">🖨️ In Print Queue</option>
                <option value="DISPATCHED">🚚 Dispatched Courier</option>
                <option value="HANDED_OVER">✅ Handed Over</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Tracking / Delivery Notes</label>
              <Input
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="e.g. Handed over at counter / SpeedPost #"
                className="bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={actionLoading}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
            >
              {actionLoading ? 'Saving...' : 'Register Customer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: EDIT PUBLICATION CUSTOMER */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Publication Customer Details"
      >
        <form onSubmit={handleUpdateCustomer} className="space-y-4 text-slate-800 dark:text-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Customer / Reader Name *</label>
              <Input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Parent / Guardian Name</label>
              <Input
                type="text"
                value={editParent}
                onChange={(e) => setEditParent(e.target.value)}
                className="bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <PhoneInput
              label="WhatsApp Contact Number"
              required
              value={editContact}
              onChange={setEditContact}
              placeholder="98765 43210"
              helperText="Fixed +91 prefix. Enter 10-digit mobile number."
            />

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Annual Fee (₹) *</label>
              <Input
                type="number"
                min="0"
                required
                value={editFee}
                onChange={(e) => setEditFee(e.target.value)}
                className="bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Publication / Book Title *</label>
            <Input
              type="text"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
            />
          </div>

          {/* Edit Date Range */}
          <div className="p-3 bg-slate-50 dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>Validity Period (Kab Se Kab Tak) *</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  if (editStartDate) {
                    const d = new Date(editStartDate);
                    d.setFullYear(d.getFullYear() + 1);
                    setEditEndDate(d.toISOString().split('T')[0]);
                  }
                }}
                className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 transition-colors"
              >
                +1 Year Auto-Fill
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Start Date</label>
                <Input
                  type="date"
                  required
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="bg-white dark:bg-[#1E293B] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">End Date / Valid Till</label>
                <Input
                  type="date"
                  required
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  className="bg-white dark:bg-[#1E293B] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs"
                />
              </div>
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-white/5">
              <span>Updated Validity:</span>
              <span className="font-semibold text-amber-600 dark:text-amber-300">
                {formatDisplayPeriod(`${editStartDate} to ${editEndDate}`, editEndDate)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Delivery Status</label>
              <Select
                value={editDelivery}
                onChange={(e: any) => setEditDelivery(e.target.value)}
                className="bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm"
              >
                <option value="PENDING">⏳ Pending Action</option>
                <option value="IN_PRINT">🖨️ In Print Queue</option>
                <option value="DISPATCHED">🚚 Dispatched Courier</option>
                <option value="HANDED_OVER">✅ Handed Over</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Tracking / Delivery Notes</label>
              <Input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="e.g. Handed over at counter"
                className="bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
            <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={actionLoading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
            >
              {actionLoading ? 'Saving...' : 'Update Customer'}
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
        <form onSubmit={handleRecordPayment} className="space-y-4 text-slate-800 dark:text-slate-200">
          <div className="p-3 bg-slate-50 dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-white/10">
            <p className="text-xs text-slate-500 dark:text-slate-400">Customer / Subscriber</p>
            <p className="text-base font-bold text-slate-900 dark:text-white">{selectedStudentForPay?.student_name}</p>
            <p className="text-xs text-amber-600 dark:text-amber-300 mt-0.5">{selectedStudentForPay?.publication_title}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Settlement Amount (₹) *</label>
            <Input
              type="number"
              required
              min="1"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono font-bold text-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Payment Method</label>
            <Select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              className="bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
            >
              <option value="UPI">UPI / Google Pay / PhonePe</option>
              <option value="CASH">Cash at Desk</option>
              <option value="BANK_TRANSFER">Direct Bank Transfer (NEFT/IMPS)</option>
              <option value="RAZORPAY">Razorpay Online</option>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Settlement Notes (Optional)</label>
            <Input
              type="text"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              placeholder="e.g. Cleared via UPI ref 109283"
              className="bg-slate-50 dark:bg-[#0F172A] border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
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

      {/* WhatsApp Message Composer Modal for Published Customers */}
      <Modal
        isOpen={isWaComposerOpen}
        onClose={() => setIsWaComposerOpen(false)}
        title={`Custom WhatsApp Composer (${waRecipients.length} Recipient${waRecipients.length > 1 ? 's' : ''})`}
      >
        <div className="space-y-4 text-slate-800 dark:text-slate-200">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Recipients Preview</label>
            <div className="max-h-24 overflow-y-auto p-2 bg-slate-50 dark:bg-[#0F172A] rounded-lg border border-slate-200 dark:border-white/10 text-xs space-y-1">
              {waRecipients.map((r) => (
                <div key={r.id} className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-white">{r.student_name}</span>
                  <span className="font-mono text-slate-500 dark:text-slate-400">{r.contact_number}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Message Text *</label>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Variables: {'{customer_name}'}, {'{publication_title}'}, {'{academic_year}'}, {'{delivery_status}'}, {'{fee_status}'}
              </span>
            </div>
            <textarea
              rows={4}
              value={waMessageTemplate}
              onChange={(e) => setWaMessageTemplate(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
              placeholder="Type WhatsApp message..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
            <Button type="button" variant="outline" onClick={() => setIsWaComposerOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSendingBatch || !waMessageTemplate.trim()}
              onClick={handleSendWaFromComposer}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              <Send className="w-4 h-4 mr-1.5" />
              <span>{isSendingBatch ? 'Sending...' : `Send to ${waRecipients.length} Recipient(s)`}</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
