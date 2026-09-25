import React, { useEffect, useState } from 'react';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { EmptyState } from '../../components/common/EmptyState';
import { apiClient } from '../../lib/api';
import { TeacherKPIs } from '../../types/crm';
import {
  Layers,
  Users,
  Clock,
  ArrowRight,
  CheckSquare,
  CheckCircle2,
  Sparkles,
  MapPin,
  Trophy,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const TeacherDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<TeacherKPIs | null>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [noteText, setNoteText] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('Aarav Kumar (Cricket Batch B)');
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const data = await apiClient<any>('/dashboard/teacher');
        setKpis(data.kpis);
        setBatches(data.assignedBatches || []);
      } catch (err) {
        console.error('Failed to load teacher dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setNoteSaved(true);
    setTimeout(() => {
      setNoteText('');
      setNoteSaved(false);
    }, 3000);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader variant="cards" />
        <SkeletonLoader variant="table" rows={3} />
      </div>
    );
  }

  const assignedCount = batches.length || (kpis?.assignedBatchCount ?? 0);
  const studentCount = kpis?.totalStudentCount ?? 0;

  return (
    <div className="space-y-6">
      {/* 1. Top Coach Welcome & Status Strip (Stitch Teacher UI) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#1E293B] border border-white/10 rounded-xl p-5 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-[#F97316] flex-shrink-0">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Coach Performance &amp; Field Operations
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Lead Instructor: Turf Pitch 01, Main Pavilion &amp; Indoor Training Center
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#273549] border border-white/10 text-xs text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Biometrics: <strong className="text-emerald-400">Synced</strong></span>
          </div>

          <Link
            to="/teacher/attendance"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg text-xs font-semibold shadow-md shadow-orange-500/30 transition-all cursor-pointer"
          >
            <CheckSquare className="w-4 h-4" />
            <span>Take Roll Call</span>
          </Link>
        </div>
      </div>

      {/* 2. 4-Column KPI Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Assigned Batches */}
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Batches</span>
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center text-[#F97316]">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="kpi-value">{assignedCount} Batches</div>
          <p className="text-xs text-slate-400 mt-1">Morning Nets • Junior Cohort • Evening Pace</p>
          <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
            <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> 100% on schedule
            </span>
            <span className="text-slate-400">Athletic Division</span>
          </div>
        </div>

        {/* KPI 2: Athletes Trained */}
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Athletes Trained</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="kpi-value text-emerald-400">{studentCount} Athletes</div>
          <p className="text-xs text-slate-400 mt-1">Across all assigned sessions</p>
          <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
            <span className="text-emerald-400 font-medium">↑ Active Roster</span>
            <span className="text-slate-400">All Batches</span>
          </div>
        </div>

        {/* KPI 3: Roll Call Status */}
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Roll Call Status</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="kpi-value text-amber-400">2 Done / 1 Due</div>
          <p className="text-xs text-slate-400 mt-1">Pending Evening Batch Session</p>
          <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
            <span className="text-amber-400 font-semibold">Action at 04:30 PM</span>
            <span className="text-slate-400">24 Athletes</span>
          </div>
        </div>

        {/* KPI 4: Upcoming Tournament Camp */}
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tournament Camp</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="kpi-value text-purple-400">State Trials</div>
          <p className="text-xs text-slate-400 mt-1">In 4 Days • Oval Pitch A</p>
          <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
            <span className="text-slate-300 font-medium">14 Shortlisted</span>
            <span className="text-emerald-400">Final Camp</span>
          </div>
        </div>
      </div>

      {/* 3. Main Operational Layout (Split Grid: 8 Cols Left / 4 Cols Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Operations Column (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Training Schedule & Session Roster */}
          <div className="stitch-card">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-semibold text-white">Today's Training Schedule &amp; Session Roster</h3>
                <p className="text-xs text-slate-400 mt-0.5">Timeline, venue allocation, and live roll call dispatches</p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#273549] text-slate-300 border border-white/10">
                3 Sessions Timed
              </span>
            </div>

            <div className="space-y-3.5">
              {/* Session 1 */}
              <div className="p-4 rounded-xl bg-[#0F172A] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-[#1E293B] border border-white/10 flex flex-col items-center justify-center text-center flex-shrink-0">
                    <span className="text-[9px] uppercase font-bold text-slate-400">MORNING</span>
                    <span className="text-sm font-bold text-white">06:30</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">U-16 Cricket Nets Session</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        100% Completed
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-[#F97316]" /> Turf Pitch 01</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 06:30 AM - 08:30 AM</span>
                      <span className="flex items-center gap-1 text-slate-200"><Users className="w-3 h-3" /> 22 Athletes Present</span>
                    </div>
                  </div>
                </div>
                <Link
                  to="/teacher/attendance"
                  className="px-3 py-1.5 rounded-lg bg-[#1E293B] hover:bg-[#273549] border border-white/10 text-xs font-semibold text-slate-200 transition-colors self-end sm:self-center"
                >
                  View Roster
                </Link>
              </div>

              {/* Session 2 */}
              <div className="p-4 rounded-xl bg-[#0F172A] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-[#1E293B] border border-white/10 flex flex-col items-center justify-center text-center flex-shrink-0">
                    <span className="text-[9px] uppercase font-bold text-slate-400">MID-DAY</span>
                    <span className="text-sm font-bold text-white">10:00</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">Junior Fielding Drills &amp; Agility</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        Completed
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-[#F97316]" /> Indoor Ground 2</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 10:00 AM - 11:30 AM</span>
                      <span className="flex items-center gap-1 text-slate-200"><Users className="w-3 h-3" /> 18 Athletes Checked In</span>
                    </div>
                  </div>
                </div>
                <Link
                  to="/teacher/attendance"
                  className="px-3 py-1.5 rounded-lg bg-[#1E293B] hover:bg-[#273549] border border-white/10 text-xs font-semibold text-slate-200 transition-colors self-end sm:self-center"
                >
                  View Roster
                </Link>
              </div>

              {/* Session 3 (Current / Pending Call) */}
              <div className="p-4 rounded-xl bg-[#1E293B] border-2 border-orange-500/80 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-500/40 flex flex-col items-center justify-center text-center flex-shrink-0">
                    <span className="text-[9px] uppercase font-bold text-[#F97316]">EVENING</span>
                    <span className="text-sm font-bold text-white">16:30</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">Advanced Bowling Drills &amp; Match Sim</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-[#F97316] border border-orange-500/40 animate-pulse">
                        Ready for Roll Call
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1 text-[#F97316]"><MapPin className="w-3 h-3" /> Main Pitch &amp; Pavilion</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 04:30 PM - 06:30 PM</span>
                      <span className="flex items-center gap-1 text-[#F97316] font-semibold"><Users className="w-3 h-3" /> 24 Athletes Expected</span>
                    </div>
                  </div>
                </div>
                <Link
                  to="/teacher/attendance"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold shadow-md shadow-orange-500/30 transition-all cursor-pointer self-end sm:self-center"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>Start Roll Call</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Allocated Batches Cards Grid */}
          <div className="stitch-card">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-semibold text-white">Your Allocated Batches</h3>
                <p className="text-xs text-slate-400 mt-0.5">Batches currently assigned to your coaching schedule</p>
              </div>
              <Link to="/teacher/batches" className="text-xs font-semibold text-[#F97316] hover:text-[#EA580C] inline-flex items-center gap-1">
                All Batches <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {batches.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No batches allocated yet"
                description="You have not been assigned to any active batches. Please contact your academy administrator."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {batches.map((b) => (
                  <div key={b.id} className="p-4 rounded-xl bg-[#0F172A] border border-white/10 flex flex-col justify-between hover:border-orange-500/50 transition-colors">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-white text-sm">{b.name}</h4>
                          <span className="text-xs text-slate-400">{b.subject || 'Athletics & Sports'}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400">
                          Active
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                        <Users className="w-3.5 h-3.5 text-[#F97316]" />
                        <span>{b.studentCount ?? 0} Athletes enrolled</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Roster active</span>
                      <Link
                        to={`/teacher/attendance?batchId=${b.id}`}
                        className="text-[#F97316] hover:text-[#EA580C] font-semibold inline-flex items-center gap-1"
                      >
                        Roll Call <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Operations Column (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Athlete Performance Note Logger */}
          <div className="stitch-card">
            <h3 className="text-base font-semibold text-white mb-1">Athlete Performance Note</h3>
            <p className="text-xs text-slate-400 mb-4">Record tactical observation or physical form update</p>

            {noteSaved && (
              <div className="mb-3 p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Performance note saved to athlete log.</span>
              </div>
            )}

            <form onSubmit={handleSaveNote} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Select Athlete
                </label>
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full h-9 px-3 bg-[#0F172A] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-[#F97316]"
                >
                  <option>Aarav Kumar (Cricket Batch B)</option>
                  <option>Priya Sharma (Badminton Junior)</option>
                  <option>Rohan Verma (Athletics Pro)</option>
                  <option>Simran Malik (Swimming Elite)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Coaching Assessment
                </label>
                <textarea
                  rows={3}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="e.g. Improved seam release during morning session. Recommended for match simulation."
                  className="w-full p-2.5 bg-[#0F172A] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#F97316] resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-orange-500/30 cursor-pointer"
              >
                Log Performance Note
              </button>
            </form>
          </div>

          {/* Academy Announcements & Notices */}
          <div className="stitch-card">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
              <h3 className="text-base font-semibold text-white">Academy Notices</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-[#F97316]">
                3 Active
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-[#0F172A] border border-white/10">
                <span className="text-[10px] text-[#F97316] font-bold uppercase block mb-0.5">Trial Schedule</span>
                <p className="text-white font-medium">Inter-Academy Tournament Selection Trials</p>
                <p className="text-slate-400 text-[11px] mt-1">Starting Saturday, 08:00 AM at Pavilion Turf.</p>
              </div>

              <div className="p-3 rounded-lg bg-[#0F172A] border border-white/10">
                <span className="text-[10px] text-emerald-400 font-bold uppercase block mb-0.5">Equipment Update</span>
                <p className="text-white font-medium">New Leather Match Balls &amp; Stumps Received</p>
                <p className="text-slate-400 text-[11px] mt-1">Collect coaching kit bags from equipment locker.</p>
              </div>

              <div className="p-3 rounded-lg bg-[#0F172A] border border-white/10">
                <span className="text-[10px] text-sky-400 font-bold uppercase block mb-0.5">Faculty Briefing</span>
                <p className="text-white font-medium">Monthly Coaches Review Meeting</p>
                <p className="text-slate-400 text-[11px] mt-1">Friday 07:00 PM via Conference Room.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
