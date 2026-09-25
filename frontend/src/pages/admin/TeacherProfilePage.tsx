import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { EmptyState } from '../../components/common/EmptyState';
import { apiClient } from '../../lib/api';
import { TeacherItem, BatchItem } from '../../types/crm';
import { useToast } from '../../contexts/ToastContext';
import {
  GraduationCap,
  Mail,
  Phone,
  MessageSquare,
  Calendar,
  ArrowLeft,
  Edit2,
  Plus,
  Trash2,
  Layers,
  Users,
  Clock,
  BookOpen,
  Award,
  ExternalLink,
  ShieldCheck,
  Search,
} from 'lucide-react';

export const TeacherProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [teacher, setTeacher] = useState<TeacherItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'batches' | 'students' | 'overview'>('batches');

  // Edit Teacher Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Assign Batch Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [allBatches, setAllBatches] = useState<BatchItem[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState('');

  // Search filter for students
  const [studentSearch, setStudentSearch] = useState('');

  const fetchTeacherDetails = async (silent = false) => {
    if (!id) return;
    try {
      if (!silent) setLoading(true);
      setError('');
      const data = await apiClient<TeacherItem>(`/teachers/${id}`);
      setTeacher(data);
    } catch (err: any) {
      console.error('Failed to load teacher profile:', err);
      setError(err?.message || 'Could not load teacher profile.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeacherDetails();
  }, [id]);

  const handleOpenEdit = () => {
    if (!teacher) return;
    setEditFullName(teacher.fullName);
    setEditPhone(teacher.phone || '');
    setEditSubject(teacher.subject);
    setEditStatus(teacher.status);
    setEditError('');
    setIsEditModalOpen(true);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setEditLoading(true);
    setEditError('');
    try {
      await apiClient(`/teachers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: editFullName.trim(),
          phone: editPhone.trim() || undefined,
          subject: editSubject.trim(),
          status: editStatus,
        }),
      });
      setIsEditModalOpen(false);
      fetchTeacherDetails(true);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update faculty profile');
    } finally {
      setEditLoading(false);
    }
  };

  const handleOpenAssignBatch = async () => {
    setAssignError('');
    setSelectedBatchId('');
    try {
      const batchesList = await apiClient<BatchItem[]>('/batches?status=ACTIVE');
      setAllBatches(Array.isArray(batchesList) ? batchesList : []);
      setIsAssignModalOpen(true);
    } catch (err: any) {
      toast.error(`Failed to load batches: ${err.message}`);
    }
  };

  const handleConfirmAssignBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !selectedBatchId) return;
    setAssignLoading(true);
    setAssignError('');
    try {
      await apiClient(`/batches/${selectedBatchId}/teachers/${id}`, {
        method: 'POST',
      });
      setIsAssignModalOpen(false);
      fetchTeacherDetails(true);
      toast.success('Batch assigned to instructor successfully!');
    } catch (err: any) {
      setAssignError(err.message || 'Failed to assign batch');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleRemoveBatch = async (batchId: string, batchName: string) => {
    if (!id) return;
    try {
      await apiClient(`/batches/${batchId}/teachers/${id}`, {
        method: 'DELETE',
      });
      fetchTeacherDetails(true);
      toast.success(`Unassigned from batch "${batchName}".`);
    } catch (err: any) {
      toast.error(`Failed to remove batch: ${err.message}`);
    }
  };

  const openWhatsApp = (phone: string, text: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
        <SkeletonLoader variant="cards" />
        <SkeletonLoader variant="table" rows={4} />
      </div>
    );
  }

  if (error || !teacher) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Card className="p-8 text-center border-slate-200 dark:border-slate-800">
          <GraduationCap className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Faculty Member Not Found</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">
            {error || 'The requested teacher profile could not be loaded or may have been deleted.'}
          </p>
          <Button onClick={() => navigate('/admin/teachers')} variant="outline">
            Back to Faculty List
          </Button>
        </Card>
      </div>
    );
  }

  const assignedBatches = teacher.assignedBatches || [];
  const enrolledStudents = teacher.enrolledStudents || [];
  const assignedBatchIds = new Set(assignedBatches.map((b) => b.id));
  const unassignedBatches = allBatches.filter((b) => !assignedBatchIds.has(b.id));

  // Compute total weekly sessions across all batches
  const totalWeeklySessions = assignedBatches.reduce((acc, b) => {
    const days = b.scheduleDays || b.schedule_days || [];
    return acc + (days.length || 0);
  }, 0);

  // Filter students by search
  const filteredStudents = (enrolledStudents || []).filter((s) => {
    if (!studentSearch) return true;
    const query = studentSearch.toLowerCase();
    const name = (s.name || '').toLowerCase();
    const course = (s.course || '').toLowerCase();
    const batchName = (s.batchName || '').toLowerCase();
    const mobile = (s.studentMobile || '').toLowerCase();
    return (
      name.includes(query) ||
      course.includes(query) ||
      batchName.includes(query) ||
      mobile.includes(query)
    );
  });

  const initials = teacher.fullName
    ? teacher.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2)
    : 'FC';

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 animate-in fade-in duration-200">
      {/* Top Bar / Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => navigate('/admin/teachers')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Faculty List
        </button>

        <div className="flex items-center gap-2.5">
          <Button size="sm" variant="outline" onClick={handleOpenEdit} className="gap-2">
            <Edit2 className="w-4 h-4" />
            Edit Profile
          </Button>

          <Button size="sm" onClick={handleOpenAssignBatch} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs">
            <Plus className="w-4 h-4" />
            Assign to Batch
          </Button>
        </div>
      </div>

      {/* Hero Profile Banner */}
      <Card className="relative overflow-hidden border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/20 dark:from-slate-900 dark:via-slate-900/90 dark:to-indigo-950/20 shadow-card">
        <div className="p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-sky-600 text-white flex items-center justify-center font-black text-2xl sm:text-3xl shadow-lg shadow-indigo-500/20 flex-shrink-0">
              {initials}
            </div>

            {/* Identity Info */}
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {teacher.fullName}
                </h1>
                <StatusBadge status={teacher.status} />
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 rounded-full border border-amber-200/80 dark:border-amber-800/60">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  Verified Faculty
                </span>
              </div>

              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  <BookOpen className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  {teacher.subject}
                </span>
              </div>

              {/* Quick Contact Chips */}
              <div className="mt-3.5 flex flex-wrap items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {teacher.email}
                </span>

                {teacher.phone && (
                  <>
                    <span className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {teacher.phone}
                    </span>

                    <button
                      onClick={() =>
                        openWhatsApp(
                          teacher.phone,
                          `Hello ${teacher.fullName}, this is an update regarding your batches at the academy.`
                        )
                      }
                      className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors font-medium cursor-pointer"
                      title="Open WhatsApp Chat"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      WhatsApp Chat
                    </button>
                  </>
                )}

                {teacher.createdAt && (
                  <span className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Joined {new Date(teacher.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Assigned Batches */}
        <Card className="p-5 border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Assigned Batches</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{assignedBatches.length}</p>
          </div>
        </Card>

        {/* Card 2: Enrolled Students */}
        <Card className="p-5 border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Active Students</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{teacher.totalStudents ?? enrolledStudents.length}</p>
          </div>
        </Card>

        {/* Card 3: Weekly Sessions */}
        <Card className="p-5 border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Weekly Classes</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{totalWeeklySessions} Sessions</p>
          </div>
        </Card>

        {/* Card 4: Status */}
        <Card className="p-5 border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Faculty Status</p>
            <div className="mt-1">
              <StatusBadge status={teacher.status} />
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('batches')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'batches'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Assigned Batches ({assignedBatches.length})
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'students'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Enrolled Students ({teacher.totalStudents ?? enrolledStudents.length})
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'overview'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Faculty Credentials & Account
        </button>
      </div>

      {/* Tab 1: Assigned Batches */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Assigned Academic Batches
            </h3>
            <Button size="sm" onClick={handleOpenAssignBatch} variant="outline" className="gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" />
              Assign New Batch
            </Button>
          </div>

          {assignedBatches.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No batches currently assigned"
              description={`Click "Assign New Batch" above to assign ${teacher.fullName} to academic batches.`}
              actionLabel="Assign to Batch"
              onAction={handleOpenAssignBatch}
              accentColor="indigo"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignedBatches.map((batch) => {
                const days = batch.scheduleDays || batch.schedule_days || [];
                const startTime = batch.startTime || batch.start_time;
                const endTime = batch.endTime || batch.end_time;

                return (
                  <Card
                    key={batch.id}
                    className="p-5 border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 transition-all flex flex-col justify-between shadow-xs"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div>
                          <h4 className="font-bold text-base text-slate-900 dark:text-white leading-tight">
                            {batch.name}
                          </h4>
                          <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mt-0.5">
                            {batch.subject || teacher.subject}
                          </p>
                        </div>
                        <StatusBadge status={batch.status || 'ACTIVE'} />
                      </div>

                      {/* Schedule Days */}
                      <div className="mt-3 flex flex-wrap gap-1">
                        {days.length > 0 ? (
                          days.map((d: string) => (
                            <span
                              key={d}
                              className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800"
                            >
                              {d}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No days configured</span>
                        )}
                      </div>

                      {/* Timings & Student Count */}
                      <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                        {startTime && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {startTime} {endTime ? `– ${endTime}` : ''}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {batch.studentCount ?? (batch.students ? batch.students.length : 0)} Students Enrolled
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate('/admin/batches')}
                        className="text-xs py-1 px-2.5 h-7 gap-1 text-slate-700 dark:text-slate-300"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Manage Batch
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveBatch(batch.id, batch.name)}
                        className="text-xs py-1 px-2.5 h-7 gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Unassign teacher from this batch"
                      >
                        <Trash2 className="w-3 h-3" />
                        Unassign
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Enrolled Students */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Students Under Instruction ({filteredStudents.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                All enrolled students across batches assigned to {teacher.fullName}.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search students..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>
          </div>

          {filteredStudents.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No students found"
              description={
                studentSearch
                  ? 'No students matching your search criteria.'
                  : 'There are no active students currently enrolled in batches assigned to this faculty member.'
              }
              accentColor="indigo"
            />
          ) : (
            <Card className="border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Student Name</th>
                      <th className="px-5 py-3.5">Assigned Batch</th>
                      <th className="px-5 py-3.5">Course</th>
                      <th className="px-5 py-3.5">Contact Details</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {filteredStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">{s.name}</div>
                          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">ID: {s.id.slice(0, 8)}...</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60">
                            <Layers className="w-3 h-3" />
                            {s.batchName || 'Assigned Batch'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                          {s.course || 'General'}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-400">
                          {s.parentWhatsapp ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">WA: {s.parentWhatsapp}</span>
                          ) : s.studentMobile ? (
                            <span>Mob: {s.studentMobile}</span>
                          ) : (
                            <span className="text-slate-400 italic">No contact</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/admin/students/${s.id}`)}
                            className="text-xs py-1 px-2.5 h-7 gap-1"
                          >
                            View Student
                            <ExternalLink className="w-3 h-3" />
                          </Button>
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

      {/* Tab 3: Faculty Credentials & Overview */}
      {activeTab === 'overview' && (
        <Card className="p-6 sm:p-8 space-y-6 border-slate-200/80 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Faculty Credentials & Permissions</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Verified instructor credentials, authentication account link, and system access rights.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/60 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Authentication Email
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate mt-0.5">{teacher.email}</p>
                <p className="text-[11px] text-slate-400 mt-1">Used for faculty login portal</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/60 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Registered WhatsApp & Mobile
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{teacher.phone || 'None'}</p>
                <p className="text-[11px] text-slate-400 mt-1">Receives automated batch assignment notifications</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/60 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Academic Specialization
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{teacher.subject}</p>
                <p className="text-[11px] text-slate-400 mt-1">Subject domain assigned in institute</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/60 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  System Role & Access
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">Faculty / Teacher</p>
                <p className="text-[11px] text-slate-400 mt-1">Scoped to attendance marking & assigned batch students</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Edit Teacher Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Faculty Profile">
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          {editError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
              {editError}
            </div>
          )}

          <Input
            label="Full Name *"
            value={editFullName}
            onChange={(e) => setEditFullName(e.target.value)}
            required
            placeholder="e.g. Dr. Ramesh Sharma"
          />

          <Input
            label="Phone / WhatsApp"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            placeholder="e.g. +91 98765 43210"
          />

          <Input
            label="Subject Specialization *"
            value={editSubject}
            onChange={(e) => setEditSubject(e.target.value)}
            required
            placeholder="e.g. Mathematics & Physics"
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-normal mb-1.5">
              Status *
            </label>
            <Select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
              className="w-full text-sm"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </Select>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={editLoading}>
              {editLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Batch Modal */}
      <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title={`Assign Batch to ${teacher.fullName}`}>
        <form onSubmit={handleConfirmAssignBatch} className="space-y-4">
          {assignError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
              {assignError}
            </div>
          )}

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select an active academic batch to assign to <strong>{teacher.fullName}</strong>. An automated WhatsApp alert will be sent with class schedule details.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-normal mb-1.5">
              Select Batch *
            </label>
            {unassignedBatches.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700">
                All available active batches are already assigned to this faculty member.
              </p>
            ) : (
              <Select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                required
                className="w-full text-sm"
              >
                <option value="">-- Choose an active batch --</option>
                {unassignedBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.subject || 'Academic'} — {b.scheduleDays?.join(', ') || 'Scheduled'})
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={assignLoading || !selectedBatchId || unassignedBatches.length === 0}>
              {assignLoading ? 'Assigning...' : 'Confirm Assignment'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
