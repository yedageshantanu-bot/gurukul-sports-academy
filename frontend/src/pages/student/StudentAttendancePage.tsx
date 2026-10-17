import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  Flame, 
  TrendingUp, 
  Clock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../lib/api';

export const StudentAttendancePage: React.FC = () => {
  const { token } = useAuth();
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1); // 1-indexed

  // Query attendance for selected year and month
  const { data, isLoading } = useQuery({
    queryKey: ['student-attendance-records', selectedYear, selectedMonth],
    queryFn: async () => {
      const res = await fetch(
        getApiUrl(`/student-portal/attendance?year=${selectedYear}&month=${selectedMonth}`),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      return json.data;
    },
    enabled: !!token,
  });

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear((y) => y - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear((y) => y + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleCurrentMonth = () => {
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth() + 1);
  };

  const handlePreviousMonthQuick = () => {
    if (today.getMonth() === 0) {
      setSelectedYear(today.getFullYear() - 1);
      setSelectedMonth(12);
    } else {
      setSelectedYear(today.getFullYear());
      setSelectedMonth(today.getMonth());
    }
  };

  // Build calendar matrix for selected month
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const firstDayIndex = new Date(selectedYear, selectedMonth - 1, 1).getDay(); // 0 is Sunday

  const recordsMap = new Map<number, any>();
  (data?.records || []).forEach((r: any) => {
    if (r.date) {
      const d = parseInt(r.date.split('-')[2], 10);
      recordsMap.set(d, r);
    }
  });

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const isCurrentMonthView =
    selectedYear === today.getFullYear() && selectedMonth === today.getMonth() + 1;

  const prevMonthStats = data?.previousMonth;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header and Quick Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-blue-400" />
            Attendance Hub
          </h2>
          <p className="text-xs text-slate-400">
            Track your daily attendance record, attendance score, and discipline streak.
          </p>
        </div>

        {/* Quick Month Switcher Buttons (Current Month vs Pichale Month Ka) */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleCurrentMonth}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              isCurrentMonthView
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 border border-blue-400/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
            }`}
          >
            Current Month
          </button>
          <button
            onClick={handlePreviousMonthQuick}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              !isCurrentMonthView && selectedMonth === (today.getMonth() === 0 ? 12 : today.getMonth())
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 border border-blue-400/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
            }`}
          >
            Pichale Month Ka ⏳
          </button>
        </div>
      </div>

      {/* KPI Stats Comparison Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-medium text-slate-400 block mb-1">Attendance Score</span>
          <div className="text-2xl md:text-3xl font-black text-emerald-400">
            {isLoading ? '...' : `${data?.attendancePercentage || 0}%`}
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">
            {data?.presentCount || 0} Present / {data?.totalSessions || 0} Total
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-medium text-slate-400 block mb-1">Sessions Present</span>
          <div className="text-2xl md:text-3xl font-black text-white flex items-center gap-1.5">
            {isLoading ? '...' : (data?.presentCount || 0)}
            <CheckCircle2 className="w-5 h-5 text-emerald-400 inline" />
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">Full participation</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-medium text-slate-400 block mb-1">Days Absent</span>
          <div className="text-2xl md:text-3xl font-black text-rose-400 flex items-center gap-1.5">
            {isLoading ? '...' : (data?.absentCount || 0)}
            <XCircle className="w-5 h-5 text-rose-400 inline" />
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">Missed training sessions</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-medium text-slate-400 block mb-1">Discipline Streak</span>
          <div className="text-2xl md:text-3xl font-black text-orange-400 flex items-center gap-1.5">
            {isLoading ? '...' : (data?.currentStreak || 0)}
            <Flame className="w-5 h-5 text-orange-400 inline" />
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">Consecutive attendance</span>
        </div>
      </div>

      {/* Previous Month Benchmark Card ("Pichale Month Ka" Comparison) */}
      {prevMonthStats && isCurrentMonthView && (
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                Comparison: Pichala Month ({prevMonthStats.monthName} {prevMonthStats.year})
              </h4>
              <p className="text-[11px] text-slate-300">
                You attended {prevMonthStats.presentCount} of {prevMonthStats.totalSessions} sessions ({prevMonthStats.attendancePercentage}%).
              </p>
            </div>
          </div>
          <button
            onClick={handlePreviousMonthQuick}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 border border-indigo-500/30 transition-all self-start sm:self-auto"
          >
            View {prevMonthStats.monthName} Records →
          </button>
        </div>
      )}

      {/* Interactive Visual Calendar Matrix */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 shadow-sm space-y-4">
        {/* Month Selector Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <h3 className="text-base font-bold text-white tracking-wide">
            {monthNames[selectedMonth - 1]} {selectedYear}
          </h3>

          <button
            onClick={handleNextMonth}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400 py-1 border-b border-slate-800">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {/* Empty spacer for first day of week */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="h-14 sm:h-16 rounded-xl bg-slate-950/20" />
          ))}

          {/* Month Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const record = recordsMap.get(dayNum);
            const isToday =
              isCurrentMonthView && dayNum === today.getDate();

            let statusBg = 'bg-slate-950/60 border-slate-800 text-slate-400';
            let badge = null;

            if (record?.status === 'PRESENT') {
              statusBg = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold';
              badge = <span className="text-[10px] text-emerald-400 font-bold">P</span>;
            } else if (record?.status === 'ABSENT') {
              statusBg = 'bg-rose-500/15 border-rose-500/40 text-rose-300 font-bold';
              badge = <span className="text-[10px] text-rose-400 font-bold">A</span>;
            }

            return (
              <div
                key={`day-${dayNum}`}
                className={`h-14 sm:h-16 rounded-xl border p-1.5 flex flex-col justify-between transition-all ${statusBg} ${
                  isToday ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{dayNum}</span>
                  {badge}
                </div>
                {record?.batches?.name && (
                  <span className="text-[9px] text-slate-400 truncate hidden sm:block">
                    {record.batches.name}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-emerald-500/20 border border-emerald-500/50" />
            <span>Present</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-rose-500/20 border border-rose-500/50" />
            <span>Absent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-slate-950/60 border border-slate-800" />
            <span>Rest / No Session</span>
          </div>
        </div>
      </div>

      {/* Session Logs List */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          Session Breakdown for {monthNames[selectedMonth - 1]} {selectedYear}
        </h3>

        {(data?.records || []).length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
            No attendance recorded for this month yet.
          </div>
        ) : (
          <div className="space-y-2">
            {(data?.records || []).map((rec: any) => {
              const isPresent = rec.status === 'PRESENT';
              return (
                <div
                  key={rec.id}
                  className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isPresent
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {isPresent ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">
                        {new Date(rec.date).toLocaleDateString('en-IN', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {rec.batches?.name || 'Academy Training Batch'}
                        {rec.notes ? ` • Note: ${rec.notes}` : ''}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                      isPresent
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/25'
                    }`}
                  >
                    {rec.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
