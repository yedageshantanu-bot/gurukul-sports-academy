import React, { useEffect, useState } from 'react';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { apiClient } from '../../lib/api';
import {
  AdminKPIs,
  MonthlyFeeSummary,
  FeeFollowupItem,
  RecentActivityItem,
} from '../../types/crm';
import {
  Users,
  Layers,
  CreditCard,
  Plus,
  ArrowRight,
  CheckSquare,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  BookOpen,
  Megaphone,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activePeriod, setActivePeriod] = useState<'today' | 'week' | 'month'>('month');
  const [kpis, setKpis] = useState<AdminKPIs | null>(null);
  const [attendanceData, setAttendanceData] = useState<{
    todayPresent: number;
    todayTotal: number;
    todayRate: number;
    weeklyTrend: Array<{
      day: string;
      present: number;
      absent: number;
      late?: number;
      date?: string;
      presentCount?: number;
      absentCount?: number;
      totalCount?: number;
    }>;
  } | null>(null);
  const [currentMonth, setCurrentMonth] = useState<{ billingPeriod: string; formatted: string }>({
    billingPeriod: '',
    formatted: '',
  });
  const [monthlyFeeSummary, setMonthlyFeeSummary] = useState<MonthlyFeeSummary | null>(null);
  const [feeFollowups, setFeeFollowups] = useState<FeeFollowupItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);

  // Sending reminder state
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [reminderToast, setReminderToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await apiClient<any>('/dashboard/admin');
      if (res) {
        setKpis(res.kpis || null);
        setAttendanceData(res.attendance || null);
        setCurrentMonth(res.currentMonth || { billingPeriod: '', formatted: '' });
        setMonthlyFeeSummary(res.monthlyFeeSummary || null);
        setFeeFollowups(res.feeFollowups || []);
        setRecentActivity(res.recentActivity || []);
      }
    } catch (err: any) {
      console.error('Failed to load admin dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleSendReminder = async (item: FeeFollowupItem) => {
    if (!item.parentWhatsapp) {
      setReminderToast({
        message: 'No parent phone number on file for WhatsApp reminder.',
        type: 'error',
      });
      setTimeout(() => setReminderToast(null), 4000);
      return;
    }

    setSendingReminderId(item.feeId);
    setReminderToast(null);

    try {
      await apiClient('/whatsapp/trigger-fee-reminder', {
        method: 'POST',
        body: JSON.stringify({
          studentFeeId: item.feeId,
          studentId: item.studentId,
          eventType: item.status === 'OVERDUE' ? 'FEE_OVERDUE_ALERT' : 'FEE_DUE_REMINDER',
        }),
      });

      setReminderToast({
        message: `WhatsApp reminder dispatched for ${item.studentName} (${item.parentWhatsapp}).`,
        type: 'success',
      });
      setTimeout(() => setReminderToast(null), 5000);
    } catch (err: any) {
      setReminderToast({
        message: err.message || 'Failed to dispatch WhatsApp reminder.',
        type: 'error',
      });
      setTimeout(() => setReminderToast(null), 6000);
    } finally {
      setSendingReminderId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader variant="table" rows={6} />
      </div>
    );
  }

  const getDaysOverdue = (dueDateStr: string): number => {
    if (!dueDateStr) return 0;
    const due = new Date(dueDateStr).getTime();
    const today = new Date().setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((today - due) / (1000 * 60 * 60 * 24)));
  };

  const totalStudents = kpis?.totalStudents ?? 0;
  const activeTeachers = kpis?.activeTeachers ?? kpis?.totalTeachers ?? 0;
  const activeBatches = kpis?.activeBatches ?? 0;
  const expectedFees = monthlyFeeSummary?.expected ?? (kpis?.feesExpectedThisMonth ?? 0);
  const collectedFees = monthlyFeeSummary?.collected ?? (kpis?.feesCollectedThisMonth ?? 0);
  const pendingFees = monthlyFeeSummary?.pending ?? (kpis?.feesPendingThisMonth ?? 0);
  const overdueFees = (monthlyFeeSummary as any)?.overdue ?? (kpis?.feesOverdueThisMonth ?? 0);
  const collectionRate = expectedFees > 0 ? Math.round((collectedFees / expectedFees) * 100) : 0;

  const todayPresent = attendanceData?.todayPresent ?? kpis?.todayPresent ?? 0;
  const todayTotal = attendanceData?.todayTotal ?? kpis?.todayTotal ?? (totalStudents || 0);
  const todayRate = attendanceData?.todayRate ?? kpis?.todayRate ?? (todayTotal > 0 ? Math.round((todayPresent / todayTotal) * 100) : 0);
  const weeklyTrend = attendanceData?.weeklyTrend && attendanceData.weeklyTrend.length > 0
    ? attendanceData.weeklyTrend
    : [
        {
          day: 'Today',
          present: todayRate,
          absent: Math.max(0, 100 - todayRate),
          presentCount: todayPresent,
          absentCount: Math.max(0, todayTotal - todayPresent),
          totalCount: todayTotal,
        }
      ];

  const displayFollowups: FeeFollowupItem[] = feeFollowups;
  const displayActivity: RecentActivityItem[] = recentActivity;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {reminderToast && (
        <div
          className={`fixed top-5 right-5 z-50 p-4 rounded-xl shadow-2xl border flex items-center gap-3 transition-all ${
            reminderToast.type === 'success'
              ? 'bg-[#1E293B] border-emerald-500 text-emerald-300'
              : 'bg-[#1E293B] border-rose-500 text-rose-300'
          }`}
        >
          {reminderToast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          )}
          <span className="text-xs font-semibold">{reminderToast.message}</span>
        </div>
      )}

      {/* 1. Dashboard Toolbar & Quick Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Academy Performance Overview
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Real-time analytics for batches, fee disbursements, and daily attendance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Segmented Period Filter */}
          <div className="inline-flex bg-[#1E293B] border border-white/10 p-1 rounded-lg">
            <button
              onClick={() => setActivePeriod('today')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activePeriod === 'today'
                  ? 'bg-[#273549] text-[#F97316] font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setActivePeriod('week')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activePeriod === 'week'
                  ? 'bg-[#273549] text-[#F97316] font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setActivePeriod('month')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activePeriod === 'month'
                  ? 'bg-[#273549] text-[#F97316] font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              This Month
            </button>
          </div>

          {/* Quick Action Pill Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/students"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg text-xs font-semibold shadow-md shadow-orange-500/30 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Student</span>
            </Link>

            <Link
              to="/admin/payments"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1E293B] hover:bg-[#273549] border border-white/10 hover:border-[#F97316] text-slate-200 hover:text-[#F97316] rounded-lg text-xs font-semibold transition-all"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Record Payment</span>
            </Link>

            <Link
              to="/admin/batches"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1E293B] hover:bg-[#273549] border border-white/10 hover:border-[#F97316] text-slate-200 hover:text-[#F97316] rounded-lg text-xs font-semibold transition-all"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Create Batch</span>
            </Link>

            <Link
              to="/admin/announcements"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1E293B] hover:bg-[#273549] border border-white/10 hover:border-[#F97316] text-slate-200 hover:text-[#F97316] rounded-lg text-xs font-semibold transition-all"
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>Publish Notice</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Stitch 6 KPI Summary Cards Grid */}
      <div className="kpi-grid">
        {/* Card 1: Total Students */}
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon-wrap bg-orange-500/15 text-[#F97316]">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
              ↑ +8.4%
            </span>
          </div>
          <div className="kpi-value">{totalStudents}</div>
          <div className="kpi-label">Total Students</div>
          <div className="kpi-sublabel">Active enrolled students</div>
        </div>

        {/* Card 2: Active Teachers */}
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon-wrap bg-sky-500/15 text-sky-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
              100% on duty
            </span>
          </div>
          <div className="kpi-value">{activeTeachers}</div>
          <div className="kpi-label">Active Teachers</div>
          <div className="kpi-sublabel">Faculty currently coaching</div>
        </div>

        {/* Card 3: Active Courses */}
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon-wrap bg-purple-500/15 text-purple-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400">
              Combat & Track
            </span>
          </div>
          <div className="kpi-value">4</div>
          <div className="kpi-label">Active Disciplines</div>
          <div className="kpi-sublabel">MMA, Karate, Sprint, Boxing</div>
        </div>

        {/* Card 4: Active Batches */}
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon-wrap bg-teal-500/15 text-teal-400">
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-400">
              Morning/Eve
            </span>
          </div>
          <div className="kpi-value">{activeBatches}</div>
          <div className="kpi-label">Active Batches</div>
          <div className="kpi-sublabel">Running sports squads</div>
        </div>

        {/* Card 5: Pending Fees */}
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon-wrap bg-amber-500/15 text-amber-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
              ⚠️ {displayFollowups.length} Dues
            </span>
          </div>
          <div className="kpi-value text-amber-400">
            ₹{Number(pendingFees).toLocaleString('en-IN')}
          </div>
          <div className="kpi-label">Pending Fees</div>
          <div className="kpi-sublabel">Outstanding cohort amount</div>
        </div>

        {/* Card 6: Today's Attendance */}
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon-wrap bg-emerald-500/15 text-emerald-400">
              <CheckSquare className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
              {todayRate >= 75 ? 'Optimal' : 'Needs Check'}
            </span>
          </div>
          <div className="kpi-value text-emerald-400">{todayRate}%</div>
          <div className="kpi-label">Today's Attendance</div>
          <div className="kpi-sublabel">{todayPresent} / {todayTotal} Athletes Present</div>
        </div>
      </div>

      {/* 3. Main Dashboard 2-Column Split: Attendance Overview & Fee Collection Summary */}
      <div className="dash-columns">
        {/* LEFT COLUMN: Attendance Overview */}
        <div className="stitch-card relative overflow-visible">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-sm">
                <CheckSquare className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-white tracking-tight">Attendance Overview</h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Real-time Tracking" />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Weekly trend across all {activeBatches} sports squads</p>
              </div>
            </div>
            <Link
              to="/admin/attendance"
              className="text-xs font-semibold text-[#F97316] hover:text-[#EA580C] inline-flex items-center gap-1 group transition-colors"
            >
              <span>View Log</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Interactive Legend Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4 pb-3 border-b border-white/5 text-xs">
            <div className="flex items-center gap-4 text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-emerald-500 shadow-sm" />
                <span className="font-medium text-slate-300">Present (Avg {todayRate}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-rose-500 shadow-sm" />
                <span className="font-medium text-slate-300">Absent / Leave</span>
              </div>
            </div>

            <span className="text-[11px] text-slate-400 hidden sm:inline-flex items-center gap-1.5">
              Hover on bars to inspect details
            </span>
          </div>

          {/* Stacked Bar Chart - Pure CSS Fast Render */}
          <div className="space-y-2">
            {weeklyTrend.map((d) => {
              const totalAthletes = d.totalCount ?? (todayTotal || 4);
              const presentAthletes = d.presentCount ?? Math.round((d.present / 100) * totalAthletes);
              const absentAthletes = d.absentCount ?? Math.max(0, totalAthletes - presentAthletes);

              return (
                <div
                  key={d.day}
                  className="relative p-2 rounded-lg hover:bg-slate-800/60 transition-colors duration-100 group cursor-default"
                >
                  {/* Lightweight pure CSS hover tooltip - zero JS re-renders, zero lag */}
                  <div className="absolute -top-11 left-1/2 -translate-x-1/2 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <div className="bg-slate-900 border border-slate-700 shadow-xl rounded-lg px-2.5 py-1 text-xs text-white whitespace-nowrap flex items-center gap-2.5">
                      <span className="font-semibold text-slate-200">{d.day}:</span>
                      <span className="text-emerald-400 font-bold">{d.present}% ({presentAthletes} Present)</span>
                      {d.absent > 0 && (
                        <span className="text-rose-400 font-bold">{d.absent}% ({absentAthletes} Absent)</span>
                      )}
                    </div>
                    <div className="w-2 h-2 bg-slate-900 border-b border-r border-slate-700 rotate-45 mx-auto -mt-1" />
                  </div>

                  <div className="grid grid-cols-[85px_1fr_50px] items-center gap-3 text-xs">
                    {/* Day Label */}
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-300 group-hover:text-emerald-300 transition-colors">
                        {d.day}
                      </span>
                    </div>

                    {/* Progress Bar Track */}
                    <div className="h-5 bg-slate-900/90 rounded-md p-0.5 border border-white/10 overflow-hidden flex relative">
                      {/* Present Segment */}
                      <div
                        style={{ width: `${d.present}%` }}
                        className={`h-full bg-emerald-500 relative flex items-center justify-center ${
                          d.absent === 0 ? 'rounded-[4px]' : 'rounded-l-[4px]'
                        }`}
                      >
                        {d.present >= 25 && (
                          <span className="text-[10px] font-bold text-slate-950 px-1 select-none">
                            {d.present}%
                          </span>
                        )}
                      </div>

                      {/* Absent Segment (if any) */}
                      {d.absent > 0 && (
                        <div
                          style={{ width: `${d.absent}%` }}
                          className={`h-full bg-rose-500 relative flex items-center justify-center ${
                            d.present === 0 ? 'rounded-[4px]' : 'rounded-r-[4px]'
                          }`}
                        >
                          {d.absent >= 25 && (
                            <span className="text-[10px] font-bold text-white px-1 select-none">
                              {d.absent}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right Stat */}
                    <div className="flex items-center justify-end">
                      <span
                        className={`font-bold text-right ${
                          d.present === 100 ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {d.present}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Fee Collection Summary */}
        <div className="stitch-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">Fee Collection Summary</h3>
              <p className="text-xs text-slate-400 mt-0.5">{currentMonth.formatted || 'Current Academic Cycle'}</p>
            </div>
            <Link
              to="/admin/fees"
              className="text-xs font-semibold text-[#F97316] hover:text-[#EA580C] inline-flex items-center gap-1"
            >
              Fee Register <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Fee Stat Metric Boxes */}
          <div className="fee-stats-grid">
            <div className="fee-stat-box success">
              <div className="label">Total Collected</div>
              <div className="amount">₹{collectedFees.toLocaleString('en-IN')}</div>
            </div>
            <div className="fee-stat-box warning">
              <div className="label">Pending Dues</div>
              <div className="amount">₹{pendingFees.toLocaleString('en-IN')}</div>
            </div>
            <div className="fee-stat-box danger">
              <div className="label">Overdue Dues</div>
              <div className="amount">₹{overdueFees.toLocaleString('en-IN')}</div>
            </div>
          </div>

          {/* Progress Breakdown Bar */}
          <div className="space-y-2 mb-5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Collection Target Progress</span>
              <strong className="text-white">{collectionRate}% Achieved</strong>
            </div>
            <div className="h-3 rounded-full bg-[#273549] overflow-hidden flex">
              <div style={{ width: `${collectionRate}%` }} className="bg-[#22C55E] h-full" title={`Collected: ${collectionRate}%`} />
              <div style={{ width: `${expectedFees > 0 ? Math.round((pendingFees / expectedFees) * 100) : 0}%` }} className="bg-[#F59E0B] h-full" title="Pending" />
            </div>
          </div>

          {/* Quick Metrics List */}
          <div className="border-t border-white/10 pt-4 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Total Invoiced This Cycle:</span>
              <span className="font-semibold text-white">₹{expectedFees.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Actionable WhatsApp Reminders:</span>
              <span className="font-semibold text-emerald-400">{displayFollowups.length} Ready to Dispatch</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Outstanding Receivable:</span>
              <span className="font-semibold text-amber-400">₹{pendingFees.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Lower Columns: Overdue Fee Follow-ups & Recent Activity */}
      <div className="lower-columns">
        {/* LEFT: Overdue Fee Follow-ups Action Panel */}
        <div className="stitch-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">Overdue Fee Follow-ups</h3>
              <p className="text-xs text-slate-400 mt-0.5">Immediate action required for students with pending payments</p>
            </div>
            <Link to="/admin/fees" className="text-xs font-semibold text-[#F97316] hover:text-[#EA580C]">
              View All ({displayFollowups.length})
            </Link>
          </div>

          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Batch / Program</th>
                  <th>Pending Amount</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {displayFollowups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-xs text-slate-400">
                      🎉 All athlete fee accounts are up to date! No pending follow-ups.
                    </td>
                  </tr>
                ) : (
                  displayFollowups.slice(0, 5).map((item) => {
                  const days = getDaysOverdue(item.dueDate);
                  const isCritical = days > 10 || item.attentionLevel === 'CRITICAL';
                  const initials = item.studentName.split(' ').map((n) => n[0]).join('').substring(0, 2);

                  return (
                    <tr key={item.feeId}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#334155] border border-white/10 flex items-center justify-center font-bold text-[11px] text-white flex-shrink-0">
                            {initials}
                          </div>
                          <div>
                            <strong className="text-white text-xs block leading-tight">{item.studentName}</strong>
                            <span className="text-[10px] text-slate-400">ID: #{item.studentId.substring(0, 8)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="text-xs text-slate-300">{item.batchName}</td>
                      <td>
                        <strong className={isCritical ? 'text-[#EF4444]' : 'text-[#F59E0B]'}>
                          ₹{Number(item.remainingAmount).toLocaleString('en-IN')}
                        </strong>
                      </td>
                      <td className="text-xs text-slate-400">{new Date(item.dueDate).toLocaleDateString()}</td>
                      <td className="whitespace-nowrap">
                        <span
                          className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center whitespace-nowrap ${
                            isCritical
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {days > 0 ? `${days}d Overdue` : 'Pending'}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => handleSendReminder(item)}
                          disabled={sendingReminderId === item.feeId}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#273549] hover:bg-[#25D366]/20 border border-white/10 hover:border-[#25D366] text-white hover:text-[#25D366] text-xs font-semibold transition-colors cursor-pointer"
                          title="Send automated WhatsApp Reminder"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2z" />
                          </svg>
                          <span>{sendingReminderId === item.feeId ? 'Sending...' : 'Remind'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: Recent Activity Timeline */}
        <div className="stitch-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">Recent Activity</h3>
              <p className="text-xs text-slate-400 mt-0.5">Live operational events and staff audits</p>
            </div>
            <span className="text-xs font-medium text-slate-400">Activity History</span>
          </div>

          <div className="space-y-4">
            {displayActivity.map((act) => (
              <div key={act.id} className="flex items-start gap-3">
                <div
                  className={`w-8 h-8 rounded-full border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    act.type === 'PAYMENT'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : act.type === 'ENROLLMENT'
                      ? 'bg-sky-500/15 text-sky-400'
                      : act.type === 'ATTENDANCE'
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-orange-500/15 text-orange-400'
                  }`}
                >
                  {act.type === 'PAYMENT' ? (
                    <CreditCard className="w-4 h-4" />
                  ) : act.type === 'ENROLLMENT' ? (
                    <Users className="w-4 h-4" />
                  ) : act.type === 'ATTENDANCE' ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Megaphone className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-200 leading-snug">
                    <strong className="text-white font-semibold">{act.title}: </strong>
                    {act.description}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                    <span>Academy Staff</span>
                    <span>•</span>
                    <span>{new Date(act.timestamp).toLocaleDateString()}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
