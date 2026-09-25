import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { apiClient } from '../../lib/api';
import { BatchItem, TeacherItem, StudentItem } from '../../types/crm';
import { Layers, Plus, Search, Edit2, Users, GraduationCap, Trash2, AlertTriangle } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const BatchesPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Creation & Editing Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<BatchItem | null>(null);

  // Delete Batch Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<BatchItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Manage Roster Modal
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [selectedBatchDetails, setSelectedBatchDetails] = useState<BatchItem | null>(null);
  const [allTeachers, setAllTeachers] = useState<TeacherItem[]>([]);
  const [allStudents, setAllStudents] = useState<StudentItem[]>([]);
  const [selectedTeacherToAssign, setSelectedTeacherToAssign] = useState('');
  const [selectedStudentToAssign, setSelectedStudentToAssign] = useState('');

  // Teacher Assignment in Create/Edit Form
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);

  // Form State
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [monthlyFee, setMonthlyFee] = useState('3500');
  const [subject, setSubject] = useState('');
  const [scheduleDays, setScheduleDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const fetchActiveTeachers = async () => {
    try {
      const data = await apiClient<TeacherItem[]>('/teachers?status=ACTIVE');
      setAllTeachers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load active teachers:', err);
    }
  };

  const fetchBatches = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);

      const data = await apiClient<BatchItem[]>(`/batches?${params.toString()}`);
      setBatches(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch batches:', err);
      if (!silent) setBatches([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
    fetchActiveTeachers();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBatches();
  };

  const handleToggleDay = (day: string) => {
    setScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleOpenCreate = () => {
    setName('');
    setDescription('');
    setMonthlyFee('3500');
    setSubject('');
    setScheduleDays(['Mon', 'Wed', 'Fri']);
    setStartTime('10:00');
    setEndTime('11:30');
    setSelectedTeacherIds([]);
    setFormError('');
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (b: BatchItem) => {
    setEditingBatch(b);
    setName(b.name);
    setDescription(b.description || b.subject || '');
    setMonthlyFee(String(b.monthlyFee || 0));
    setSubject(b.subject || '');
    setScheduleDays(b.scheduleDays || []);
    setStartTime(b.startTime || '');
    setEndTime(b.endTime || '');
    setSelectedTeacherIds(b.assignedTeachers?.map((t) => t.teacherId) || []);
    setFormError('');
    setIsEditModalOpen(true);
  };

  const handleOpenManage = async (b: BatchItem) => {
    setFormError('');
    try {
      const batchDetails = await apiClient<BatchItem>(`/batches/${b.id}`);
      setSelectedBatchDetails(batchDetails);

      const [teachersList, studentsList] = await Promise.all([
        apiClient<TeacherItem[]>('/teachers?status=ACTIVE'),
        apiClient<StudentItem[]>('/students?status=ACTIVE'),
      ]);
      setAllTeachers(teachersList);
      setAllStudents(studentsList);
      setSelectedTeacherToAssign('');
      setSelectedStudentToAssign('');
      setIsManageModalOpen(true);
    } catch (err: any) {
      toast.error(`Error loading details: ${err.message}`);
    }
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const feeNum = Number(monthlyFee);
    if (isNaN(feeNum) || feeNum < 0) {
      setFormError('Monthly fee must be a valid positive number or 0.');
      return;
    }
    if (!name.trim()) {
      setFormError('Batch name is required.');
      return;
    }

    setFormLoading(true);
    setFormError('');
    try {
      await apiClient('/batches', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          monthlyFee: feeNum,
          subject: description.trim() || subject || undefined,
          scheduleDays,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          teacherIds: selectedTeacherIds.length > 0 ? selectedTeacherIds : undefined,
        }),
      });
      setIsCreateModalOpen(false);
      fetchBatches(true);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create batch');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatch) return;
    const feeNum = Number(monthlyFee);
    if (isNaN(feeNum) || feeNum < 0) {
      setFormError('Monthly fee must be a valid positive number or 0.');
      return;
    }
    if (!name.trim()) {
      setFormError('Batch name cannot be empty.');
      return;
    }

    setFormLoading(true);
    setFormError('');
    try {
      await apiClient(`/batches/${editingBatch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          monthlyFee: feeNum,
          subject: description.trim() || subject || undefined,
          scheduleDays,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          teacherIds: selectedTeacherIds,
        }),
      });
      setIsEditModalOpen(false);
      fetchBatches(true);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update batch');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteClick = (batch: BatchItem) => {
    setBatchToDelete(batch);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!batchToDelete) return;
    setDeleteLoading(true);
    const targetId = batchToDelete.id;

    // Optimistic UI update: remove row immediately (zero screen flash or jumping)
    setBatches((prev) => prev.filter((b) => b.id !== targetId));
    setIsDeleteModalOpen(false);

    try {
      await apiClient(`/batches/${targetId}`, {
        method: 'DELETE',
      });
    } catch (err: any) {
      fetchBatches(true);
      toast.error(`Failed to delete batch: ${err.message || 'Unknown error'}`);
    } finally {
      setDeleteLoading(false);
      setBatchToDelete(null);
    }
  };

  const handleAssignTeacher = async () => {
    if (!selectedBatchDetails || !selectedTeacherToAssign) return;
    try {
      await apiClient(`/batches/${selectedBatchDetails.id}/teachers`, {
        method: 'POST',
        body: JSON.stringify({ teacherId: selectedTeacherToAssign }),
      });
      const updated = await apiClient<BatchItem>(`/batches/${selectedBatchDetails.id}`);
      setSelectedBatchDetails(updated);
      setSelectedTeacherToAssign('');
      fetchBatches();
      toast.success('Instructor assigned to batch successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign instructor');
    }
  };

  const handleRemoveTeacher = async (teacherId: string) => {
    if (!selectedBatchDetails) return;
    try {
      await apiClient(`/batches/${selectedBatchDetails.id}/teachers/${teacherId}`, {
        method: 'DELETE',
      });
      const updated = await apiClient<BatchItem>(`/batches/${selectedBatchDetails.id}`);
      setSelectedBatchDetails(updated);
      fetchBatches();
      toast.success('Instructor unassigned from batch.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove instructor');
    }
  };

  const handleAssignStudent = async () => {
    if (!selectedBatchDetails || !selectedStudentToAssign) return;
    try {
      await apiClient(`/batches/${selectedBatchDetails.id}/students`, {
        method: 'POST',
        body: JSON.stringify({ studentId: selectedStudentToAssign }),
      });
      const updated = await apiClient<BatchItem>(`/batches/${selectedBatchDetails.id}`);
      setSelectedBatchDetails(updated);
      setSelectedStudentToAssign('');
      fetchBatches();
      toast.success('Student enrolled in batch successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to enroll student');
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!selectedBatchDetails) return;
    try {
      await apiClient(`/batches/${selectedBatchDetails.id}/students/${studentId}`, {
        method: 'DELETE',
      });
      const updated = await apiClient<BatchItem>(`/batches/${selectedBatchDetails.id}`);
      setSelectedBatchDetails(updated);
      fetchBatches();
      toast.success('Student removed from batch roster.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove student');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            Batches & Academic Groups
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure academic batches, schedule recurring class days, and assign teachers & students.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="flex items-center gap-1.5 self-start sm:self-auto shadow-sm">
          <Plus className="w-4 h-4" />
          Create Batch
        </Button>
      </div>

      {/* Filters Bar */}
      <Card className="p-4 border-slate-200/80 dark:border-slate-800 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search by batch name, subject, or assigned teacher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 text-sm border border-slate-200/90 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-slate-50/50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-36 text-xs h-9"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </Select>
            <Button type="submit" variant="outline" size="sm">
              Filter
            </Button>
          </div>
        </form>
      </Card>

      {/* Batches Table */}
      {loading ? (
        <SkeletonLoader variant="table" rows={5} />
      ) : batches.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No batches yet"
          description="Create a batch and assign a monthly fee to begin enrolling students."
          actionLabel="Create Batch"
          onAction={handleOpenCreate}
          accentColor="amber"
        />
      ) : (
        <Card className="border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Batch</th>
                  <th className="px-5 py-3.5">Teacher</th>
                  <th className="px-5 py-3.5">Students</th>
                  <th className="px-5 py-3.5">Monthly Fee</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">{b.name}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {b.description || b.subject ? (
                          <span>{b.description || b.subject}</span>
                        ) : (
                          <span className="italic text-slate-400 dark:text-slate-500">No description</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {b.assignedTeachers && b.assignedTeachers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {b.assignedTeachers.map((t) => (
                            <button
                              key={t.teacherId}
                              type="button"
                              onClick={() => navigate(`/admin/teachers/${t.teacherId}`)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 rounded-md text-[11px] font-medium transition-colors cursor-pointer"
                              title={`View ${t.fullName}'s Profile`}
                            >
                              <GraduationCap className="w-3 h-3" />
                              {t.fullName}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 text-xs">
                        <Users className="w-3 h-3" />
                        {b.studentCount || 0}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs font-bold text-slate-900 dark:text-slate-100">
                      ₹{Number(b.monthlyFee || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenManage(b)}
                          className="px-2.5 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/80"
                        >
                          <Users className="w-3.5 h-3.5 mr-1" />
                          Roster
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(b)}
                          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                          title="Edit Batch"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(b)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Delete Batch"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Batch Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New Batch">
        <form onSubmit={handleCreateBatch} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
              {formError}
            </div>
          )}
          <Input
            label="Batch Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. JEE Morning Batch"
          />
          <Input
            label="Monthly Fee (₹) *"
            type="number"
            min="0"
            step="1"
            value={monthlyFee}
            onChange={(e) => setMonthlyFee(e.target.value)}
            required
            placeholder="e.g. 3500"
          />
          <Input
            label="Description (Optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. JEE preparation batch"
          />
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-normal mb-2">
              Class Days (Optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = scheduleDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleToggleDay(day)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <Input
              label="End Time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
          {/* Assign Teacher(s) while creating batch */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-normal">
                Assign Faculty / Teachers (Optional)
              </label>
              <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                {selectedTeacherIds.length} assigned
              </span>
            </div>
            {allTeachers.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No active faculty members registered yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                {allTeachers.map((t) => {
                  const isAssigned = selectedTeacherIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTeacherIds((prev) =>
                          prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                        );
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        isAssigned
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm ring-2 ring-purple-500/20'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300'
                      }`}
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      <span>{t.fullName}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                          isAssigned
                            ? 'bg-purple-700 text-purple-100'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {t.subject}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={formLoading}>
              {formLoading ? 'Creating...' : 'Create Batch'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Batch Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Batch Details">
        <form onSubmit={handleUpdateBatch} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
              {formError}
            </div>
          )}
          <Input
            label="Batch Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. JEE Morning Batch"
          />
          <Input
            label="Monthly Fee (₹) *"
            type="number"
            min="0"
            step="1"
            value={monthlyFee}
            onChange={(e) => setMonthlyFee(e.target.value)}
            required
            placeholder="e.g. 3500"
          />
          <Input
            label="Description (Optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. JEE preparation batch"
          />
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-normal mb-2">
              Class Days (Optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = scheduleDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleToggleDay(day)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <Input
              label="End Time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
          {/* Assign Teacher(s) while editing batch */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-normal">
                Assigned Faculty / Teachers
              </label>
              <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                {selectedTeacherIds.length} assigned
              </span>
            </div>
            {allTeachers.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No active faculty members registered yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                {allTeachers.map((t) => {
                  const isAssigned = selectedTeacherIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTeacherIds((prev) =>
                          prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                        );
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        isAssigned
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm ring-2 ring-purple-500/20'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300'
                      }`}
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      <span>{t.fullName}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                          isAssigned
                            ? 'bg-purple-700 text-purple-100'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {t.subject}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
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

      {/* Manage Batch (Roster & Business Details) Modal */}
      <Modal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        title={`Batch Details — ${selectedBatchDetails?.name || ''}`}
        maxWidth="2xl"
      >
        <div className="space-y-6">
          {/* Top Business Overview Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Monthly Fee
              </span>
              <div className="text-base font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                ₹{Number(selectedBatchDetails?.monthlyFee || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Active Students
              </span>
              <div className="text-base font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">
                {selectedBatchDetails?.enrolledStudents?.length || 0}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Faculty Assigned
              </span>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">
                {selectedBatchDetails?.assignedTeachers && selectedBatchDetails.assignedTeachers.length > 0
                  ? selectedBatchDetails.assignedTeachers.map((t) => t.fullName).join(', ')
                  : 'Unassigned'}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Status
              </span>
              <div className="mt-1">
                <StatusBadge status={selectedBatchDetails?.status || 'ACTIVE'} />
              </div>
            </div>
          </div>

          {/* Section 1: Assigned Teachers */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                <GraduationCap className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Faculty Assigned</h4>
            </div>

            <div className="space-y-2 mb-3">
              {!selectedBatchDetails?.assignedTeachers || selectedBatchDetails.assignedTeachers.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 italic p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                  No teachers assigned to this batch yet.
                </p>
              ) : (
                selectedBatchDetails.assignedTeachers.map((t) => (
                  <div
                    key={t.teacherId}
                    className="flex items-center justify-between p-3 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 rounded-xl text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{t.fullName}</span>
                      <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-[10px] font-semibold border border-purple-200/60 dark:border-purple-800/60">
                        {t.subject || 'Faculty'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTeacher(t.teacherId)}
                      className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Remove teacher from batch"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={selectedTeacherToAssign}
                onChange={(e) => setSelectedTeacherToAssign(e.target.value)}
                className="text-xs h-10"
              >
                <option value="">Select faculty member to assign...</option>
                {allTeachers
                  .filter(
                    (at) =>
                      !selectedBatchDetails?.assignedTeachers?.some(
                        (bat) => bat.teacherId === at.id
                      )
                  )
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName} ({t.subject})
                    </option>
                  ))}
              </Select>
              <Button
                type="button"
                size="sm"
                onClick={handleAssignTeacher}
                disabled={!selectedTeacherToAssign}
                className="whitespace-nowrap h-10 px-4"
              >
                Assign
              </Button>
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Section 2: Enrolled Students & Fee Status */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                <Users className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Students in this Batch ({selectedBatchDetails?.enrolledStudents?.length || 0})
              </h4>
            </div>

            <div className="space-y-2 mb-3 max-h-64 overflow-y-auto pr-1">
              {!selectedBatchDetails?.enrolledStudents || selectedBatchDetails.enrolledStudents.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 italic p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                  No students enrolled in this batch yet.
                </p>
              ) : (
                selectedBatchDetails.enrolledStudents.map((s) => (
                  <div
                    key={s.studentId}
                    className="flex items-center justify-between p-3 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 rounded-xl text-xs gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{s.name}</span>
                        {s.currentMonthFeeStatus === 'PAID' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            PAID
                          </span>
                        )}
                        {s.currentMonthFeeStatus === 'PARTIAL' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            PARTIAL
                          </span>
                        )}
                        {s.currentMonthFeeStatus === 'PENDING' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            PENDING
                          </span>
                        )}
                        {s.currentMonthFeeStatus === 'OVERDUE' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            OVERDUE
                          </span>
                        )}
                        {(!s.currentMonthFeeStatus || s.currentMonthFeeStatus === 'NOT_ASSIGNED') && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            No Plan
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3">
                        <span>Parent: <strong className="text-slate-700 dark:text-slate-300">{s.parentName || 'N/A'}</strong></span>
                        {s.parentWhatsapp && <span>WhatsApp: {s.parentWhatsapp}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveStudent(s.studentId)}
                      className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex-shrink-0"
                      title="Remove student from batch"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={selectedStudentToAssign}
                onChange={(e) => setSelectedStudentToAssign(e.target.value)}
                className="text-xs h-10"
              >
                <option value="">Select student to enroll...</option>
                {allStudents
                  .filter(
                    (as) =>
                      !selectedBatchDetails?.enrolledStudents?.some(
                        (es) => es.studentId === as.id
                      )
                  )
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.course ? `(${s.course})` : ''}
                    </option>
                  ))}
              </Select>
              <Button
                type="button"
                size="sm"
                onClick={handleAssignStudent}
                disabled={!selectedStudentToAssign}
                className="whitespace-nowrap h-10 px-4"
              >
                Enroll
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !deleteLoading && setIsDeleteModalOpen(false)}
        title="Delete Batch"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400" />
            <div className="text-xs">
              <span className="font-semibold">Permanent Action:</span> Are you sure you want to permanently delete{' '}
              <span className="font-bold">{batchToDelete?.name}</span>? This will unassign all teachers and students from this batch.
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
              Delete Batch
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
