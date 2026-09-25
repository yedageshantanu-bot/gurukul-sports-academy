import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { ReceiptModal } from '../../components/common/ReceiptModal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { apiClient, getApiUrl } from '../../lib/api';
import {
  Download,
  Filter,
  CheckSquare,
  CreditCard,
  Receipt as ReceiptIcon,
  RefreshCw,
  BarChart3,
  TrendingUp,
  Activity,
  Calendar,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import {
  AttendanceReportSummary,
  FeesReportSummary,
  PaymentsReportSummary,
} from '../../types/report';

export const ReportsPage: React.FC = () => {
  const { token } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'attendance' | 'fees' | 'payments'>('attendance');

  // Filters state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);

  // Data state
  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [attendanceReport, setAttendanceReport] = useState<AttendanceReportSummary | null>(null);
  const [feesReport, setFeesReport] = useState<FeesReportSummary | null>(null);
  const [paymentsReport, setPaymentsReport] = useState<PaymentsReportSummary | null>(null);
  const [viewReceiptId, setViewReceiptId] = useState<string | null>(null);

  // Interactive chart hover states
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);

  // Fetch batches for dropdown
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const data = await apiClient<any>('/batches');
        setBatches(data.batches || data || []);
      } catch (err) {
        console.error('Failed to load batches:', err);
      }
    };
    if (token) {
      fetchBatches();
    }
  }, [token]);

  // Fetch report data on filter or tab change
  const fetchReport = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (selectedBatchId) params.set('batchId', selectedBatchId);
      if (selectedStatus) params.set('status', selectedStatus);

      const endpoint = `/reports/${activeTab}?${params.toString()}`;
      const data = await apiClient<any>(endpoint);

      if (activeTab === 'attendance') {
        setAttendanceReport(data);
      } else if (activeTab === 'fees') {
        setFeesReport(data);
      } else if (activeTab === 'payments') {
        setPaymentsReport(data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [token, activeTab, selectedBatchId, selectedStatus, startDate, endDate]);

  // Calculate daily attendance trend from loaded records
  const dailyAttendanceTrend = useMemo(() => {
    if (!attendanceReport?.records) return [];

    const dateMap = new Map<string, { date: string; present: number; absent: number; total: number }>();
    
    // Group attendance records by date
    attendanceReport.records.forEach((r: any) => {
      const d = r.attendance_date || r.date || 'Unknown';
      if (!dateMap.has(d)) {
        dateMap.set(d, { date: d, present: 0, absent: 0, total: 0 });
      }
      const entry = dateMap.get(d)!;
      entry.total++;
      if (r.status === 'PRESENT') entry.present++;
      if (r.status === 'ABSENT') entry.absent++;
    });

    // Sort chronologically ascending
    const sorted = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    return sorted.map((s) => ({
      ...s,
      percentage: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
      label: new Date(s.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }),
    }));
  }, [attendanceReport]);

  // Handle CSV Export
  const handleExportCsv = async () => {
    if (!token) return;
    try {
      setExporting(true);

      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (selectedBatchId) params.set('batchId', selectedBatchId);
      if (selectedStatus) params.set('status', selectedStatus);

      const endpoint = getApiUrl(`/reports/${activeTab}/export?${params.toString()}`);
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('CSV Export failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gurukul-${activeTab}-report-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Report exported to CSV successfully!');
    } catch (err: any) {
      toast.error(`Export error: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20">
              Intelligence & Performance
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2 mt-1">
            Analytics & Reports Center
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Real athlete summaries, attendance trends, verified fee reconciliations, and instant CSV exports.
          </p>
        </div>

        <Button
          onClick={handleExportCsv}
          disabled={exporting}
          className="gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold shadow-lg shadow-orange-500/20 border-0 self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>{exporting ? 'Exporting...' : `Export ${activeTab.toUpperCase()} CSV`}</span>
        </Button>
      </div>

      {/* Tabs with Gurukul Brand Orange Pill Style */}
      <div className="inline-flex rounded-xl bg-[#0F172A] p-1.5 border border-white/10 shadow-lg">
        <button
          onClick={() => {
            setActiveTab('attendance');
            setSelectedStatus('');
          }}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'attendance'
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          Attendance Metrics
        </button>

        <button
          onClick={() => {
            setActiveTab('fees');
            setSelectedStatus('');
          }}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'fees'
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          Fees Receivables
        </button>

        <button
          onClick={() => {
            setActiveTab('payments');
            setSelectedStatus('');
          }}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'payments'
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <ReceiptIcon className="w-3.5 h-3.5" />
          Payment Transactions
        </button>
      </div>

      {/* Filter Bar with Orange Accents */}
      <Card className="p-4 bg-[#1E293B] border-white/10 shadow-md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-orange-400 text-xs font-bold uppercase tracking-wider mr-2">
            <Filter className="w-4 h-4" />
            Filters
          </div>

          {/* Batch Selector */}
          <div className="w-48">
            <Select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="text-xs h-10 bg-[#0F172A] border-white/10 text-white focus:border-orange-500"
            >
              <option value="">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Status Filter */}
          {activeTab === 'fees' && (
            <div className="w-40">
              <Select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-xs h-10 bg-[#0F172A] border-white/10 text-white focus:border-orange-500"
              >
                <option value="">All Statuses</option>
                <option value="PAID">PAID</option>
                <option value="PENDING">PENDING</option>
                <option value="OVERDUE">OVERDUE</option>
                <option value="PARTIAL">PARTIAL</option>
              </Select>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="w-40">
              <Select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-xs h-10 bg-[#0F172A] border-white/10 text-white focus:border-orange-500"
              >
                <option value="">All Statuses</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="FAILED">FAILED</option>
                <option value="PENDING">PENDING</option>
              </Select>
            </div>
          )}

          {/* Start Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-400">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs px-3 py-2 border border-white/10 rounded-xl focus:outline-none focus:border-orange-500 font-medium h-10 shadow-sm bg-[#0F172A] text-white"
            />
          </div>

          {/* End Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-400">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs px-3 py-2 border border-white/10 rounded-xl focus:outline-none focus:border-orange-500 font-medium h-10 shadow-sm bg-[#0F172A] text-white"
            />
          </div>

          {(selectedBatchId || startDate || endDate || selectedStatus) && (
            <button
              onClick={() => {
                setSelectedBatchId('');
                setStartDate('');
                setEndDate('');
                setSelectedStatus('');
              }}
              className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 font-semibold ml-auto cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Reset Filters
            </button>
          )}
        </div>
      </Card>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-sm flex items-center justify-between shadow-sm">
          <span>{error}</span>
          <button onClick={() => fetchReport()} className="text-xs font-bold underline cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          <SkeletonLoader variant="table" rows={6} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: ATTENDANCE */}
      {/* ========================================================================= */}
      {!loading && activeTab === 'attendance' && attendanceReport && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <Card hoverEffect accent="orange" className="p-5 bg-[#1E293B] border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Overall Rate</span>
                <Activity className="w-4 h-4 text-orange-400" />
              </div>
              <div className="text-3xl font-extrabold text-white mt-1">
                {attendanceReport.attendancePercentage}%
              </div>
              <p className="text-xs text-slate-400 mt-1">Ratio of present to marked entries</p>
            </Card>

            <Card hoverEffect accent="cyan" className="p-5 bg-[#1E293B] border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Roll Calls</span>
                <Calendar className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-3xl font-extrabold text-cyan-400 mt-1">
                {attendanceReport.totalRecords}
              </div>
              <p className="text-xs text-slate-400 mt-1">Recorded student entries</p>
            </Card>

            <Card hoverEffect accent="emerald" className="p-5 bg-[#1E293B] border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Present</span>
                <CheckSquare className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-3xl font-extrabold text-emerald-400 mt-1">
                {attendanceReport.presentCount}
              </div>
              <p className="text-xs text-slate-400 mt-1">Confirmed athlete presences</p>
            </Card>

            <Card hoverEffect accent="rose" className="p-5 bg-[#1E293B] border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Absent</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-3xl font-extrabold text-rose-400 mt-1">
                {attendanceReport.absentCount}
              </div>
              <p className="text-xs text-slate-400 mt-1">Recorded athlete absences</p>
            </Card>
          </div>

          {/* Interactive Attendance Trend Chart */}
          {dailyAttendanceTrend.length > 0 && (
            <Card className="p-6 bg-[#1E293B] border-white/10 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-orange-400" />
                    Daily Attendance Velocity Graph
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Interactive day-by-day turnout trend across all martial arts & sports sessions.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-gradient-to-t from-orange-600 to-amber-400" />
                    <span>Turnout %</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span>Present Count</span>
                  </div>
                </div>
              </div>

              {/* Interactive Bar Visualization */}
              <div className="pt-4 pb-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                  {dailyAttendanceTrend.map((day, idx) => {
                    const isHovered = hoveredTrendIndex === idx;
                    return (
                      <div
                        key={day.date}
                        onMouseEnter={() => setHoveredTrendIndex(idx)}
                        onMouseLeave={() => setHoveredTrendIndex(null)}
                        className={`group p-3 rounded-xl border transition-all cursor-pointer ${
                          isHovered
                            ? 'bg-[#0F172A] border-orange-500/60 shadow-lg shadow-orange-500/20 scale-[1.03]'
                            : 'bg-[#0F172A]/70 border-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="flex justify-between items-center text-[11px] text-slate-400 mb-2">
                          <span className="font-semibold text-white">{day.label}</span>
                          <span className="font-mono text-orange-400 font-bold">{day.percentage}%</span>
                        </div>

                        {/* Visual Bar Indicator */}
                        <div className="w-full bg-slate-800 h-24 rounded-lg flex flex-col justify-end p-1 overflow-hidden relative">
                          <div
                            style={{ height: `${Math.max(12, day.percentage)}%` }}
                            className={`w-full rounded-md transition-all duration-300 ${
                              isHovered
                                ? 'bg-gradient-to-t from-orange-600 to-amber-300'
                                : 'bg-gradient-to-t from-orange-500 to-amber-500'
                            }`}
                          />
                        </div>

                        {/* Counts Detail */}
                        <div className="flex justify-between text-[11px] font-mono mt-2 text-slate-400">
                          <span className="text-emerald-400 font-bold">✓ {day.present}</span>
                          <span className="text-rose-400 font-bold">✗ {day.absent}</span>
                          <span>Tot {day.total}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}

          {/* Batch Performance Breakdown */}
          {(attendanceReport.batchBreakdown || []).length > 0 && (
            <Card className="p-6 bg-[#1E293B] border-white/10 shadow-xl">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-orange-400" />
                Batch Turnout Breakdown
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {(attendanceReport.batchBreakdown || []).map((b) => (
                  <div key={b.batchId} className="p-4 bg-[#0F172A] rounded-xl border border-white/10 hover:border-orange-500/40 transition-all">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white text-sm truncate">{b.batchName}</span>
                      <span className="text-xs font-extrabold text-orange-400 font-mono">{b.attendancePercentage}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2.5 rounded-full mt-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-orange-500 to-amber-400 h-full rounded-full transition-all"
                        style={{ width: `${b.attendancePercentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 mt-2.5 font-medium">
                      <span className="text-emerald-400">Present: {b.presentCount}</span>
                      <span className="text-rose-400">Absent: {b.absentCount}</span>
                      <span>Total: {b.totalRecords}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Attendance Records Table */}
          <Card className="bg-[#1E293B] border-white/10 overflow-hidden shadow-xl">
            <div className="px-6 py-4 bg-[#0F172A] border-b border-white/10 flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">Attendance Register Log</h3>
              <span className="text-xs text-orange-400 font-bold">{(attendanceReport.records || []).length} athlete records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#0F172A]/60 border-b border-white/10 text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Student Athlete</th>
                    <th className="px-5 py-3.5">Batch / Discipline</th>
                    <th className="px-5 py-3.5">Subject</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                    <th className="px-6 py-3.5 text-right">Guardian WhatsApp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(attendanceReport.records || []).map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-slate-300">{r.attendance_date || r.date}</td>
                      <td className="px-5 py-4 font-bold text-white">{r.student?.name}</td>
                      <td className="px-5 py-4 text-slate-300 font-medium">{r.batch?.name}</td>
                      <td className="px-5 py-4 text-slate-400 text-xs">{r.batch?.subject || '—'}</td>
                      <td className="px-5 py-4 text-center">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs text-orange-400">
                        {r.student?.parent_whatsapp || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: FEES */}
      {/* ========================================================================= */}
      {!loading && activeTab === 'fees' && feesReport && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <Card hoverEffect accent="orange" className="p-5 bg-[#1E293B] border-white/10">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Scheduled Fees</div>
              <div className="text-3xl font-extrabold text-white mt-1">
                ₹{feesReport.totalBilled.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-slate-400 mt-1">Total scheduled academy fees</p>
            </Card>

            <Card hoverEffect accent="emerald" className="p-5 bg-[#1E293B] border-white/10">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Collected</div>
              <div className="text-3xl font-extrabold text-emerald-400 mt-1">
                ₹{feesReport.totalCollected.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-emerald-400 font-semibold mt-1">Actual revenue received</p>
            </Card>

            <Card hoverEffect accent="amber" className="p-5 bg-[#1E293B] border-white/10">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Pending Dues</div>
              <div className="text-3xl font-extrabold text-amber-400 mt-1">
                ₹{feesReport.totalPending.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-slate-400 mt-1">Awaiting due payment</p>
            </Card>

            <Card hoverEffect accent="rose" className="p-5 bg-[#1E293B] border-white/10">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Overdue Fees</div>
              <div className="text-3xl font-extrabold text-rose-400 mt-1">
                ₹{feesReport.totalOverdue.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-rose-400 font-medium mt-1">Past scheduled due dates</p>
            </Card>
          </div>

          {/* Interactive Revenue Collection Progress Meter */}
          <Card className="p-6 bg-[#1E293B] border-white/10 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-orange-400" />
                  Collection Realization Meter
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Proportion of received revenue vs active pipeline dues.
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                  {feesReport.totalBilled > 0
                    ? Math.round((feesReport.totalCollected / feesReport.totalBilled) * 100)
                    : 0}
                  %
                </span>
                <span className="text-xs text-slate-400 block">Realized Ratio</span>
              </div>
            </div>

            {/* Split Progress Bar */}
            <div className="w-full bg-slate-800 h-4 rounded-full overflow-hidden flex">
              <div
                style={{
                  width: `${feesReport.totalBilled > 0 ? (feesReport.totalCollected / feesReport.totalBilled) * 100 : 0}%`,
                }}
                className="bg-emerald-500 h-full transition-all"
                title={`Collected: ₹${feesReport.totalCollected}`}
              />
              <div
                style={{
                  width: `${feesReport.totalBilled > 0 ? (feesReport.totalPending / feesReport.totalBilled) * 100 : 0}%`,
                }}
                className="bg-amber-500 h-full transition-all"
                title={`Pending: ₹${feesReport.totalPending}`}
              />
              <div
                style={{
                  width: `${feesReport.totalBilled > 0 ? (feesReport.totalOverdue / feesReport.totalBilled) * 100 : 0}%`,
                }}
                className="bg-rose-500 h-full transition-all"
                title={`Overdue: ₹${feesReport.totalOverdue}`}
              />
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-between gap-4 mt-4 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-slate-300">Collected: ₹{feesReport.totalCollected.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-slate-300">Pending: ₹{feesReport.totalPending.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="text-slate-300">Overdue: ₹{feesReport.totalOverdue.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </Card>

          {/* Fees Records Table */}
          <Card className="bg-[#1E293B] border-white/10 overflow-hidden shadow-xl">
            <div className="px-6 py-4 bg-[#0F172A] border-b border-white/10 flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">Student Fees Ledger</h3>
              <span className="text-xs text-orange-400 font-bold">{(feesReport.records || []).length} athlete records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#0F172A]/60 border-b border-white/10 text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Athlete</th>
                    <th className="px-5 py-3.5">Discipline</th>
                    <th className="px-5 py-3.5">Billing Period</th>
                    <th className="px-5 py-3.5">Fee Plan</th>
                    <th className="px-5 py-3.5 text-right">Amount Due</th>
                    <th className="px-5 py-3.5 text-right">Amount Paid</th>
                    <th className="px-5 py-3.5 text-center">Due Date</th>
                    <th className="px-6 py-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(feesReport.records || []).map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-bold text-white">{r.student?.name}</td>
                      <td className="px-5 py-4 text-slate-300">{r.student?.course || 'General'}</td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-400">{r.billing_period}</td>
                      <td className="px-5 py-4 text-slate-400 text-xs">{r.fee_plan?.name}</td>
                      <td className="px-5 py-4 text-right font-bold text-white">
                        ₹{Number(r.amount_due).toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-emerald-400">
                        ₹{Number(r.amount_paid).toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-4 text-center text-xs font-mono text-slate-400">{r.due_date}</td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PAYMENTS */}
      {/* ========================================================================= */}
      {!loading && activeTab === 'payments' && paymentsReport && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Card hoverEffect accent="emerald" className="p-5 bg-[#1E293B] border-white/10">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Volume Collected</div>
              <div className="text-3xl font-extrabold text-emerald-400 mt-1">
                ₹{paymentsReport.totalVolume.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-slate-400 mt-1">Confirmed successful transactions</p>
            </Card>

            <Card hoverEffect accent="orange" className="p-5 bg-[#1E293B] border-white/10">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Successful Payments</div>
              <div className="text-3xl font-extrabold text-orange-400 mt-1">
                {paymentsReport.successfulCount}
              </div>
              <p className="text-xs text-slate-400 mt-1">Completed transactions</p>
            </Card>

            <Card hoverEffect accent="rose" className="p-5 bg-[#1E293B] border-white/10">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Failed Transactions</div>
              <div className="text-3xl font-extrabold text-rose-400 mt-1">
                {paymentsReport.failedCount}
              </div>
              <p className="text-xs text-slate-400 mt-1">Declined or failed payments</p>
            </Card>
          </div>

          {/* Payments Records Table */}
          <Card className="bg-[#1E293B] border-white/10 overflow-hidden shadow-xl">
            <div className="px-6 py-4 bg-[#0F172A] border-b border-white/10 flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">Settled Transactions Audit</h3>
              <span className="text-xs text-orange-400 font-bold">{(paymentsReport.records || []).length} receipts</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#0F172A]/60 border-b border-white/10 text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Student Athlete</th>
                    <th className="px-5 py-3.5">Mode / Gateway</th>
                    <th className="px-5 py-3.5">Transaction ID</th>
                    <th className="px-5 py-3.5 text-right">Amount</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                    <th className="px-6 py-3.5 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(paymentsReport.records || []).map((r: any) => {
                    const receiptNo = Array.isArray(r.receipt) && r.receipt.length > 0
                      ? r.receipt[0]?.receipt_number
                      : r.receipt?.receipt_number;
                    const receiptId = Array.isArray(r.receipt) && r.receipt.length > 0
                      ? r.receipt[0]?.id
                      : r.receipt?.id;

                    return (
                      <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-slate-400">
                          {new Date(r.paid_at || r.created_at).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-5 py-4 font-bold text-white">{r.student?.name}</td>
                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                            {r.provider}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-slate-400">
                          {r.provider_payment_id || '—'}
                        </td>
                        <td className="px-5 py-4 text-right font-extrabold text-emerald-400">
                          ₹{Number(r.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          {receiptNo ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setViewReceiptId(receiptId || receiptNo)}
                              className="text-xs h-7 gap-1 text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
                            >
                              <ReceiptIcon className="w-3.5 h-3.5 mr-1" />
                              {receiptNo}
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-500 italic">No receipt</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Official Receipt Modal */}
      <ReceiptModal receiptId={viewReceiptId} onClose={() => setViewReceiptId(null)} />
    </div>
  );
};

export default ReportsPage;
