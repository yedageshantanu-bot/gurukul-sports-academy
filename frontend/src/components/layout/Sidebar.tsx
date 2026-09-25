import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  Users,
  Layers,
  CheckSquare,
  CreditCard,
  Receipt,
  FileText,
  Megaphone,
  MessageSquare,
  Settings,
  UserCheck,
  CalendarDays,
  User,
  X,
  BookMarked,
  Trophy,
  Award,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { apiClient } from '../../lib/api';

interface SidebarProps {
  role: 'ADMIN' | 'TEACHER' | 'DEMO_ADMIN' | string;
  academyName?: string;
  logoUrl?: string | null;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavGroup {
  label?: string;
  items: {
    name: string;
    to: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  role,
  academyName,
  mobileOpen = false,
  onCloseMobile,
}) => {

  const isDemoHost = typeof window !== 'undefined' && (
    window.location.hostname.includes('effort-career') ||
    window.location.hostname.includes('demo') ||
    window.location.port === '3005'
  );
  const isDemo = isDemoHost || role === 'DEMO_ADMIN';
  const effectiveAcademyName = isDemo ? 'Effort Career Classes' : (academyName || 'Gurukul Sports Academy');

  const demoGroups: NavGroup[] = [
    {
      items: [
        { name: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Core Academics',
      items: [
        { name: 'Teachers', to: '/admin/teachers', icon: GraduationCap },
        { name: 'Students', to: '/admin/students', icon: Users },
        { name: 'Courses', to: '/admin/courses', icon: BookOpen },
        { name: 'Batches', to: '/admin/batches', icon: Layers },
        { name: 'Attendance', to: '/admin/attendance', icon: CheckSquare },
      ],
    },
    {
      label: 'Finance',
      items: [
        { name: 'Fees', to: '/admin/fees', icon: CreditCard },
        { name: 'Payments', to: '/admin/payments', icon: Receipt },
      ],
    },
    {
      label: 'Communication & Ops',
      items: [
        { name: 'Reports', to: '/admin/reports', icon: FileText },
        { name: 'Announcements', to: '/admin/announcements', icon: Megaphone },
        { name: 'Settings', to: '/admin/settings', icon: Settings },
      ],
    },
  ];

  const [navCounts, setNavCounts] = React.useState<{ students?: string; teachers?: string }>({});

  React.useEffect(() => {
    if (role === 'ADMIN' || role === 'DEMO_ADMIN') {
      apiClient<any>('/dashboard/admin')
        .then((res) => {
          if (res?.kpis) {
            setNavCounts({
              students: res.kpis.totalStudents ? String(res.kpis.totalStudents) : undefined,
              teachers: res.kpis.totalTeachers ? String(res.kpis.totalTeachers) : undefined,
            });
          }
        })
        .catch(() => {});
    }
  }, [role]);

  const adminGroups: NavGroup[] = [
    {
      label: 'General',
      items: [
        { name: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
        { name: 'Students', to: '/admin/students', icon: Users, badge: navCounts.students },
        { name: 'Teachers', to: '/admin/teachers', icon: GraduationCap, badge: navCounts.teachers },
      ],
    },
    {
      label: 'Academics',
      items: [
        { name: 'Courses', to: '/admin/courses', icon: BookOpen },
        { name: 'Batches', to: '/admin/batches', icon: Layers },
        { name: 'Attendance', to: '/admin/attendance', icon: CheckSquare },
      ],
    },
    {
      label: 'Dojo & Competitions',
      items: [
        { name: 'Belt & Ranks', to: '/admin/ranks', icon: Award },
        { name: 'Tournaments', to: '/admin/tournaments', icon: Trophy },
        { name: 'Publications', to: '/admin/publications', icon: BookMarked },
      ],
    },
    {
      label: 'Finance & Comms',
      items: [
        { name: 'Fees', to: '/admin/fees', icon: CreditCard },
        { name: 'Payments', to: '/admin/payments', icon: Receipt },
        { name: 'Reports', to: '/admin/reports', icon: FileText },
        { name: 'Announcements', to: '/admin/announcements', icon: Megaphone },
        { name: 'WhatsApp', to: '/admin/whatsapp-templates', icon: MessageSquare },
        { name: 'Settings', to: '/admin/settings', icon: Settings },
      ],
    },
  ];

  const teacherGroups: NavGroup[] = [
    {
      label: 'General',
      items: [
        { name: 'Dashboard', to: '/teacher/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Academic Operations',
      items: [
        { name: 'My Batches', to: '/teacher/batches', icon: Layers },
        { name: 'Mark Attendance', to: '/teacher/attendance', icon: UserCheck },
        { name: 'Attendance History', to: '/teacher/attendance-history', icon: CalendarDays },
      ],
    },
    {
      label: 'Account',
      items: [
        { name: 'Profile', to: '/teacher/profile', icon: User },
      ],
    },
  ];

  const groups = role === 'DEMO_ADMIN' ? demoGroups : role === 'ADMIN' ? adminGroups : teacherGroups;

  return (
    <>
      {/* Mobile backdrop overlay */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'w-64 bg-[#0A1120] text-slate-200 border-r border-white/10 flex flex-col flex-shrink-0 h-screen transition-transform duration-200 ease-in-out z-50 shadow-xl',
          'fixed inset-y-0 left-0 lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand Header */}
        <div className="h-[78px] flex items-center justify-between px-4 border-b border-white/10 gap-3 flex-shrink-0 bg-[#0A1120]">
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src="/logo.png"
              alt={effectiveAcademyName}
              className="w-14 h-14 object-contain flex-shrink-0 drop-shadow-md"
              onError={(e) => {
                // fallback if missing
                (e.currentTarget as HTMLImageElement).src = '/gurukul-logo.png';
              }}
            />
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold text-white truncate leading-tight tracking-tight">
                {effectiveAcademyName}
              </h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">
                  ATHLETICS & DOJO
                </span>
              </div>
            </div>
          </div>

          {/* Close button on mobile */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close Sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Nav List with Section Groupings */}
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto min-h-0">
          {groups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              {group.label && (
                <div className="px-3 pb-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {group.label}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onCloseMobile}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] font-medium transition-all duration-150 group',
                        isActive
                          ? 'bg-[#F97316] text-white font-semibold shadow-md shadow-orange-500/35'
                          : 'text-slate-400 hover:bg-[#273549] hover:text-white'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={cn(
                            'w-[18px] h-[18px] flex-shrink-0 transition-transform duration-150',
                            isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                          )}
                        />
                        <span className="truncate flex-1">{item.name}</span>
                        {item.badge && (
                          <span
                            className={cn(
                              'text-[10px] font-bold px-2 py-0.5 rounded-full',
                              isActive
                                ? 'bg-white/20 text-white'
                                : 'bg-[#334155] text-slate-300'
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer Area - Stitch Academy Engine v2.4 */}
        <div className="p-4 border-t border-white/10 bg-[#0A1120] flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
            <span className="font-medium">Academy Engine v2.4</span>
          </div>
        </div>
      </aside>
    </>
  );
};
