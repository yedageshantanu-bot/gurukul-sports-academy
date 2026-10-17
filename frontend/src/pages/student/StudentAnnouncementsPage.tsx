import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Megaphone, Calendar, Bell, Trophy, AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../lib/api';

export const StudentAnnouncementsPage: React.FC = () => {
  const { token } = useAuth();

  const { data: announcements, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['student-announcements'],
    queryFn: async () => {
      const res = await fetch(getApiUrl('/student-portal/announcements'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!token,
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority?.toUpperCase()) {
      case 'URGENT':
      case 'HIGH':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Urgent Notice
          </span>
        );
      case 'IMPORTANT':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <Bell className="w-3 h-3" />
            Important
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Academy Notice
          </span>
        );
    }
  };

  const getCategoryIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('tournament') || t.includes('match') || t.includes('grading') || t.includes('championship')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
          <Trophy className="w-5 h-5" />
        </div>
      );
    }
    if (t.includes('closed') || t.includes('holiday') || t.includes('alert') || t.includes('rescheduled')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
        <Megaphone className="w-5 h-5" />
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-blue-400" />
            Academy Announcements
          </h2>
          <p className="text-xs text-slate-400">
            Official academy notices, tournament schedules, grading trials, and batch updates.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors disabled:opacity-50"
          title="Refresh Announcements"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-blue-400' : ''}`} />
        </button>
      </div>

      {/* Announcements List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-28 rounded-2xl bg-slate-900/60 animate-pulse border border-slate-800" />
          ))}
        </div>
      ) : (announcements || []).length === 0 ? (
        <div className="py-12 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl p-6">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/80 mx-auto flex items-center justify-center text-slate-400 mb-3">
            <Megaphone className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">No Announcements Yet</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            You are all caught up! Academy circulars, belt exams, and schedules will be posted here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(announcements || []).map((item: any) => {
            const formattedDate = item.created_at
              ? new Date(item.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : 'Recent';

            return (
              <div
                key={item.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 md:p-5 transition-all shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {getCategoryIcon(item.title)}
                    <div>
                      <h3 className="text-sm md:text-base font-bold text-white capitalize leading-tight">
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {formattedDate}
                        </span>
                        {item.scope === 'ALL' && (
                          <>
                            <span>•</span>
                            <span className="text-blue-400 font-medium">All Batches</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">{getPriorityBadge(item.priority)}</div>
                </div>

                {/* Message Body */}
                <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3.5 text-xs md:text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                  {item.message}
                </div>

                {/* Targeted Batches Tags if specific */}
                {Array.isArray(item.batches) && item.batches.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-500">Target Batches:</span>
                    {item.batches.map((b: any, idx: number) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-medium text-[10px]"
                      >
                        {b.batch?.name || 'Assigned Batch'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
