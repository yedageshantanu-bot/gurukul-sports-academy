import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { apiClient } from '../../lib/api';
import { BatchItem } from '../../types/crm';
import { AttendanceRecord, AttendanceSheetResponse, AttendanceSheetStudentRow } from '../../types/attendance';
import { Calendar, Users, Save, Check, X, CheckCircle2, XCircle, RefreshCw, AlertCircle, MessageSquare } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

export const AttendancePage: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'sheet' | 'records'>('sheet');
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Attendance Sheet state
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetData, setSheetData] = useState<AttendanceSheetResponse | null>(null);
  const [studentRows, setStudentRows] = useState<AttendanceSheetStudentRow[]>([]);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [saveErrorMsg, setSaveErrorMsg] = useState('');

  // Attendance Records state
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsDateFilter, setRecordsDateFilter] = useState('');
  const [recordsBatchFilter, setRecordsBatchFilter] = useState('');

  // Load batches for dropdown
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const data = await apiClient<BatchItem[]>('/batches?status=ACTIVE');
        setBatches(data);
        if (data.length > 0 && !selectedBatchId) {
          setSelectedBatchId(data[0].id);
        }
      } catch (err) {
        console.error('Failed to load batches:', err);
      }
    };
    fetchBatches();
  }, []);

  // Fetch sheet when batch or date changes in Sheet view
  const fetchSheet = async (batchId: string, date: string) => {
    if (!batchId || !date) return;
    setSheetLoading(true);
    setSaveSuccessMsg('');
    setSaveErrorMsg('');
    try {
      const data = await apiClient<AttendanceSheetResponse>(
        `/attendance/sheet?batchId=${batchId}&date=${date}`
      );
      setSheetData(data);
      setStudentRows(data.students);
    } catch (err: any) {
      console.error('Failed to load attendance sheet:', err);
      setSaveErrorMsg(err.message || 'Failed to load attendance sheet');
    } finally {
      setSheetLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'sheet' && selectedBatchId && selectedDate) {
      fetchSheet(selectedBatchId, selectedDate);
    }
  }, [selectedBatchId, selectedDate, activeTab]);

  // Fetch records when switching to Records view or changing filters
  const fetchRecords = async () => {
    setRecordsLoading(true);
    try {
      const params = new URLSearchParams();
      if (recordsBatchFilter) params.append('batchId', recordsBatchFilter);
      if (recordsDateFilter) params.append('date', recordsDateFilter);

      const data = await apiClient<AttendanceRecord[]>(`/attendance?${params.toString()}`);
      setRecords(data);
    } catch (err) {
      console.error('Failed to load attendance records:', err);
    } finally {
      setRecordsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'records') {
      fetchRecords();
    }
  }, [activeTab, recordsBatchFilter, recordsDateFilter]);

  // Status toggle handlers
  const handleSetStudentStatus = (studentId: string, status: 'PRESENT' | 'ABSENT') => {
    setStudentRows((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, status } : s))
    );
  };

  const handleMarkAll = (status: 'PRESENT' | 'ABSENT') => {
    setStudentRows((prev) => prev.map((s) => ({ ...s, status })));
  };

  // Save bulk attendance
  const handleSaveAttendance = async () => {
    if (!selectedBatchId || studentRows.length === 0) return;

    const unMarkedCount = studentRows.filter((s) => s.status === 'UNMARKED').length;
    if (unMarkedCount > 0) {
      toast.info(`Marking ${unMarkedCount} unselected students as Absent automatically.`);
    }

    setSavingAttendance(true);
    setSaveSuccessMsg('');
    setSaveErrorMsg('');

    try {
      const recordsToSubmit = studentRows.map((s) => ({
        studentId: s.studentId,
        status: s.status === 'PRESENT' ? 'PRESENT' : 'ABSENT',
      }));

      await apiClient('/attendance/bulk', {
        method: 'POST',
        body: JSON.stringify({
          batchId: selectedBatchId,
          date: selectedDate,
          records: recordsToSubmit,
        }),
      });

      const absentCount = recordsToSubmit.filter((r) => r.status === 'ABSENT').length;
      setSaveSuccessMsg(
        `Attendance recorded successfully for ${recordsToSubmit.length} students! ${
          absentCount > 0
            ? `⚡ Automatic WhatsApp absent alert sent to ${absentCount} parent(s).`
            : 'All students marked present.'
        }`
      );
      fetchSheet(selectedBatchId, selectedDate);
    } catch (err: any) {
      setSaveErrorMsg(err.message || 'Failed to save attendance.');
    } finally {
      setSavingAttendance(false);
    }
  };

  // In-table correction in records tab
  const handleToggleRecordStatus = async (record: AttendanceRecord) => {
    const nextStatus = record.status === 'PRESENT' ? 'ABSENT' : 'PRESENT';
    const isCorrection = record.status === 'ABSENT' && nextStatus === 'PRESENT';
    try {
      await apiClient(`/attendance/${record.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      if (isCorrection) {
        setSaveSuccessMsg(`Attendance corrected: ${record.studentName} marked PRESENT. WhatsApp correction alert dispatched to parent.`);
      } else {
        setSaveSuccessMsg(`Attendance updated: ${record.studentName} marked ${nextStatus}.`);
      }
      fetchRecords();
    } catch (err: any) {
      toast.error(`Error updating attendance: ${err.message}`);
    }
  };

  const presentCount = studentRows.filter((s) => s.status === 'PRESENT').length;
  const absentCount = studentRows.filter((s) => s.status === 'ABSENT').length;
  const totalCount = studentRows.length;
  const attendancePercent = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            Attendance Operations
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Conduct daily roll calls, track student presence, and review historical registers.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold shadow-xs">
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>WhatsApp Connected</span>
          </div>

          {/* Tab Switcher */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-900 p-1 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab('sheet')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'sheet'
                  ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Mark Daily Sheet
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('records')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'records'
                  ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Historical Records
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'sheet' ? (
        /* =========================================================
           TAB 1: MARK ATTENDANCE SHEET
           ========================================================= */
        <div className="space-y-5">
          {/* Controls bar: Select Batch & Date */}
          <Card className="p-5 border-slate-200/80 dark:border-slate-800 shadow-card">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Target Batch *
                </label>
                <Select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="h-10 text-sm font-medium"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.subject || 'General'})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Session Date *
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
                />
              </div>

              {/* Convenience All Present / All Absent buttons */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleMarkAll('PRESENT')}
                  className="flex-1 text-xs text-emerald-700 dark:text-emerald-300 border-emerald-300/80 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/40 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/50 font-semibold h-10"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                  All Present
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleMarkAll('ABSENT')}
                  className="flex-1 text-xs text-rose-700 dark:text-rose-300 border-rose-300/80 dark:border-rose-800/80 bg-rose-50/50 dark:bg-rose-950/40 hover:bg-rose-100/70 dark:hover:bg-rose-900/50 font-semibold h-10"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600 dark:text-rose-400" />
                  All Absent
                </Button>
              </div>

              {/* Submit Save Button */}
              <div>
                <Button
                  type="button"
                  onClick={handleSaveAttendance}
                  disabled={savingAttendance || studentRows.length === 0}
                  className="w-full flex items-center justify-center gap-1.5 h-10 shadow-md font-semibold"
                >
                  <Save className="w-4 h-4" />
                  {savingAttendance ? 'Submitting...' : 'Save Attendance'}
                </Button>
              </div>
            </div>

            {/* Attendance Live Gauge Banner if students exist */}
            {totalCount > 0 && !sheetLoading && (
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200/80 dark:border-emerald-800/80">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {presentCount} Present
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs font-bold border border-rose-200/80 dark:border-rose-800/80">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    {absentCount} Absent
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Total: {totalCount} Students
                  </div>
                </div>

                <div className="w-full sm:w-64 flex items-center gap-2">
                  <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
                      style={{ width: `${attendancePercent}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 min-w-[36px] text-right">
                    {attendancePercent}%
                  </span>
                </div>
              </div>
            )}
          </Card>

          {/* Feedback alerts */}
          {saveSuccessMsg && (
            <div className="p-4 bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-sm rounded-xl flex items-center gap-2.5 shadow-sm animate-in fade-in">
              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span className="font-medium">{saveSuccessMsg}</span>
            </div>
          )}
          {saveErrorMsg && (
            <div className="p-4 bg-rose-50/90 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-sm rounded-xl flex items-center gap-2.5 shadow-sm animate-in fade-in">
              <X className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
              <span className="font-medium">{saveErrorMsg}</span>
            </div>
          )}

          {/* Roster Table */}
          {sheetLoading ? (
            <SkeletonLoader variant="table" rows={6} />
          ) : studentRows.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No students enrolled in this batch"
              description="This batch does not currently have any active enrolled students. Add students to the batch in Batch Management to take attendance."
              accentColor="indigo"
            />
          ) : (
            <Card className="border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-card">
              <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {(sheetData as any)?.batch?.name || batches.find((b) => b.id === selectedBatchId)?.name || 'Class Roster'} • {studentRows.length} Enrolled Roster
                </span>
                <span className="bg-white dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300">
                  Date: <span className="text-indigo-600 dark:text-indigo-400 font-mono">{selectedDate}</span>
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">#</th>
                      <th className="px-6 py-3.5">Student Name</th>
                      <th className="px-5 py-3.5">Contact</th>
                      <th className="px-5 py-3.5">Current Saved</th>
                      <th className="px-6 py-3.5 text-right">Attendance Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {studentRows.map((s, idx) => (
                      <tr key={s.studentId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 text-xs text-slate-400 dark:text-slate-500 font-mono">{idx + 1}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-slate-100">{s.name || (s as any).studentName || 'Student'}</span>
                            {s.feeOverdue?.isOverdue && (
                              <span
                                title={`Fees unpaid for ${s.feeOverdue.daysOverdue} days (Pending: ₹${s.feeOverdue.pendingAmount})`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 shadow-xs"
                              >
                                <AlertCircle className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                                <span>Fees Overdue</span>
                                <span>({s.feeOverdue.daysOverdue}d: ₹{s.feeOverdue.pendingAmount})</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400">
                          {s.parentWhatsapp || s.studentMobile ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-700 dark:text-slate-300">
                                {s.parentWhatsapp || s.studentMobile}
                              </span>
                              <a
                                href={`https://wa.me/${(s.parentWhatsapp || s.studentMobile || '').replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Open WhatsApp Chat with Parent"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 transition-colors text-[10px] font-bold"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>WA</span>
                              </a>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic">No contact</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {s.status === 'UNMARKED' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-transparent dark:border-slate-700">
                              Unmarked
                            </span>
                          ) : (
                            <StatusBadge status={s.status} />
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex flex-col items-end">
                            <div className="inline-flex rounded-xl p-1 bg-slate-100/90 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 gap-1.5 shadow-inner">
                              <button
                                type="button"
                                onClick={() => handleSetStudentStatus(s.studentId, 'PRESENT')}
                                className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  s.status === 'PRESENT'
                                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 scale-105'
                                    : 'text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-white/80 dark:hover:bg-slate-800'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Present</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetStudentStatus(s.studentId, 'ABSENT')}
                                className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  s.status === 'ABSENT'
                                    ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/30 scale-105'
                                    : 'text-slate-600 dark:text-slate-300 hover:text-rose-700 dark:hover:text-rose-400 hover:bg-white/80 dark:hover:bg-slate-800'
                                }`}
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Absent</span>
                              </button>
                            </div>
                            {s.status === 'ABSENT' && (
                              <span className="text-[10px] text-rose-500 dark:text-rose-400 flex items-center gap-1 mt-1 font-semibold">
                                <MessageSquare className="w-2.5 h-2.5" /> Auto-WhatsApp to Parent
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      ) : (
        /* =========================================================
           TAB 2: ATTENDANCE RECORDS & HISTORY
           ========================================================= */
        <div className="space-y-4">
          {/* Filters Bar */}
          <Card className="p-4 border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Filter by Batch
                </label>
                <Select
                  value={recordsBatchFilter}
                  onChange={(e) => setRecordsBatchFilter(e.target.value)}
                  className="h-10 text-xs"
                >
                  <option value="">All Batches</option>
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
                  value={recordsDateFilter}
                  onChange={(e) => setRecordsDateFilter(e.target.value)}
                  className="flex h-10 w-full rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-sm transition-all"
                />
              </div>

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRecordsBatchFilter('');
                    setRecordsDateFilter('');
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
          {recordsLoading ? (
            <SkeletonLoader variant="table" rows={6} />
          ) : records.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No attendance records found"
              description="No attendance has been recorded for the selected filters. Use the Mark Attendance tab to record class attendance."
              accentColor="indigo"
            />
          ) : (
            <Card className="border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Date</th>
                      <th className="px-5 py-3.5">Batch</th>
                      <th className="px-5 py-3.5">Student</th>
                      <th className="px-5 py-3.5">Marked By</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Correct Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {records.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-3.5 font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                          {r.attendanceDate}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                          {r.batchName}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-slate-100 text-xs">
                          {r.studentName}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                          {r.teacherName || 'Academy Admin'}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleRecordStatus(r)}
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
      )}
    </div>
  );
};
