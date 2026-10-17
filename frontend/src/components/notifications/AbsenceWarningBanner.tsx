import React, { useState } from 'react';
import { Calendar, PhoneCall, ChevronRight, X, ShieldAlert, MessageSquare } from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface AbsenceRecord {
  id: string;
  date: string;
  status: string;
  batches?: {
    name?: string;
    start_time?: string;
    end_time?: string;
  };
}

interface AbsenceWarningBannerProps {
  records?: AbsenceRecord[];
  absentCount?: number;
  coachPhone?: string;
  studentName?: string;
}

export const AbsenceWarningBanner: React.FC<AbsenceWarningBannerProps> = ({
  records = [],
  absentCount = 0,
  coachPhone = '9404849500',
  studentName = 'Student',
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  // Find all absent records, sorted by date descending (latest first)
  const absentRecords = records
    .filter((r) => r.status === 'ABSENT')
    .sort((a, b) => (b.date > a.date ? 1 : -1));

  const totalAbsents = absentCount || absentRecords.length;

  if (totalAbsents === 0 || isDismissed) {
    return null;
  }

  const latestAbsence = absentRecords[0];
  const formattedLatestDate = latestAbsence?.date
    ? new Date(latestAbsence.date).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Recent Class';

  const batchName = latestAbsence?.batches?.name || 'MMA & Combat Sparring (Kalarippayattu Squad)';
  const batchTime = latestAbsence?.batches?.start_time
    ? `${latestAbsence.batches.start_time.slice(0, 5)} - ${latestAbsence.batches.end_time?.slice(0, 5)}`
    : 'Morning Training';

  const whatsappMessage = encodeURIComponent(
    `🥋 Gurukul Sports Academy - Absence Reason Note\nStudent: ${studentName}\nDate of Absence: ${formattedLatestDate}\nBatch: ${batchName}\n\nHi Sensei, I would like to submit my absence reason for this session.`
  );
  const whatsappUrl = `https://wa.me/91${coachPhone.replace(/\D/g, '').slice(-10)}?text=${whatsappMessage}`;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-r from-rose-950/80 via-red-950/70 to-slate-900 border-2 border-rose-500/60 p-4 md:p-5 shadow-xl shadow-rose-950/30 transition-all animate-in fade-in duration-300"
    >
      {/* Background Accent Glow */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-3.5">
        <div className="flex items-start gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-11 md:h-11 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 shadow-inner">
            <ShieldAlert className="w-5 h-5 md:w-6 md:h-6 text-rose-400 animate-pulse" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white shadow-sm">
                Action Required
              </span>
              <h3 className="text-sm md:text-base font-black text-rose-200 tracking-tight">
                Absence Alert: {totalAbsents} Unexcused Absence{totalAbsents > 1 ? 's' : ''} Recorded
              </h3>
            </div>

            <p className="text-xs text-rose-100/90 leading-relaxed max-w-2xl">
              You were marked <strong className="text-white font-bold underline decoration-rose-400">ABSENT</strong> on{' '}
              <strong className="text-white">{formattedLatestDate}</strong> in{' '}
              <span className="text-rose-200 font-semibold">{batchName}</span> ({batchTime}).
            </p>

            <p className="text-[11px] text-rose-300/80 mt-1">
              Minimum 80% attendance is mandatory for Belt Grading Exams and State Championship Selection.
            </p>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={() => setIsDismissed(true)}
          className="absolute top-2 right-2 p-1.5 rounded-lg text-rose-300/70 hover:text-white hover:bg-rose-900/40 transition-colors"
          title="Dismiss alert for now"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Action Buttons */}
      <div className="mt-3.5 pt-3 border-t border-rose-500/20 flex flex-wrap items-center gap-2.5">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-rose-900/40 transition-all"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Inform Sensei on WhatsApp</span>
        </a>

        <a
          href={`tel:+91${coachPhone.replace(/\D/g, '').slice(-10)}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-semibold transition-all"
        >
          <PhoneCall className="w-3.5 h-3.5 text-rose-400" />
          <span>Call Academy Desk</span>
        </a>

        <NavLink
          to="/student/attendance"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-medium transition-all ml-auto"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>View Full Month Calendar</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </NavLink>
      </div>
    </div>
  );
};
