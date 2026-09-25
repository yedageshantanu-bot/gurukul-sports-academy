import React, { useEffect, useState } from 'react';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SkeletonLoader } from '../../components/common/SkeletonLoader';
import { apiClient } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { TeacherItem } from '../../types/crm';
import { Mail, Phone, BookOpen, ShieldCheck, CheckCircle2, Award } from 'lucide-react';

export const TeacherProfilePage: React.FC = () => {
  const { profile } = useAuth();
  const [teacher, setTeacher] = useState<TeacherItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeacherProfile = async () => {
      if (!profile?.teacherId) {
        setLoading(false);
        return;
      }
      try {
        const data = await apiClient<TeacherItem>(`/teachers/${profile.teacherId}`);
        setTeacher(data);
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTeacherProfile();
  }, [profile?.teacherId]);

  if (loading) {
    return (
      <div className="max-w-3xl space-y-6">
        <SkeletonLoader variant="cards" />
      </div>
    );
  }

  const displayName = teacher?.fullName || profile?.fullName || 'Instructor';
  const displayEmail = teacher?.email || profile?.email || '—';
  const displaySubject = teacher?.subject || 'Instructor';

  return (
    <div className="max-w-4xl space-y-6 pb-10">
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20">
            Faculty Credentials
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight mt-1">Instructor Profile & Permissions</h1>
        <p className="text-sm text-slate-400 mt-1">
          Your verified academy instructor credentials, biometric authorization status, and field permissions.
        </p>
      </div>

      <div className="bg-[#1E293B] border border-white/10 rounded-xl p-6 sm:p-8 space-y-6 shadow-xl">
        {/* Profile Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-500 via-amber-600 to-red-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg">
              {displayName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{displayName}</h2>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xs font-semibold text-orange-400 mt-0.5">{displaySubject}</p>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status={teacher?.status || 'ACTIVE'} />
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300 bg-[#0F172A] border border-white/10 px-2.5 py-0.5 rounded-md">
                  <Award className="w-3 h-3 text-orange-400" />
                  Verified Academy Faculty
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl border border-white/10 bg-[#0F172A]/70 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Address</p>
              <p className="text-sm font-semibold text-white truncate mt-0.5">{displayEmail}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-white/10 bg-[#0F172A]/70 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Phone className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone / WhatsApp</p>
              <p className="text-sm font-semibold text-white mt-0.5">{teacher?.phone || '+91 98765 43210'}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-white/10 bg-[#0F172A]/70 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Specialization</p>
              <p className="text-sm font-semibold text-white mt-0.5">{teacher?.subject || 'Head Athletics & Cricket Coach'}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-white/10 bg-[#0F172A]/70 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">System Role</p>
              <p className="text-sm font-semibold text-white mt-0.5">ACADEMY_TEACHER (Full Roster Access)</p>
            </div>
          </div>
        </div>

        {/* Security & Access Scope Banner */}
        <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 space-y-1">
            <p className="font-semibold text-orange-300">Field Roll Call & Biometric Authorization Scope</p>
            <p className="leading-relaxed text-slate-400">
              Your instructor account is authorized to mark daily training attendance, log student fitness notes, and review batch rosters directly synchronized with the Gurukul Sports Central Database.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherProfilePage;
