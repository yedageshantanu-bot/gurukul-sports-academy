import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface AppLayoutProps {
  role: 'ADMIN' | 'TEACHER' | 'DEMO_ADMIN';
  userName?: string;
  academyName?: string;
  logoUrl?: string | null;
  isTrial?: boolean;
  daysRemaining?: number;
  onLogout?: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  role,
  userName = 'Admin User',
  academyName,
  logoUrl,
  isTrial = false,
  daysRemaining = 3,
  onLogout,
}) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isDemoHost = typeof window !== 'undefined' && (
    window.location.hostname.includes('effort-career') ||
    window.location.hostname.includes('demo') ||
    window.location.port === '3005'
  );
  const isDemo = isDemoHost || role === 'DEMO_ADMIN' || isTrial;
  const effectiveRole = isDemo ? 'DEMO_ADMIN' : role;
  const effectiveAcademyName = isDemo ? 'Effort Career Classes' : (academyName || 'Gurukul Sports Academy');
  const effectiveLogoUrl = isDemo ? '/effort-career-logo.png' : (logoUrl && !logoUrl.includes('effort-career') ? logoUrl : '/logo.png');

  return (
    <div className="flex h-screen bg-[#0F172A] font-sans antialiased text-slate-100 overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        role={effectiveRole}
        academyName={effectiveAcademyName}
        logoUrl={effectiveLogoUrl}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[#0F172A]">
        <Header
          userRole={effectiveRole}
          userName={userName}
          academyName={effectiveAcademyName}
          logoUrl={effectiveLogoUrl}
          isTrial={isTrial || isDemo}
          daysRemaining={daysRemaining}
          onLogout={onLogout}
          onToggleMobileSidebar={() => setMobileSidebarOpen((prev) => !prev)}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 bg-[#0F172A]">
          <div className="max-w-[1600px] w-full mx-auto pb-16">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
