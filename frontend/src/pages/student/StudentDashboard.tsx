import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { 
  Calendar, 
  CreditCard, 
  Award, 
  Clock, 
  Flame, 
  ChevronRight, 
  UserCheck, 
  MapPin
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../lib/api';
import { InstallPwaPrompt } from '../../components/pwa/InstallPwaPrompt';

export const StudentDashboard: React.FC = () => {
  const { token, profile } = useAuth();

  // Fetch Student Profile & Batches
  const { data: profileData } = useQuery({
    queryKey: ['student-profile'],
    queryFn: async () => {
      const res = await fetch(getApiUrl('/student-portal/profile'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return data.data;
    },
    enabled: !!token,
  });

  // Fetch Attendance Summary
  const { data: attendanceData, isLoading: attLoading } = useQuery({
    queryKey: ['student-attendance-summary'],
    queryFn: async () => {
      const res = await fetch(getApiUrl('/student-portal/attendance'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return data.data;
    },
    enabled: !!token,
  });

  // Fetch Fee Summary
  const { data: feesData } = useQuery({
    queryKey: ['student-fees-summary'],
    queryFn: async () => {
      const res = await fetch(getApiUrl('/student-portal/fees'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return data.data;
    },
    enabled: !!token,
  });

  const student = profileData?.student;
  const batches = profileData?.batches || [];
  const currentRank = profileData?.currentRank;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* PWA Install Prompt Banner */}
      <InstallPwaPrompt />

      {/* Welcome Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900/60 via-slate-900/90 to-slate-900 border border-blue-500/30 p-5 md:p-6 shadow-2xl">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 p-0.5 shadow-lg shadow-orange-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                  {student?.name ? student.name.charAt(0).toUpperCase() : '🥋'}
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  {student?.name || profile?.fullName || 'Champion'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Active Member
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                {student?.course || 'Martial Arts & Athletic Training'}
              </p>
            </div>
          </div>

          {currentRank && (
            <div className="bg-slate-800/80 border border-amber-500/30 px-3.5 py-2 rounded-2xl flex items-center gap-3 shrink-0 shadow-sm">
              <Award className="w-6 h-6 text-amber-400" />
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Current Rank</span>
                <span className="text-xs font-bold text-amber-300">{currentRank.rank_name || 'Yellow Belt'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Attendance % */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">This Month</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl md:text-3xl font-black text-emerald-400">
            {attLoading ? '...' : `${attendanceData?.attendancePercentage || 0}%`}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {attendanceData?.presentCount || 0} of {attendanceData?.totalSessions || 0} sessions
          </p>
        </div>

        {/* Attendance Streak */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Active Streak</span>
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-2xl md:text-3xl font-black text-orange-400 flex items-baseline gap-1">
            {attLoading ? '...' : (attendanceData?.currentStreak || 0)}
            <span className="text-xs font-normal text-slate-400">days</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Consistent discipline</p>
        </div>

        {/* Previous Month Comparison */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Last Month</span>
            <Calendar className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl md:text-3xl font-black text-blue-400">
            {attLoading ? '...' : `${attendanceData?.previousMonth?.attendancePercentage || 0}%`}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {attendanceData?.previousMonth?.presentCount || 0} sessions attended
          </p>
        </div>

        {/* Fees Status */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Fee Status</span>
            <CreditCard className="w-4 h-4 text-purple-400" />
          </div>
          <div className={`text-xl md:text-2xl font-black ${(feesData?.totalPendingAmount || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {(feesData?.totalPendingAmount || 0) > 0 ? `₹${feesData.totalPendingAmount} Due` : 'Clear'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Due on {feesData?.feeDueDay || 5}th of month
          </p>
        </div>
      </div>

      {/* Batch Training Schedule Card */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            Training Schedule & Batches
          </h3>
          <span className="text-xs text-slate-400 font-medium">{batches.length} Batch Assigned</span>
        </div>

        {batches.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
            No regular batch assigned yet. Contact your sensei.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {batches.map((batch: any) => (
              <div
                key={batch.id}
                className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 flex items-start justify-between"
              >
                <div>
                  <h4 className="font-bold text-white text-sm">{batch.name}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">{batch.subject || 'Combat Training'}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-300 font-medium">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-blue-300 font-semibold text-[11px]">
                      {Array.isArray(batch.schedule_days) ? batch.schedule_days.join(', ') : 'Daily'}
                    </span>
                    <span>
                      {batch.start_time?.slice(0, 5)} - {batch.end_time?.slice(0, 5)}
                    </span>
                  </div>
                </div>
                <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {batch.status || 'ACTIVE'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <NavLink
          to="/student/attendance"
          className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-blue-900/30 to-indigo-900/20 border border-blue-500/20 hover:border-blue-500/40 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Attendance Calendar</div>
              <div className="text-xs text-slate-400">View current & past month attendance records</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </NavLink>

        <NavLink
          to="/student/fees"
          className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-purple-900/30 to-pink-900/20 border border-purple-500/20 hover:border-purple-500/40 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Fee Receipts & History</div>
              <div className="text-xs text-slate-400">Download official receipts & track payments</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </NavLink>
      </div>
    </div>
  );
};
