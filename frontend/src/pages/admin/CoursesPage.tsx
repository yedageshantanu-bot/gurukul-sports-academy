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
import { FeePlan } from '../../types/fee';
import { useToast } from '../../contexts/ToastContext';
import {
  BookOpen,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  Users,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export const CoursesPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [courses, setCourses] = useState<FeePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<FeePlan | null>(null);

  // Delete Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<FeePlan | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form states
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    frequency: 'MONTHLY',
    dueDay: '5',
  });

  const fetchCourses = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await apiClient<any>('/fees/plans');
      const list = Array.isArray(res) ? res : (res?.data || []);
      setCourses(list);
    } catch (err: any) {
      console.error('Failed to load courses:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      amount: '',
      frequency: 'MONTHLY',
      dueDay: '5',
    });
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (course: FeePlan) => {
    setEditingCourse(course);
    setFormData({
      name: course.name,
      amount: String(course.amount),
      frequency: course.frequency || 'MONTHLY',
      dueDay: String(course.due_day || 5),
    });
    setFormError('');
    setIsEditModalOpen(true);
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.amount) {
      setFormError('Course name and standard fee are required.');
      return;
    }
    setFormLoading(true);
    setFormError('');
    try {
      await apiClient('/fees/plans', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name.trim(),
          amount: parseFloat(formData.amount),
          frequency: formData.frequency,
          dueDay: parseInt(formData.dueDay, 10) || 5,
        }),
      });
      setIsAddModalOpen(false);
      setSuccessToast(`Course "${formData.name.trim()}" created successfully!`);
      setTimeout(() => setSuccessToast(null), 4000);
      await fetchCourses(true);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create course');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    if (!formData.name.trim() || !formData.amount) {
      setFormError('Course name and standard fee are required.');
      return;
    }
    setFormLoading(true);
    setFormError('');
    try {
      await apiClient(`/fees/plans/${editingCourse.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: formData.name.trim(),
          amount: parseFloat(formData.amount),
          frequency: formData.frequency,
          dueDay: parseInt(formData.dueDay, 10) || 5,
        }),
      });
      setIsEditModalOpen(false);
      setEditingCourse(null);
      setSuccessToast(`Course "${formData.name.trim()}" updated successfully!`);
      setTimeout(() => setSuccessToast(null), 4000);
      await fetchCourses(true);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update course');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (course: FeePlan) => {
    try {
      const endpoint = course.active ? 'deactivate' : 'activate';
      await apiClient(`/fees/plans/${course.id}/${endpoint}`, {
        method: 'POST',
      });
      setSuccessToast(`Course "${course.name}" status updated.`);
      toast.success(`Course "${course.name}" ${course.active ? 'deactivated' : 'activated'}.`);
      setTimeout(() => setSuccessToast(null), 3000);
      await fetchCourses(true);
    } catch (err: any) {
      toast.error(`Failed to update status: ${err.message || 'Unknown error'}`);
    }
  };

  const handleDeleteClick = (course: FeePlan) => {
    setCourseToDelete(course);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!courseToDelete) return;
    setDeleteLoading(true);
    const targetId = courseToDelete.id;
    const targetName = courseToDelete.name;

    // Optimistic UI update: instantly remove from list
    setCourses((prev) => prev.filter((c) => c.id !== targetId));
    setIsDeleteModalOpen(false);

    try {
      await apiClient(`/fees/plans/${targetId}`, {
        method: 'DELETE',
      });
      setSuccessToast(`Course "${targetName}" deleted successfully!`);
      toast.success(`Course "${targetName}" deleted successfully.`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      // Re-fetch on failure
      fetchCourses(true);
      toast.error(`Failed to delete course: ${err.message || 'Unknown error'}`);
    } finally {
      setDeleteLoading(false);
      setCourseToDelete(null);
    }
  };

  // Filtered courses
  const q = (search || '').trim().toLowerCase();
  const filteredCourses = (courses || []).filter((c) => {
    const matchesSearch = !q || (c.name || '').toLowerCase().includes(q);
    const matchesFreq = frequencyFilter === 'ALL' || c.frequency === frequencyFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && c.active) ||
      (statusFilter === 'INACTIVE' && !c.active);
    return matchesSearch && matchesFreq && matchesStatus;
  });

  const totalMonthly = (courses || []).filter((c) => c.frequency === 'MONTHLY').length;
  const totalYearly = (courses || []).filter((c) => c.frequency === 'YEARLY').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>Courses & Programs</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Configure martial arts disciplines, tuition fee schedules, and student enrollment courses.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleOpenAdd} className="shadow-sm gap-2">
            <Plus className="w-4 h-4" />
            Add Course
          </Button>
        </div>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-2.5 shadow-sm animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="font-semibold">{successToast}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card hoverEffect accent="indigo" className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Courses
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800/60">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              {courses.length}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {courses.filter((c) => c.active).length} currently active for admissions
            </p>
          </div>
        </Card>

        <Card hoverEffect accent="emerald" className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Monthly Programs
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-800/60">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-400 tracking-tight">
              {totalMonthly}
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
              Standard monthly fee plans
            </p>
          </div>
        </Card>

        <Card hoverEffect accent="purple" className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Yearly Packages
            </span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-800/60">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 tracking-tight">
              {totalYearly}
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-1">
              Annual admission subscriptions
            </p>
          </div>
        </Card>

        <Card hoverEffect accent="amber" className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Admissions
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-800/60">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => navigate('/admin/students')}
              className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer group"
            >
              <span>Enroll Student with Course</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Courses auto-fill student fee forms
            </p>
          </div>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="p-4 border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search course name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Select
              value={frequencyFilter}
              onChange={(e) => setFrequencyFilter(e.target.value)}
              className="text-xs w-full sm:w-44"
            >
              <option value="ALL">All Frequencies</option>
              <option value="MONTHLY">Monthly Plans</option>
              <option value="YEARLY">Yearly Packages</option>
            </Select>

            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs w-full sm:w-40"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Courses List */}
      {loading ? (
        <SkeletonLoader variant="table" rows={4} />
      ) : filteredCourses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses found"
          description="Create your first academy course to start enrolling students."
          actionLabel="Add Course"
          onAction={handleOpenAdd}
          accentColor="indigo"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCourses.map((c) => {
            const isYearly = c.frequency === 'YEARLY';
            return (
              <Card
                key={c.id}
                hoverEffect
                className="p-5 flex flex-col justify-between border-slate-200/80 dark:border-slate-800/80 shadow-xs relative overflow-hidden"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 mb-2">
                        {isYearly ? 'Annual Package' : 'Monthly Discipline'}
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug">
                        {c.name}
                      </h3>
                    </div>
                    <StatusBadge status={c.active ? 'ACTIVE' : 'INACTIVE'} />
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                        ₹{Number(c.amount || 0).toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-medium ml-1">
                        / {c.frequency ? c.frequency.toLowerCase() : 'cycle'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded">
                      Due Day {c.due_day || 5}
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(c)}
                    className="text-xs h-8 px-2.5 gap-1.5 flex-1 justify-center hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Edit Course"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleStatus(c)}
                    className={`text-xs h-8 px-2.5 ${
                      c.active
                        ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:border-amber-200 dark:hover:border-amber-800/60'
                        : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-200 dark:hover:border-emerald-800/60'
                    }`}
                    title={c.active ? 'Deactivate Course' : 'Activate Course'}
                  >
                    {c.active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(c)}
                    className="p-1.5 h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200/80 dark:border-slate-700/80 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-200 dark:hover:border-rose-800/60 transition-colors cursor-pointer"
                    title="Delete Course"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Add Course */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add Academy Course" maxWidth="md">
        <form onSubmit={handleCreateCourse} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <Input
            label="Course / Program Name *"
            required
            placeholder="e.g. Kalarippayattu (Monthly) or Boxing"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <Input
            label="Standard Tuition Fee (₹) *"
            type="number"
            min="0"
            step="1"
            required
            placeholder="e.g. 700"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Billing Frequency"
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
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
              value={formData.dueDay}
              onChange={(e) => setFormData({ ...formData, dueDay: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={formLoading}>
              {formLoading ? 'Creating...' : 'Create Course'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Course */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Academy Course" maxWidth="md">
        <form onSubmit={handleUpdateCourse} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <Input
            label="Course / Program Name *"
            required
            placeholder="e.g. Kalarippayattu (Monthly)"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <Input
            label="Standard Tuition Fee (₹) *"
            type="number"
            min="0"
            step="1"
            required
            placeholder="e.g. 700"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Billing Frequency"
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
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
              value={formData.dueDay}
              onChange={(e) => setFormData({ ...formData, dueDay: e.target.value })}
            />
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

      {/* Modal: Delete Course Confirmation */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!deleteLoading) {
            setIsDeleteModalOpen(false);
            setCourseToDelete(null);
          }
        }}
        title="Delete Academy Course"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-rose-800 dark:text-rose-300">
              <p className="font-bold text-sm text-rose-900 dark:text-rose-200">
                Are you sure you want to delete this course?
              </p>
              <p className="mt-1">
                Course: <span className="font-semibold">{courseToDelete?.name}</span> (₹{Number(courseToDelete?.amount || 0).toLocaleString('en-IN')})
              </p>
              <p className="mt-1 text-slate-500 dark:text-slate-400">
                This action will permanently delete this course plan. Existing student records and payment histories will be preserved safely.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setCourseToDelete(null);
              }}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleteLoading}
              className="bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
            >
              {deleteLoading ? 'Deleting...' : 'Yes, Delete Course'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CoursesPage;
