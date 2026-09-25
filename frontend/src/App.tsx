import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { AdminRoute, TeacherRoute } from './components/auth/ProtectedRoute';
import { Login } from './pages/auth/Login';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { TeachersPage } from './pages/admin/TeachersPage';
import { StudentsPage } from './pages/admin/StudentsPage';
import { CoursesPage } from './pages/admin/CoursesPage';
import { StudentProfilePage } from './pages/admin/StudentProfilePage';
import { BatchesPage } from './pages/admin/BatchesPage';
import { AttendancePage } from './pages/admin/AttendancePage';
import { FeesPage } from './pages/admin/FeesPage';
import { PaymentsPage } from './pages/admin/PaymentsPage';
import { WhatsAppPage } from './pages/admin/WhatsAppPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { AnnouncementsPage } from './pages/admin/AnnouncementsPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { TeacherDashboard } from './pages/teacher/TeacherDashboard';
import { TeacherBatchesPage } from './pages/teacher/TeacherBatchesPage';
import { MarkAttendancePage } from './pages/teacher/MarkAttendancePage';
import { AttendanceHistoryPage } from './pages/teacher/AttendanceHistoryPage';
import { TeacherProfilePage } from './pages/teacher/TeacherProfilePage';
import { TeacherProfilePage as AdminTeacherProfilePage } from './pages/admin/TeacherProfilePage';
import { PublicationsPage } from './pages/admin/PublicationsPage';
import { TournamentsPage } from './pages/admin/TournamentsPage';
import { RanksPage } from './pages/admin/RanksPage';
import { AppLayout } from './components/layout/AppLayout';

import { ErrorBoundary } from './components/common/ErrorBoundary';
import { LoadingScreen } from './components/common/LoadingScreen';

const queryClient = new QueryClient();

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

  return <Navigate to="/teacher/dashboard" replace />;
};

// Admin Layout wrapper passing auth & dynamic branding state
const AdminLayoutWrapper: React.FC = () => {
  const { profile, role, logout } = useAuth();
  const { academyName, logoUrl } = useSettings();

  const isDemoHost = typeof window !== 'undefined' && (
    window.location.hostname.includes('effort-career') ||
    window.location.hostname.includes('demo') ||
    window.location.port === '3005'
  );
  const isDemo = isDemoHost || role === 'DEMO_ADMIN' || profile?.role === 'DEMO_ADMIN' || profile?.isTrial;
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
