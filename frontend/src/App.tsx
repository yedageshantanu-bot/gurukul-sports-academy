import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { AdminRoute, TeacherRoute, StudentRoute } from './components/auth/ProtectedRoute';
import { Login } from './pages/auth/Login';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { AppLayout } from './components/layout/AppLayout';
import { StudentLayout } from './components/layout/StudentLayout';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { LoadingScreen } from './components/common/LoadingScreen';

// Lazy-loaded Admin Pages (Code-splitting)
const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const TeachersPage = React.lazy(() => import('./pages/admin/TeachersPage').then((m) => ({ default: m.TeachersPage })));
const AdminTeacherProfilePage = React.lazy(() => import('./pages/admin/TeacherProfilePage').then((m) => ({ default: m.TeacherProfilePage })));
const StudentsPage = React.lazy(() => import('./pages/admin/StudentsPage').then((m) => ({ default: m.StudentsPage })));
const StudentProfilePage = React.lazy(() => import('./pages/admin/StudentProfilePage').then((m) => ({ default: m.StudentProfilePage })));
const CoursesPage = React.lazy(() => import('./pages/admin/CoursesPage').then((m) => ({ default: m.CoursesPage })));
const BatchesPage = React.lazy(() => import('./pages/admin/BatchesPage').then((m) => ({ default: m.BatchesPage })));
const AttendancePage = React.lazy(() => import('./pages/admin/AttendancePage').then((m) => ({ default: m.AttendancePage })));
const PublicationsPage = React.lazy(() => import('./pages/admin/PublicationsPage').then((m) => ({ default: m.PublicationsPage })));
const TournamentsPage = React.lazy(() => import('./pages/admin/TournamentsPage').then((m) => ({ default: m.TournamentsPage })));
const RanksPage = React.lazy(() => import('./pages/admin/RanksPage').then((m) => ({ default: m.RanksPage })));
const FeesPage = React.lazy(() => import('./pages/admin/FeesPage').then((m) => ({ default: m.FeesPage })));
const PaymentsPage = React.lazy(() => import('./pages/admin/PaymentsPage').then((m) => ({ default: m.PaymentsPage })));
const ReportsPage = React.lazy(() => import('./pages/admin/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const AnnouncementsPage = React.lazy(() => import('./pages/admin/AnnouncementsPage').then((m) => ({ default: m.AnnouncementsPage })));
const WhatsAppPage = React.lazy(() => import('./pages/admin/WhatsAppPage').then((m) => ({ default: m.WhatsAppPage })));
const SettingsPage = React.lazy(() => import('./pages/admin/SettingsPage').then((m) => ({ default: m.SettingsPage })));

// Lazy-loaded Teacher Pages (Code-splitting)
const TeacherDashboard = React.lazy(() => import('./pages/teacher/TeacherDashboard').then((m) => ({ default: m.TeacherDashboard })));
const TeacherBatchesPage = React.lazy(() => import('./pages/teacher/TeacherBatchesPage').then((m) => ({ default: m.TeacherBatchesPage })));
const MarkAttendancePage = React.lazy(() => import('./pages/teacher/MarkAttendancePage').then((m) => ({ default: m.MarkAttendancePage })));
const AttendanceHistoryPage = React.lazy(() => import('./pages/teacher/AttendanceHistoryPage').then((m) => ({ default: m.AttendanceHistoryPage })));
const TeacherProfilePage = React.lazy(() => import('./pages/teacher/TeacherProfilePage').then((m) => ({ default: m.TeacherProfilePage })));

// Lazy-loaded Student PWA Pages (Code-splitting)
const StudentDashboard = React.lazy(() => import('./pages/student/StudentDashboard').then((m) => ({ default: m.StudentDashboard })));
const StudentAttendancePage = React.lazy(() => import('./pages/student/StudentAttendancePage').then((m) => ({ default: m.StudentAttendancePage })));
const StudentFeesPage = React.lazy(() => import('./pages/student/StudentFeesPage').then((m) => ({ default: m.StudentFeesPage })));
const StudentAnnouncementsPage = React.lazy(() => import('./pages/student/StudentAnnouncementsPage').then((m) => ({ default: m.StudentAnnouncementsPage })));
const StudentSettingsPage = React.lazy(() => import('./pages/student/StudentSettingsPage').then((m) => ({ default: m.StudentSettingsPage })));

// Client-side cache configuration: 60s staleTime prevents re-render thrashing & spinner flickers
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // Data remains fresh for 60 seconds
      gcTime: 10 * 60 * 1000, // Retain cache for 10 minutes
      refetchOnWindowFocus: false, // Prevent jarring layout refetches on window focus
      retry: 1,
    },
  },
});

// Authenticated root redirector
const RootRedirect: React.FC = () => {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return <LoadingScreen message="Gurukul Sports Academy" subMessage="Preparing portal..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'ADMIN' || role === 'DEMO_ADMIN') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (role === 'STUDENT') {
    return <Navigate to="/student/dashboard" replace />;
  }

  return <Navigate to="/teacher/dashboard" replace />;
};

// Admin Layout wrapper passing auth & dynamic branding state
const AdminLayoutWrapper: React.FC = () => {
  const { profile, role, logout } = useAuth();
  const { academyName, logoUrl } = useSettings();

  const isDemoHost = typeof window !== 'undefined' && (
    window.location.hostname.includes('effort-career') ||
    window.location.port === '3005'
  );
  const isDemo = isDemoHost || role === 'DEMO_ADMIN' || profile?.role === 'DEMO_ADMIN';
  const effectiveRole = (isDemo ? 'DEMO_ADMIN' : 'ADMIN') as 'ADMIN' | 'DEMO_ADMIN';
  const displayLogo = isDemo ? '/effort-career-logo.png' : (logoUrl && !logoUrl.includes('effort-career') ? logoUrl : '/logo.png');
  const displayName = isDemo ? 'Effort Career Classes' : academyName;

  return (
    <AppLayout
      role={effectiveRole}
      userName={profile?.fullName || (isDemo ? 'Effort Admin' : 'Administrator')}
      academyName={displayName}
      logoUrl={displayLogo}
      isTrial={Boolean(profile?.isTrial || isDemo)}
      daysRemaining={profile?.daysRemaining ?? 3}
      onLogout={logout}
    />
  );
};

// WhatsApp Route Guard: accessible by ADMIN and DEMO_ADMIN
const WhatsAppRouteGuard: React.FC = () => {
  return <WhatsAppPage />;
};

// Teacher Layout wrapper passing auth & dynamic branding state
const TeacherLayoutWrapper: React.FC = () => {
  const { profile, logout } = useAuth();
  const { academyName, logoUrl } = useSettings();

  return (
    <AppLayout
      role="TEACHER"
      userName={profile?.fullName || 'Instructor'}
      academyName={academyName}
      logoUrl={logoUrl}
      onLogout={logout}
    />
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <SettingsProvider>
              <ToastProvider>
                <BrowserRouter>
                  <Routes>
                    {/* Root Navigation */}
                    <Route path="/" element={<RootRedirect />} />

                    {/* Public Authentication Routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />

                    {/* Protected Admin Routes */}
                    <Route element={<AdminRoute />}>
                      <Route element={<AdminLayoutWrapper />}>
                        <Route path="/admin/dashboard" element={<AdminDashboard />} />
                        <Route path="/admin/teachers" element={<TeachersPage />} />
                        <Route path="/admin/teachers/:id" element={<AdminTeacherProfilePage />} />
                        <Route path="/admin/students" element={<StudentsPage />} />
                        <Route path="/admin/students/:id" element={<StudentProfilePage />} />
                        <Route path="/admin/courses" element={<CoursesPage />} />
                        <Route path="/admin/batches" element={<BatchesPage />} />
                        <Route path="/admin/attendance" element={<AttendancePage />} />
                        <Route path="/admin/publications" element={<PublicationsPage />} />
                        <Route path="/admin/tournaments" element={<TournamentsPage />} />
                        <Route path="/admin/ranks" element={<RanksPage />} />
                        <Route path="/admin/fees" element={<FeesPage />} />
                        <Route path="/admin/payments" element={<PaymentsPage />} />
                        <Route path="/admin/reports" element={<ReportsPage />} />
                        <Route path="/admin/announcements" element={<AnnouncementsPage />} />
                        <Route path="/admin/whatsapp-templates" element={<WhatsAppRouteGuard />} />
                        <Route path="/admin/whatsapp" element={<WhatsAppRouteGuard />} />
                        <Route path="/admin/settings" element={<SettingsPage />} />
                        <Route path="/admin/*" element={<AdminDashboard />} />
                      </Route>
                    </Route>

                    {/* Protected Teacher Routes */}
                    <Route element={<TeacherRoute />}>
                      <Route element={<TeacherLayoutWrapper />}>
                        <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
                        <Route path="/teacher/batches" element={<TeacherBatchesPage />} />
                        <Route path="/teacher/attendance" element={<MarkAttendancePage />} />
                        <Route path="/teacher/attendance-history" element={<AttendanceHistoryPage />} />
                        <Route path="/teacher/profile" element={<TeacherProfilePage />} />
                        <Route path="/teacher/*" element={<TeacherDashboard />} />
                      </Route>
                    </Route>

                    {/* Protected Student PWA Routes */}
                    <Route element={<StudentRoute />}>
                      <Route element={<StudentLayout />}>
                        <Route path="/student/dashboard" element={<StudentDashboard />} />
                        <Route path="/student/attendance" element={<StudentAttendancePage />} />
                        <Route path="/student/fees" element={<StudentFeesPage />} />
                        <Route path="/student/announcements" element={<StudentAnnouncementsPage />} />
                        <Route path="/student/settings" element={<StudentSettingsPage />} />
                        <Route path="/student/*" element={<StudentDashboard />} />
                      </Route>
                    </Route>

                    {/* Catch-all fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </BrowserRouter>
              </ToastProvider>
            </SettingsProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
