import React, { useEffect, useState } from 'react';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { apiClient } from '../../lib/api';
import { BatchItem } from '../../types/crm';
import { AttendanceSheetResponse, AttendanceSheetStudentRow } from '../../types/attendance';
import { UserCheck, Users, Save, Check, X, CheckCircle2, XCircle, AlertCircle, MessageSquare } from 'lucide-react';

export const MarkAttendancePage: React.FC = () => {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const [loadingBatches, setLoadingBatches] = useState(true);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetData, setSheetData] = useState<AttendanceSheetResponse | null>(null);
  const [studentRows, setStudentRows] = useState<AttendanceSheetStudentRow[]>([]);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [saveErrorMsg, setSaveErrorMsg] = useState('');

  // Load teacher's assigned batches
  useEffect(() => {
    const fetchAssignedBatches = async () => {
      try {
        setLoadingBatches(true);
        const data = await apiClient<BatchItem[]>('/batches');
        setBatches(data);
        if (data.length > 0) {
          setSelectedBatchId(data[0].id);
        }
      } catch (err) {
        console.error('Failed to load assigned batches:', err);
      } finally {
        setLoadingBatches(false);
      }
    };
    fetchAssignedBatches();
  }, []);

  // Fetch sheet when batch or date changes
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
    if (selectedBatchId && selectedDate) {
      fetchSheet(selectedBatchId, selectedDate);
    }
  }, [selectedBatchId, selectedDate]);

  const handleSetStudentStatus = (studentId: string, status: 'PRESENT' | 'ABSENT') => {
    setStudentRows((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, status } : s))
    );
  };

  const handleMarkAll = (status: 'PRESENT' | 'ABSENT') => {
    setStudentRows((prev) => prev.map((s) => ({ ...s, status })));
  };

  const handleSaveAttendance = async () => {
    if (!selectedBatchId || studentRows.length === 0) return;

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
        `Roll call saved for ${recordsToSubmit.length} athletes! ${
          absentCount > 0
            ? `⚡ Automatic WhatsApp absent alert sent to ${absentCount} parent(s).`
            : 'All athletes marked present.'
        }`
      );
      fetchSheet(selectedBatchId, selectedDate);
    } catch (err: any) {
      setSaveErrorMsg(err.message || 'Failed to record roll call.');
    } finally {
      setSavingAttendance(false);
    }
  };

  if (loadingBatches) {
    return <SkeletonLoader variant="table" rows={4} />;
  }

  if (batches.length === 0) {
    return (
      <EmptyState
        icon={UserCheck}
        title="No batches allocated"
        description="You are currently not assigned to any batches to take attendance. Contact your academy administrator."
        accentColor="indigo"
      />
    );
  }

  const presentCount = studentRows.filter((s) => s.status === 'PRESENT').length;
  const absentCount = studentRows.filter((s) => s.status === 'ABSENT').length;
  const totalCount = studentRows.length;
  const attendancePercent = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            On-Field Roll Call &amp; Attendance
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Select training cohort, verify roster presence, and log biometric session counts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold shadow-xs">
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>WhatsApp Connected</span>
          </div>
        </div>
      </div>

      {/* Select Batch & Date Controls */}
      <div className="p-5 bg-[#1E293B] border border-white/10 rounded-xl shadow-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Assigned Batch *
            </label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full h-10 px-3 bg-[#0F172A] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#F97316]"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.subject || 'Athletics'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Session Date *
            </label>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full h-10 px-3 bg-[#0F172A] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#F97316]"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleMarkAll('PRESENT')}
              className="flex-1 h-10 px-3 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>All Present</span>
            </button>
            <button
              type="button"
              onClick={() => handleMarkAll('ABSENT')}
              className="flex-1 h-10 px-3 rounded-lg text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>All Absent</span>
            </button>
          </div>

          <div>
            <button
              type="button"
              onClick={handleSaveAttendance}
              disabled={savingAttendance || studentRows.length === 0}
              className="w-full h-10 px-4 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold shadow-md shadow-orange-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{savingAttendance ? 'Submitting...' : 'Save Roll Call'}</span>
            </button>
          </div>
        </div>

        {/* Live Attendance Summary */}
        {totalCount > 0 && !sheetLoading && (
          <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {presentCount} Present
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-rose-500/15 text-rose-400 font-bold border border-rose-500/30">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                {absentCount} Absent
              </span>
              <span className="text-slate-400 font-medium">
                Cohort: {totalCount} Athletes
              </span>
            </div>

            <div className="w-full sm:w-64 flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-[#0F172A] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-[#F97316] transition-all duration-300"
                  style={{ width: `${attendancePercent}%` }}
                />
              </div>
              <span className="text-xs font-bold text-white min-w-[36px] text-right">
                {attendancePercent}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Feedback Messages */}
      {saveSuccessMsg && (
        <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}
      {saveErrorMsg && (
        <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-xl flex items-center gap-2">
          <X className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{saveErrorMsg}</span>
        </div>
      )}

      {/* Student List */}
      {sheetLoading ? (
        <SkeletonLoader variant="table" rows={5} />
      ) : studentRows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No athletes enrolled"
          description="There are currently no active athletes enrolled in this batch."
          accentColor="indigo"
        />
      ) : (
        <div className="bg-[#1E293B] border border-white/10 rounded-xl overflow-hidden shadow-lg">
          <div className="px-6 py-3.5 bg-[#273549] border-b border-white/10 flex items-center justify-between text-xs">
            <span className="font-bold text-white text-sm">
              {sheetData?.batch.name} • {studentRows.length} Enrolled Athletes
            </span>
            <span className="px-2.5 py-1 rounded bg-[#0F172A] border border-white/10 font-semibold text-slate-300">
              Session: <span className="text-[#F97316] font-mono">{selectedDate}</span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Athlete Name</th>
                  <th>Contact Details</th>
                  <th>Roll Call Status</th>
                  <th className="text-right">Check-in Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {studentRows.map((s, idx) => (
                  <tr key={s.studentId}>
                    <td className="text-xs text-slate-400 font-mono">{idx + 1}</td>
                    <td>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-xs">{s.name}</span>
                        {s.feeOverdue?.isOverdue && (
                          <span
                            title={`Fees unpaid for ${s.feeOverdue.daysOverdue} days (Pending: ₹${s.feeOverdue.pendingAmount})`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 whitespace-nowrap"
                          >
                            <AlertCircle className="w-3 h-3 text-amber-400" />
                            <span>Fees Due ({s.feeOverdue.daysOverdue}d)</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-xs text-slate-400">
                      {s.studentMobile || s.parentWhatsapp || <span className="text-slate-500 italic">No contact</span>}
                    </td>
                    <td>
                      {s.status === 'UNMARKED' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#273549] text-slate-400">
                          Unmarked
                        </span>
                      ) : (
                        <StatusBadge status={s.status} />
                      )}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex rounded-lg p-1 bg-[#0F172A] border border-white/10 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSetStudentStatus(s.studentId, 'PRESENT')}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                            s.status === 'PRESENT'
                              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/40'
                              : 'text-slate-400 hover:text-emerald-400 hover:bg-white/5'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Present</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetStudentStatus(s.studentId, 'ABSENT')}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                            s.status === 'ABSENT'
                              ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/40'
                              : 'text-slate-400 hover:text-rose-400 hover:bg-white/5'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Absent</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
