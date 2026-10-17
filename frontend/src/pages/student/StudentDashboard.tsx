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
  MapPin,
  Megaphone,
  IndianRupee,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../lib/api';
import { InstallPwaPrompt } from '../../components/pwa/InstallPwaPrompt';
import { NotificationPromptCard } from '../../components/notifications/NotificationPromptCard';

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
  const { data: feesData, isLoading: feesLoading } = useQuery({
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

  // Fetch Recent Announcements
  const { data: announcementsData } = useQuery({
    queryKey: ['student-announcements-preview'],
    queryFn: async () => {
      const res = await fetch(getApiUrl('/student-portal/announcements'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return data.data || [];
    },
    enabled: !!token,
  });

  const student = profileData?.student;
  const batches = profileData?.batches || [];
  const currentRank = profileData?.currentRank;
  const monthlyFee = feesData?.monthlyFee || student?.monthly_fee || 700;
  const recentAnnouncements = (announcementsData || []).slice(0, 2);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 1. Proactive Push Notification Permission Request Card */}
      <NotificationPromptCard />

      {/* 2. PWA Native Install Prompt Banner */}
      <InstallPwaPrompt />

      {/* 3. Athlete Welcome Profile Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900/60 via-slate-900/90 to-slate-900 border border-blue-500/30 p-5 md:p-6 shadow-2xl">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 p-0.5 shadow-lg shadow-orange-500/20 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                  {student?.name ? student.name.charAt(0).toUpperCase() : '🥋'}
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  {student?.name || profile?.fullName || 'Champion'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Verified Athlete
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>{student?.course || 'Kalarippayattu & Combat Martial Arts'}</span>
                {student?.student_mobile && (
                  <span className="text-slate-400 hidden sm:inline">• +91 {student.student_mobile}</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {currentRank ? (
              <div className="bg-slate-800/80 border border-amber-500/30 px-3.5 py-2 rounded-2xl flex items-center gap-2.5 shadow-sm">
                <Award className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">Rank</span>
                  <span className="text-xs font-bold text-amber-300">{currentRank.rank_name}</span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/80 border border-blue-500/30 px-3 py-1.5 rounded-2xl flex items-center gap-2 text-xs text-slate-300">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-slate-200">Kalarippayattu Squad</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Enrolled Batch & Batch Price Detail Card */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            Enrolled Batch & Fee Plan
          </h3>
          <span className="text-xs text-slate-400 font-medium">{batches.length} Active Batch</span>
        </div>

        {batches.length === 0 ? (
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-white text-sm">MMA & Combat Sparring Squad</h4>
              <p className="text-xs text-slate-400 mt-0.5">Kalarippayattu (Regular) • Mon, Wed, Fri (06:00 AM - 08:00 AM)</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Batch Price</span>
              <span className="text-base font-black text-emerald-400">₹{monthlyFee} / month</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {batches.map((batch: any) => (
              <div
                key={batch.id}
                className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-sm md:text-base">{batch.name}</h4>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                      {batch.status || 'ACTIVE'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Discipline: <span className="text-slate-200 font-medium">{batch.subject || student?.course || 'Combat Martial Arts'}</span>
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                    <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 font-semibold text-[11px] border border-blue-500/20">
                      {Array.isArray(batch.schedule_days) ? batch.schedule_days.join(', ') : 'Mon, Wed, Fri'}
                    </span>
                    <span className="text-slate-300 font-semibold">
                      {batch.start_time?.slice(0, 5) || '06:00'} - {batch.end_time?.slice(0, 5) || '08:00'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center sm:flex-col sm:items-end justify-between sm:justify-center shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Batch Monthly Fee</span>
                  <span className="text-base md:text-lg font-black text-emerald-400 flex items-center">
                    <IndianRupee className="w-4 h-4 text-emerald-400" />
                    {monthlyFee} <span className="text-xs font-normal text-slate-400 ml-1">/ mo</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Attendance & Fee KPI Grid */}
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
          <p className="text-[11px] text-slate-400 mt-1">Discipline score</p>
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
            <span className="text-xs font-medium">Fee Balance</span>
            <CreditCard className="w-4 h-4 text-purple-400" />
          </div>
          <div className={`text-xl md:text-2xl font-black ${(feesData?.totalPendingAmount || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {feesLoading ? '...' : (feesData?.totalPendingAmount || 0) > 0 ? `₹${feesData.totalPendingAmount} Due` : 'All Clear'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Due on {feesData?.feeDueDay || 5}th of month
          </p>
        </div>
      </div>

      {/* 6. Recent Academy Announcements Preview Card */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-amber-400" />
            Academy Announcements
          </h3>
          <NavLink
            to="/student/announcements"
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
          >
            View All ({announcementsData?.length || 0}) →
          </NavLink>
        </div>

        {recentAnnouncements.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
            No announcements right now. Check back soon!
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentAnnouncements.map((ann: any) => (
              <NavLink
                key={ann.id}
                to="/student/announcements"
                className="block bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-3.5 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-white text-xs md:text-sm capitalize">{ann.title}</h4>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {ann.created_at ? new Date(ann.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Recent'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                  {ann.message}
                </p>
              </NavLink>
            ))}
          </div>
        )}
      </div>

      {/* 7. Quick Actions Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <NavLink
          to="/student/attendance"
          className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-blue-900/30 to-indigo-900/20 border border-blue-500/20 hover:border-blue-500/40 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Attendance Calendar</div>
              <div className="text-xs text-slate-400">Current & past month records</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </NavLink>

        <NavLink
          to="/student/fees"
          className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-purple-900/30 to-pink-900/20 border border-purple-500/20 hover:border-purple-500/40 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Fee & PDF Receipts</div>
              <div className="text-xs text-slate-400">Download verified receipts</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </NavLink>

        <NavLink
          to="/student/announcements"
          className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-amber-900/30 to-orange-900/20 border border-amber-500/20 hover:border-amber-500/40 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shrink-0">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Announcements</div>
              <div className="text-xs text-slate-400">Notices, exams & schedules</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
        </NavLink>
      </div>
    </div>
  );
};
