import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { apiClient } from '../../lib/api';
import { BatchItem } from '../../types/crm';
import { Layers, Users, Calendar, Clock, CheckSquare, Phone } from 'lucide-react';
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
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 bg-[#1E293B] border border-white/10 px-3.5 py-2 rounded-xl self-start shadow-sm">
          <Layers className="w-4 h-4 text-orange-400" />
          <span>{batches.length} Active {batches.length === 1 ? 'Squad' : 'Squads'}</span>
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
              <span className="text-indigo-600 dark:text-indigo-400 font-medium">{selectedBatch.subject || 'All subjects'}</span>
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
    </div>
  );
};

export default TeacherBatchesPage;
