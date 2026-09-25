import React, { useEffect, useState, useMemo } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { apiClient } from '../../lib/api';
import { BatchItem } from '../../types/crm';
import { validatePhoneNumber } from '../../lib/utils';
import { Layers, Users, Calendar, Clock, CheckSquare, Phone, Plus, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';

export const TeacherBatchesPage: React.FC = () => {
  const { toast } = useToast();
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Batch details modal
  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Enroll Student Modal State (Faculty board)
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [enrollSubmitting, setEnrollSubmitting] = useState(false);
  const [enrollError, setEnrollError] = useState('');
  const [studentName, setStudentName] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentWhatsapp, setParentWhatsapp] = useState('');
  const [studentMobile, setStudentMobile] = useState('');
  const [course, setCourse] = useState('');
  const [monthlyFee, setMonthlyFee] = useState<number>(0);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [admissionDate, setAdmissionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [backfillPastFees, setBackfillPastFees] = useState(false);
  const [pastFeesStatus, setPastFeesStatus] = useState<'PAID' | 'PENDING'>('PAID');

  const isPastAdmission = useMemo(() => {
    if (!admissionDate) return false;
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const selectedPeriod = admissionDate.slice(0, 7);
    return selectedPeriod < currentPeriod;
  }, [admissionDate]);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const data = await apiClient<BatchItem[]>('/batches');
      setBatches(data);
    } catch (err: any) {
      console.error('Failed to fetch assigned batches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleOpenBatchDetails = async (b: BatchItem) => {
    setIsModalOpen(true);
    setDetailsLoading(true);
    try {
      const details = await apiClient<BatchItem>(`/batches/${b.id}`);
      setSelectedBatch(details);
    } catch (err: any) {
      toast.error(`Error loading batch details: ${err.message}`);
      setIsModalOpen(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleOpenEnrollModal = (batchIdToPreselect?: string) => {
    setStudentName('');
    setParentName('');
    setParentWhatsapp('');
    setStudentMobile('');
    setCourse('');
    setMonthlyFee(0);
    setSelectedBatchId(batchIdToPreselect || (batches.length > 0 ? batches[0].id : ''));
    setAdmissionDate(new Date().toISOString().split('T')[0]);
    setBackfillPastFees(false);
    setPastFeesStatus('PAID');
    setEnrollError('');
    setIsAddStudentModalOpen(true);
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollSubmitting(true);
    setEnrollError('');

    if (!studentName.trim()) {
      setEnrollError('Student full name is required.');
      setEnrollSubmitting(false);
      return;
    }

    if (!parentName.trim()) {
      setEnrollError('Parent/Guardian name is required.');
      setEnrollSubmitting(false);
      return;
    }

    const pCheck = validatePhoneNumber(parentWhatsapp, true);
    if (!pCheck.valid) {
      setEnrollError(pCheck.error || 'Please enter a valid 10-digit Parent WhatsApp number.');
      setEnrollSubmitting(false);
      return;
    }

    let normalizedStudentMobile: string | undefined = undefined;
    if (studentMobile && studentMobile.trim()) {
      const sCheck = validatePhoneNumber(studentMobile, false);
      if (!sCheck.valid) {
        setEnrollError(sCheck.error || 'Invalid student mobile number format.');
        setEnrollSubmitting(false);
        return;
      }
      normalizedStudentMobile = sCheck.normalized;
    }

    try {
      await apiClient('/students', {
        method: 'POST',
        body: JSON.stringify({
          name: studentName.trim(),
          parentName: parentName.trim(),
          parentWhatsapp: pCheck.normalized,
          studentMobile: normalizedStudentMobile,
          batchId: selectedBatchId || undefined,
          status: 'ACTIVE',
          course: course.trim() || undefined,
          monthlyFee: Number(monthlyFee) || 0,
          feeDueDay: 5,
          admissionDate: admissionDate || undefined,
          backfillPastFees: isPastAdmission && backfillPastFees,
          pastFeesStatus: pastFeesStatus,
        }),
      });

      toast.success(`Athlete "${studentName.trim()}" successfully enrolled!`);
      setIsAddStudentModalOpen(false);

      // Refresh squad data & current modal if open
      await fetchBatches();
      if (selectedBatch && selectedBatch.id) {
        const updated = await apiClient<BatchItem>(`/batches/${selectedBatch.id}`);
        setSelectedBatch(updated);
      }
    } catch (err: any) {
      setEnrollError(err.message || 'Failed to enroll student');
    } finally {
      setEnrollSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20">
              Faculty Command
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1">My Allocated Batches</h1>
          <p className="text-sm text-slate-400 mt-1">
            Training squads, field timing, and roster management for active academy batches.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleOpenEnrollModal()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg text-sm font-semibold shadow-md shadow-orange-500/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Enroll Athlete</span>
          </button>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 bg-[#1E293B] border border-white/10 px-3.5 py-2 rounded-xl self-start shadow-sm">
            <Layers className="w-4 h-4 text-orange-400" />
            <span>{batches.length} Active {batches.length === 1 ? 'Squad' : 'Squads'}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <SkeletonLoader variant="cards" />
      ) : batches.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No batches assigned"
          description="You are currently not allocated to any batches. Please consult your academy administrator."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {batches.map((b) => (
            <div
              key={b.id}
              className="bg-[#1E293B] border border-white/10 rounded-xl p-5 flex flex-col justify-between hover:border-orange-500/40 transition-all shadow-md group"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-white text-base group-hover:text-orange-400 transition-colors">{b.name}</h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20 mt-1">
                      {b.subject || 'All-Round Athletics'}
                    </span>
                  </div>
                  <StatusBadge status={b.status} />
                </div>

                <div className="mt-4 space-y-2 text-xs text-slate-300 bg-[#0F172A]/70 p-3.5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                    <span className="font-medium">
                      {b.scheduleDays && b.scheduleDays.length > 0
                        ? b.scheduleDays.join(', ')
                        : 'Monday - Saturday'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                    <span>{b.startTime && b.endTime ? `${b.startTime} - ${b.endTime}` : '06:00 AM - 08:00 AM'}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1.5 border-t border-white/10">
                    <Users className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <span className="font-bold text-white">{b.studentCount || 0} Registered Athletes</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenBatchDetails(b)}
                  className="flex-1 inline-flex items-center justify-center px-3 py-2 text-xs font-semibold rounded-lg bg-[#273549] hover:bg-[#334155] border border-white/10 text-white transition-colors cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                  Roster List
                </button>
                <Link to="/teacher/attendance" className="flex-1">
                  <button
                    type="button"
                    className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-semibold rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white shadow-sm transition-colors cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                    Roll Call
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Batch Students Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Enrolled Students — ${selectedBatch?.name || ''}`}
        maxWidth="lg"
      >
        {detailsLoading ? (
          <SkeletonLoader variant="table" rows={4} />
        ) : !selectedBatch?.enrolledStudents || selectedBatch.enrolledStudents.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No students enrolled</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">This batch currently has zero active enrollments.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
              <span>Roster Count: <strong className="text-slate-800 dark:text-slate-200">{selectedBatch.enrolledStudents.length}</strong> students</span>
              <button
                type="button"
                onClick={() => handleOpenEnrollModal(selectedBatch.id)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Athlete to Squad</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Joined Date</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {selectedBatch.enrolledStudents.map((s, idx) => (
                    <tr key={s.studentId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs text-white ${
                            idx % 4 === 0 ? 'bg-indigo-600' :
                            idx % 4 === 1 ? 'bg-purple-600' :
                            idx % 4 === 2 ? 'bg-emerald-600' : 'bg-amber-600'
                          }`}>
                            {s.name?.charAt(0) || 'S'}
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {s.studentMobile || s.parentWhatsapp ? (
                          <span className="inline-flex items-center gap-1 font-mono text-slate-600 dark:text-slate-400">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {s.studentMobile || s.parentWhatsapp}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{s.joinedAt || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <StatusBadge status={(s.enrollmentStatus as any) || 'ACTIVE'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Enroll Student (Faculty Command) */}
      <Modal
        isOpen={isAddStudentModalOpen}
        onClose={() => setIsAddStudentModalOpen(false)}
        title="Enroll Athlete (Squad Roster)"
        maxWidth="md"
      >
        <form onSubmit={handleEnrollStudent} className="space-y-4">
          {enrollError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{enrollError}</span>
            </div>
          )}

          <div className="space-y-3.5">
            <Input
              label="Student Full Name *"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              required
              placeholder="e.g. Rahul Sharma"
            />

            <Input
              label="Parent / Guardian Name *"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              required
              placeholder="e.g. Rajesh Sharma"
            />

            <div>
              <Input
                label="Parent WhatsApp Number * (Primary contact)"
                value={parentWhatsapp}
                onChange={(e) => setParentWhatsapp(e.target.value)}
                required
                placeholder="e.g. 9404849500"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Dispatches attendance notifications and fee updates to this WhatsApp number.
              </p>
            </div>

            <Input
              label="Student Mobile Number (Optional)"
              value={studentMobile}
              onChange={(e) => setStudentMobile(e.target.value)}
              placeholder="e.g. 9876543211 (Only if athlete has personal phone)"
            />

            {/* Admission / Joining Date */}
            <div className="space-y-1.5">
              <Input
                label="Admission / Joining Date *"
                type="date"
                required
                value={admissionDate}
                onChange={(e) => setAdmissionDate(e.target.value)}
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                For older/existing athletes, pick their original enrollment date (e.g. Jan 2026).
              </p>
            </div>

            {/* Smart Backfill Options if Historical Date is Selected */}
            {isPastAdmission && (
              <div className="p-3.5 bg-amber-500/10 dark:bg-amber-950/30 rounded-xl border border-amber-500/30 space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                    Past Admission Detected ({admissionDate})
                  </span>
                </div>
                <label className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backfillPastFees}
                    onChange={(e) => setBackfillPastFees(e.target.checked)}
                    className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                  />
                  <span>
                    Generate historical monthly fee records from joining month ({admissionDate.slice(0, 7)}) up to current month.
                  </span>
                </label>

                {backfillPastFees && (
                  <div className="pt-2 border-t border-amber-500/20">
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Status for previous months:
                    </label>
                    <Select
                      value={pastFeesStatus}
                      onChange={(e) => setPastFeesStatus(e.target.value as any)}
                      className="text-xs h-8 bg-white dark:bg-slate-900 border-amber-400/40"
                    >
                      <option value="PAID">All Past Months Already PAID (Clean history, zero dues)</option>
                      <option value="PENDING">Past Months PENDING (Mark as Overdue / Unpaid dues)</option>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <Select
              label="Assigned Squad / Batch *"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              required
            >
              <option value="">-- Select Allocated Squad --</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.subject ? `(${b.subject})` : ''}
                </option>
              ))}
            </Select>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Course / Discipline"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="e.g. Kalarippayattu"
              />
              <Input
                label="Monthly Fee (₹)"
                type="number"
                min="0"
                step="1"
                value={monthlyFee === 0 ? '' : monthlyFee}
                onChange={(e) => setMonthlyFee(Number(e.target.value))}
                placeholder="e.g. 700"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsAddStudentModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={enrollSubmitting} className="bg-[#F97316] hover:bg-[#EA580C] text-white">
              {enrollSubmitting ? 'Enrolling...' : 'Enroll Athlete'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TeacherBatchesPage;
