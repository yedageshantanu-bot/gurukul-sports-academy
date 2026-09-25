import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LogOut, Menu, HelpCircle } from 'lucide-react';
import { NeedHelpModal } from '../common/NeedHelpModal';

interface HeaderProps {
  userName?: string;
  userRole: 'ADMIN' | 'TEACHER' | 'DEMO_ADMIN';
  academyName?: string;
  logoUrl?: string | null;
  isTrial?: boolean;
  daysRemaining?: number;
  onLogout?: () => void;
  onToggleMobileSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  userName = 'User',
  userRole,
  onLogout,
  onToggleMobileSidebar,
}) => {
  const [helpOpen, setHelpOpen] = useState(false);
  const location = useLocation();

  const getPageMeta = (pathname: string) => {
    if (pathname.startsWith('/admin/teachers')) {
      return { title: 'Teachers & Coaches', subtitle: 'Manage instructors, coaching staff & specializations' };
    }
    if (pathname.startsWith('/admin/students')) {
      return { title: 'Students & Athletes', subtitle: 'Athlete enrollment roster, batches & parent WhatsApp contacts' };
    }
    if (pathname.startsWith('/admin/courses')) {
      return { title: 'Sports & Disciplines', subtitle: 'Martial arts, athletics & training programs' };
    }
    if (pathname.startsWith('/admin/batches')) {
      return { title: 'Training Batches', subtitle: 'Active squads, timings & capacity planning' };
    }
    if (pathname.startsWith('/admin/attendance')) {
      return { title: 'Attendance Register', subtitle: 'Track daily athlete presence & absence analytics' };
    }
    if (pathname.startsWith('/admin/fees')) {
      return { title: 'Fee Management', subtitle: 'Billing cycles, pending dues & collection records' };
    }
    if (pathname.startsWith('/admin/payments')) {
      return { title: 'Payment Receipts', subtitle: 'Payment logs, receipts & transaction ledger' };
    }
    if (pathname.startsWith('/admin/reports')) {
      return { title: 'Reports & Analytics', subtitle: 'Academy operations, revenue & attendance audits' };
    }
    if (pathname.startsWith('/admin/announcements')) {
      return { title: 'Announcements', subtitle: 'Academy broadcasts, tournaments & holiday alerts' };
    }
    if (pathname.startsWith('/admin/whatsapp')) {
      return { title: 'WhatsApp Automation', subtitle: 'Automated fee reminders, parent alerts & templates' };
    }
    if (pathname.startsWith('/admin/publications')) {
      return { title: 'Published Document Fees & Book Register', subtitle: 'Annual curriculum manuals, external readers & segregated fee renewals' };
    }
    if (pathname.startsWith('/admin/tournaments')) {
      return { title: 'Tournament Entry Fees & Events', subtitle: 'Championships, belt events & per-tournament athlete registrations' };
    }
    if (pathname.startsWith('/admin/ranks')) {
      return { title: 'Belt & Rank Progression', subtitle: 'Syllabus mastery, grading exams & belt promotions' };
    }
    if (pathname.startsWith('/admin/settings')) {
      return { title: 'Academy Settings', subtitle: 'Organization profile, branding & operational preferences' };
    }
    if (pathname.startsWith('/teacher/batches')) {
      return { title: 'My Training Batches', subtitle: 'Assigned sports squads & enrolled athletes' };
    }
    if (pathname.startsWith('/teacher/attendance-history')) {
      return { title: 'Attendance History', subtitle: 'Historical roll-call logs & session records' };
    }
    if (pathname.startsWith('/teacher/attendance')) {
      return { title: 'Mark Attendance', subtitle: 'Daily athlete roll call & squad check-in' };
    }
    if (pathname.startsWith('/teacher/profile')) {
      return { title: 'Instructor Profile', subtitle: 'Faculty bio, martial arts ranking & coaching details' };
    }
    if (pathname.startsWith('/teacher')) {
      return { title: 'Teacher Portal', subtitle: 'Daily coaching tasks, batch rosters & student check-ins' };
    }
    return { title: 'Dashboard', subtitle: "Overview of your academy's activities and performance" };
  };

  const { title: pageTitle, subtitle: pageSubtitle } = getPageMeta(location.pathname);

  const userInitials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2) || 'U';

  return (
    <>
      <header className="h-[78px] bg-[#0A1120] text-slate-100 border-b border-white/10 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Mobile menu toggle */}
          {onToggleMobileSidebar && (
            <button
              onClick={onToggleMobileSidebar}
              className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="flex flex-col">
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-none">
              {pageTitle}
            </h1>
            <p className="text-[11.5px] text-slate-400 mt-1 hidden sm:block">
              {pageSubtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3.5">
          {/* Search Input - Stitch style */}
          <div className="relative hidden md:block w-56 lg:w-64">
            <input
              type="text"
              placeholder="Search student, batch or fee..."
              className="w-full h-9 pl-9 pr-3 bg-[#162235] border border-white/10 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#F97316] transition-colors"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* AI Need Help? Trigger Button */}
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-semibold transition-colors cursor-pointer"
            title="Open Academy CRM AI Assistant & Support"
          >
            <HelpCircle className="w-3.5 h-3.5 text-orange-400" />
            <span>Need Help?</span>
          </button>

          {/* User Profile Pill - Stitch style */}
          <div className="flex items-center gap-2 py-1 px-2 rounded-full bg-[#1E293B] border border-white/10">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0">
              {userInitials}
            </div>
            <div className="hidden sm:flex flex-col text-left leading-none pr-1">
              <span className="text-xs font-semibold text-white truncate max-w-[110px]">
                {userName}
              </span>
              <span className="text-[9.5px] font-bold text-[#F97316] uppercase mt-0.5">
                {userRole === 'DEMO_ADMIN' ? 'Demo' : userRole === 'ADMIN' ? 'Administrator' : 'Teacher'}
              </span>
            </div>
          </div>

          {/* Logout Button */}
          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* AI Assistant Help Modal */}
      <NeedHelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
};

export default Header;
