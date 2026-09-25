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
import { TeacherItem } from '../../types/crm';
import { GraduationCap, Plus, Search, Edit2, Trash2, AlertTriangle, Mail, Phone, BookOpen, Layers, Eye } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

export const TeachersPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Add/Edit Teacher Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherItem | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete Teacher Modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<TeacherItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');

  const fetchTeachers = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);

      const data = await apiClient<TeacherItem[]>(`/teachers?${params.toString()}`);
      setTeachers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch teachers:', err);
      if (!silent) setTeachers([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTeachers();
  };

  const handleOpenAdd = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setSubject('');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (t: TeacherItem) => {
    setEditingTeacher(t);
    setFullName(t.fullName);
    setPhone(t.phone);
    setSubject(t.subject);
    setFormError('');
    setIsEditModalOpen(true);
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      await apiClient('/teachers', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, phone, subject }),
      });
      setIsAddModalOpen(false);
      fetchTeachers(true); // Silent refresh - no screen flicker
    } catch (err: any) {
      setFormError(err.message || 'Failed to create teacher');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;
    setFormLoading(true);
    setFormError('');
    try {
      await apiClient(`/teachers/${editingTeacher.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ fullName, phone, subject }),
      });
      setIsEditModalOpen(false);
      fetchTeachers(true); // Silent refresh - no screen flicker
    } catch (err: any) {
      setFormError(err.message || 'Failed to update teacher');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteClick = (teacher: TeacherItem) => {
    setTeacherToDelete(teacher);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!teacherToDelete) return;
    setDeleteLoading(true);
    const targetId = teacherToDelete.id;

    // Optimistic UI update: remove row immediately (no screen reload or flicker)
    setTeachers((prev) => prev.filter((t) => t.id !== targetId));
    setIsDeleteModalOpen(false);

    try {
      await apiClient(`/teachers/${targetId}`, {
        method: 'DELETE',
      });
    } catch (err: any) {
      // Rollback on failure
      fetchTeachers(true);
      toast.error(`Failed to delete faculty: ${err.message || 'Unknown error'}`);
    } finally {
      setDeleteLoading(false);
      setTeacherToDelete(null);
    }
  };

  const avatarGradients = [
    'from-orange-500 to-amber-600',
    'from-emerald-500 to-teal-600',
    'from-sky-500 to-blue-600',
    'from-purple-500 to-pink-600',
  ];

  const totalTeachers = teachers.length;
  const activeTeachers = teachers.filter((t) => t.status === 'ACTIVE').length;
  const totalBatchesAssigned = teachers.reduce((acc, t) => acc + (t.assignedBatchCount || 0), 0);
  const uniqueDisciplines = Array.from(new Set(teachers.map((t) => t.subject).filter(Boolean)));

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header - Stitch Style */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Teachers &amp; Coaches Directory
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Register instructors, configure sport specializations, and assign coaching rosters.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg text-sm font-semibold shadow-md shadow-orange-500/30 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Faculty</span>
        </button>
      </div>

      {/* 4 KPI Summary Cards (Stitch Teachers Directory) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Faculty</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Roster</span>
          </div>
          <div className="kpi-value">{loading ? '—' : totalTeachers}</div>
          <div className="kpi-sublabel text-slate-400">Certified athletic coaches</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Status</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">100% on duty</span>
          </div>
          <div className="kpi-value text-emerald-400">{loading ? '—' : activeTeachers}</div>
          <div className="kpi-sublabel text-slate-400">Available for live sessions</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Allocated Batches</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400">Running</span>
          </div>
          <div className="kpi-value text-sky-400">{loading ? '—' : totalBatchesAssigned}</div>
          <div className="kpi-sublabel text-slate-400">Batches with assigned coach</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Disciplines</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400">Specialized</span>
          </div>
          <div className="kpi-value text-purple-400">{loading ? '—' : `${uniqueDisciplines.length} ${uniqueDisciplines.length === 1 ? 'Sport' : 'Sports'}`}</div>
          <div className="kpi-sublabel text-slate-400 truncate">{loading ? 'Loading specializations...' : (uniqueDisciplines.join(', ') || 'Athletics & Martial Arts')}</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-[#1E293B] border border-white/10 rounded-xl shadow-lg">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by faculty name, email, subject, or phone..."
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

      {/* Table / Content */}
      {loading ? (
        <SkeletonLoader variant="table" rows={5} />
      ) : teachers.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No teachers found"
          description="Try adjusting your filters or click below to register a new faculty member."
          actionLabel="Add Faculty"
          onAction={handleOpenAdd}
          accentColor="indigo"
        />
      ) : (
        <div className="bg-[#1E293B] border border-white/10 rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr>
                  <th className="px-6 py-3.5">Faculty Member</th>
                  <th className="px-5 py-3.5">Contact Details</th>
                  <th className="px-5 py-3.5">Specialization</th>
                  <th className="px-5 py-3.5">Assigned Batches</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {teachers.map((t, idx) => {
                  const initials = t.fullName
                    ? t.fullName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .substring(0, 2)
                    : 'FC';
                  const gradient = avatarGradients[idx % avatarGradients.length];

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div
                          onClick={() => navigate(`/admin/teachers/${t.id}`)}
                          className="flex items-center gap-3 cursor-pointer group"
                        >
                          <div
                            className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${gradient} text-white flex items-center justify-center font-bold text-xs shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform`}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {t.fullName}
                            </div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                              <span>{t.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-400 text-xs">
                        {t.phone ? (
                          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                            <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                            <span>{t.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">No phone added</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60">
                          <BookOpen className="w-3 h-3" />
                          {t.subject}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/teachers/${t.id}`)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-800 dark:text-slate-300 hover:text-indigo-600 border border-transparent dark:border-slate-700 transition-colors cursor-pointer"
                        >
                          <Layers className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                          {t.assignedBatchCount || 0} batches
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/teachers/${t.id}`)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                            title="View Faculty Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(t)}
                            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                            title="Edit Faculty"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(t)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Delete Faculty"
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

      {/* Add Teacher Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Register New Faculty Member">
        <form onSubmit={handleCreateTeacher} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
              {formError}
            </div>
          )}
          <Input
            label="Full Name *"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="e.g. Shantanu Yedage"
          />
          <Input
            label="Email Address *"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="teacher@academy.com"
          />
          <Input
            label="Mobile Number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 9876543210"
          />
          <Input
            label="Subject Specialization *"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            placeholder="e.g. Mathematics, Physics"
          />
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={formLoading}>
              {formLoading ? 'Registering...' : 'Register Faculty'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Teacher Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Faculty Profile">
        <form onSubmit={handleUpdateTeacher} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
              {formError}
            </div>
          )}
          <Input
            label="Full Name *"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <Input
            label="Mobile Number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 9876543210"
          />
          <Input
            label="Subject Specialization *"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
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
        title="Delete Faculty Member"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400" />
            <div className="text-xs">
              <span className="font-semibold">Permanent Action:</span> Are you sure you want to permanently delete{' '}
              <span className="font-bold">{teacherToDelete?.fullName}</span>? This will unassign them from batches and remove their account.
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            This action cannot be undone. All associated faculty records will be removed.
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
              Delete Faculty
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
