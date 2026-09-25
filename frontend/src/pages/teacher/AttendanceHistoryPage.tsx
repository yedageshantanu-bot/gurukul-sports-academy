import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { apiClient } from '../../lib/api';
import { BatchItem } from '../../types/crm';
import { AttendanceRecord } from '../../types/attendance';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

export const AttendanceHistoryPage: React.FC = () => {
  const { toast } = useToast();
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchFilter, setBatchFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Load teacher's assigned batches for dropdown
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const data = await apiClient<BatchItem[]>('/batches');
        setBatches(data);
      } catch (err) {
        console.error('Failed to load assigned batches:', err);
      }
    };
    fetchBatches();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (batchFilter) params.append('batchId', batchFilter);
      if (dateFilter) params.append('date', dateFilter);

      const data = await apiClient<AttendanceRecord[]>(`/attendance?${params.toString()}`);
      setRecords(data);
    } catch (err) {
      console.error('Failed to load attendance records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [batchFilter, dateFilter]);

  const handleToggleStatus = async (record: AttendanceRecord) => {
    const nextStatus = record.status === 'PRESENT' ? 'ABSENT' : 'PRESENT';
    try {
      await apiClient(`/attendance/${record.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchRecords();
      toast.success(`Attendance updated to ${nextStatus}.`);
    } catch (err: any) {
      toast.error(`Error updating attendance: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="pb-2 border-b border-slate-200/60 dark:border-slate-800">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          Attendance History
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Review and adjust past attendance records for your assigned batches.
        </p>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 border-slate-200/80 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Filter by Batch
            </label>
            <Select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="h-10 text-xs"
            >
              <option value="">All Assigned Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Filter by Date
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="flex h-10 w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
            />
          </div>

          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setBatchFilter('');
                setDateFilter('');
              }}
              className="w-full text-xs h-10"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Reset Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Records Table */}
      {loading ? (
        <SkeletonLoader variant="table" rows={5} />
      ) : records.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No records found"
          description="There are no attendance records matching your filter criteria."
          accentColor="indigo"
        />
      ) : (
        <Card className="border-slate-200/80 dark:border-slate-800 dark:bg-slate-900 overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Batch</th>
                  <th className="px-5 py-3.5">Student Name</th>
                  <th className="px-5 py-3.5">Contact</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Correct</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-3.5 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {r.attendanceDate}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                      {r.batchName}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-slate-100 text-xs">
                      {r.studentName}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                      {r.studentMobile || <span className="text-slate-400 dark:text-slate-500 italic">No phone</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleStatus(r)}
                        className="text-xs h-8 px-3"
                      >
                        Mark {r.status === 'PRESENT' ? 'Absent' : 'Present'}
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
  );
};
