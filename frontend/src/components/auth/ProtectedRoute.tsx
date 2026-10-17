import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

import { LoadingScreen } from '../common/LoadingScreen';

export const AdminRoute: React.FC = () => {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen message="Gurukul Sports Academy" subMessage="Verifying administrator access..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role !== 'ADMIN' && role !== 'DEMO_ADMIN') {
    // Authenticated user is not an Admin; redirect to Teacher portal
    return <Navigate to="/teacher/dashboard" replace />;
  }

  return <Outlet />;
};

export const TeacherRoute: React.FC = () => {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen message="Gurukul Sports Academy" subMessage="Verifying teacher access..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role !== 'TEACHER') {
    // Authenticated user is an Admin; redirect to Admin portal
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Outlet />;
};

export const StudentRoute: React.FC = () => {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen message="Gurukul Sports Academy" subMessage="Loading student portal..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role !== 'STUDENT') {
    return <Navigate to={role === 'TEACHER' ? '/teacher/dashboard' : '/admin/dashboard'} replace />;
  }

  return <Outlet />;
};

