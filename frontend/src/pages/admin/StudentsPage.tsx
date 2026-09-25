import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
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
  Layers,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldCheck,
  ExternalLink,
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
  const navigate = useNavigate();
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

  // Form Fields - Prioritized for Real Data Entry
  const [name, setName] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentWhatsapp, setParentWhatsapp] = useState('');
  const [studentMobile, setStudentMobile] = useState('');
  const [batchId, setBatchId] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

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

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);

      const [studentsData, batchesData, plansData] = await Promise.all([
        apiClient<StudentItem[]>(`/students?${params.toString()}`),
        apiClient<BatchItem[]>('/batches?status=ACTIVE'),
        apiClient<{ success: boolean; data: any[] }>('/fees/plans').catch(() => ({ success: false, data: [] })),
      ]);

      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setBatches(Array.isArray(batchesData) ? batchesData : []);
      const planList = Array.isArray(plansData) ? plansData : ((plansData as any)?.data || []);
      setFeePlans(planList);
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

  const handleOpenAdd = () => {
    setName('');
    setParentName('');
    setParentWhatsapp('');
    setStudentMobile('');
    setBatchId(batches.length > 0 ? batches[0].id : '');
    setWhatsappOptIn(true);
    setStatus('ACTIVE');
    setCourse('');
    setMonthlyFee(0);
    setFeeDueDay(5);
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (s: StudentItem) => {
    setEditingStudent(s);
    setName(s.name);
    setParentName(s.parentName || '');
    setParentWhatsapp(s.parentWhatsapp || '');
    setStudentMobile(s.studentMobile || '');

    const currentBatchId = s.batchId || (s.enrolledBatches && s.enrolledBatches[0]?.id) || '';
    setBatchId(currentBatchId);
    setWhatsappOptIn(s.whatsappOptIn !== false);
    setStatus(s.status || 'ACTIVE');
    setCourse(s.course || '');
    setMonthlyFee(s.monthlyFee || 0);
    setFeeDueDay(s.feeDueDay || 5);
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
      await apiClient('/students', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          parentName: parentName.trim(),
          parentWhatsapp: pCheck.normalized,
          studentMobile: normalizedStudentMobile,
          batchId: batchId || undefined,
          whatsappOptIn,
          status,
          course: course.trim() || undefined,
          monthlyFee: Number(monthlyFee) || 0,
          feeDueDay: Number(feeDueDay) || 5,
        }),
      });
      setIsAddModalOpen(false);
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
          batchId: batchId !== undefined ? batchId : undefined,
          whatsappOptIn,
          status,
          course: course.trim() || undefined,
          monthlyFee: Number(monthlyFee),
          feeDueDay: Number(feeDueDay),
        }),
      });
      setIsEditModalOpen(false);
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
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Students Directory
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Manage active enrollments, batch rosters, parent WhatsApp contacts, and fee profiles.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg text-sm font-semibold shadow-md shadow-orange-500/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Student</span>
        </button>
      </div>

      {/* 4 KPI Summary Cards (Stitch Students Directory) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Enrolled</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">All Batches</span>
          </div>
          <div className="kpi-value">{totalCount}</div>
          <div className="kpi-sublabel text-slate-400">Registered academy athletes</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Status</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">On Duty</span>
          </div>
          <div className="kpi-value text-emerald-400">{activeCount}</div>
          <div className="kpi-sublabel text-slate-400">Actively attending training</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fee Compliant</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400">Current Cycle</span>
          </div>
          <div className="kpi-value text-sky-400">{feeCompliantCount}%</div>
          <div className="kpi-sublabel text-slate-400">Cleared monthly subscriptions</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fee Pending</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">Action Required</span>
          </div>
          <div className="kpi-value text-amber-400">{pendingFeeCount}</div>
          <div className="kpi-sublabel text-slate-400">Athletes requiring follow-up</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-[#1E293B] border border-white/10 rounded-xl">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name, parent name, or WhatsApp number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 text-sm border border-white/10 rounded-lg focus:outline-none focus:border-[#F97316] bg-[#0F172A] text-white placeholder:text-slate-400 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-36 text-xs h-9 bg-[#0F172A] border-white/10 text-white"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </Select>
            <button
              type="submit"
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#273549] hover:bg-[#334155] border border-white/10 text-white transition-colors"
            >
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Students Table */}
      {loading ? (
        <SkeletonLoader variant="table" rows={5} />
      ) : students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students found"
          description="Add your first student to start managing attendance and fees."
          actionLabel="Add Student"
          onAction={handleOpenAdd}
          accentColor="indigo"
        />
      ) : (
        <div className="bg-[#1E293B] border border-white/10 rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Student &amp; ID</th>
                  <th>Parent Contact</th>
                  <th>Batch / Sport</th>
                  <th>WhatsApp</th>
                  <th>Fee Status</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {students.map((s, idx) => {
                  const initials = s.name
                    ? s.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .substring(0, 2)
                    : 'ST';
                  const gradient = avatarColors[idx % avatarColors.length];

                  const assignedBatchName =
                    s.batchName ||
                    (s.enrolledBatches && s.enrolledBatches.length > 0 ? s.enrolledBatches[0].name : null);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                      {/* Student Name */}
                      <td className="px-6 py-4">
                        <div
                          onClick={() => navigate(`/admin/students/${s.id}`)}
                          className="flex items-center gap-3 cursor-pointer group"
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
                        </div>
                      </td>

                      {/* Parent / Primary WhatsApp */}
                      <td className="px-5 py-4 text-xs">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {s.parentName || <span className="text-slate-400 italic">No parent name</span>}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          {s.parentWhatsapp ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
                              <MessageSquare className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              {s.parentWhatsapp}
                            </span>
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

                      {/* Assigned Batch */}
                      <td className="px-5 py-4 text-xs">
                        {assignedBatchName ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80">
                            <Layers className="w-3.5 h-3.5 text-indigo-500" />
                            {assignedBatchName}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-400 italic">Unassigned</span>
                        )}
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
                            PARTIAL
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
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/students/${s.id}`)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                            title="View Full Profile"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
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
            <div>
              <Input
                label="Parent WhatsApp Number * (Primary contact)"
                value={parentWhatsapp}
                onChange={(e) => setParentWhatsapp(e.target.value)}
                required
                placeholder="e.g. 9876543210 or +91 9876543210"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Attendance and fee receipts will be dispatched to this WhatsApp number.
              </p>
            </div>

            {/* 4. Student Mobile Number (Optional) */}
            <Input
              label="Student Mobile Number (Optional)"
              value={studentMobile}
              onChange={(e) => setStudentMobile(e.target.value)}
              placeholder="e.g. 9876543211 (Only if student has personal phone)"
            />

            {/* Course & Fee Plan Selection */}
            <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Course / Fee Plan *</span>
                <button
                  type="button"
                  onClick={() => setIsCreateCourseModalOpen(true)}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition-colors bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Course</span>
                </button>
              </div>
              <div>
                <Select
                  value={selectedPlanId}
                  onChange={(e) => {
                    const planId = e.target.value;
                    setSelectedPlanId(planId);
                    if (planId === 'CUSTOM') {
                      // Manual entry mode
                    } else if (planId) {
                      const found = feePlans.find((p) => p.id === planId);
                      if (found) {
                        setCourse(found.name);
                        setMonthlyFee(Number(found.amount));
                        if (found.due_day) setFeeDueDay(found.due_day);
                      }
                    } else {
                      setCourse('');
                      setMonthlyFee(0);
                    }
                  }}
                >
                  <option value="">-- Select Course / Fee Plan --</option>
                  {feePlans.filter((p) => p.active !== false).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ₹{Number(p.amount).toLocaleString('en-IN')} / {p.frequency ? p.frequency.toLowerCase() : 'cycle'}
                    </option>
                  ))}
                  <option value="CUSTOM">Custom Course / Other Entry</option>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Course Name *"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  required
                  placeholder="e.g. Kalarippayattu (Monthly)"
                />
                <Input
                  label="Fee Amount (₹) *"
                  type="number"
                  min="0"
                  step="1"
                  value={monthlyFee === 0 ? '' : monthlyFee}
                  onChange={(e) => setMonthlyFee(Number(e.target.value))}
                  required
                  placeholder="e.g. 700"
                />
              </div>
            </div>

            {/* 5. Batch Selector */}
            <Select
              label="Assign to Batch (Optional)"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
            >
              <option value="">-- No Batch Assigned / Assign Later --</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.subject ? `(${b.subject})` : ''}
                </option>
              ))}
            </Select>

            {/* 6. WhatsApp Opt-in Card */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    WhatsApp Automated Notifications
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Send absent alerts, late arrival updates, and payment receipts.
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
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={formLoading}>
              {formLoading ? 'Saving...' : 'Enroll Student'}
            </Button>
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
            <div>
              <Input
                label="Parent WhatsApp Number * (Primary contact)"
                value={parentWhatsapp}
                onChange={(e) => setParentWhatsapp(e.target.value)}
                required
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                E.164 format supported (e.g. +91 9404849500).
              </p>
            </div>

            {/* 4. Student Mobile Number */}
            <Input
              label="Student Mobile Number (Optional)"
              value={studentMobile}
              onChange={(e) => setStudentMobile(e.target.value)}
              placeholder="Leave empty if not required"
            />

            {/* Course & Fee Plan Selection */}
            <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/60 space-y-3">
              <div>
                <Select
                  label="Course / Fee Plan"
                  value={selectedPlanId}
                  onChange={(e) => {
                    const planId = e.target.value;
                    setSelectedPlanId(planId);
                    if (planId === 'CUSTOM') {
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
                  <option value="">-- Select Course / Fee Plan --</option>
                  {feePlans.filter((p) => p.active !== false).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ₹{Number(p.amount).toLocaleString('en-IN')} / {p.frequency ? p.frequency.toLowerCase() : 'cycle'}
                    </option>
                  ))}
                  <option value="CUSTOM">Custom Course / Other Entry</option>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Course Name"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  placeholder="e.g. Kalarippayattu (Monthly)"
                />
                <Input
                  label="Fee Amount (₹)"
                  type="number"
                  min="0"
                  step="1"
                  value={monthlyFee === 0 ? '' : monthlyFee}
                  onChange={(e) => setMonthlyFee(Number(e.target.value))}
                  placeholder="e.g. 700"
                />
              </div>
            </div>

            {/* 5. Batch Selector */}
            <Select
              label="Assigned Batch"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
            >
              <option value="">-- No Batch Assigned --</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.subject ? `(${b.subject})` : ''}
                </option>
              ))}
            </Select>

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
    </div>
  );
};
