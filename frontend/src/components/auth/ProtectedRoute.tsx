import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingScreen } from '../common/LoadingScreen';

export const AdminRoute: React.FC = () => {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      setLoadingTimedOut(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading && !loadingTimedOut) {
    return <LoadingScreen message="Gurukul Sports Academy" subMessage="Verifying administrator access..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role === 'ADMIN' || role === 'DEMO_ADMIN') {
    return <Outlet />;
  }

  if (role === 'TEACHER') {
    return <Navigate to="/teacher/dashboard" replace />;
  }

  if (role === 'STUDENT') {
    return <Navigate to="/student/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
};

export const TeacherRoute: React.FC = () => {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      setLoadingTimedOut(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading && !loadingTimedOut) {
    return <LoadingScreen message="Gurukul Sports Academy" subMessage="Verifying teacher access..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role === 'TEACHER') {
    return <Outlet />;
  }

  if (role === 'ADMIN' || role === 'DEMO_ADMIN') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (role === 'STUDENT') {
    return <Navigate to="/student/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
};

export const StudentRoute: React.FC = () => {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      setLoadingTimedOut(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading && !loadingTimedOut) {
    return <LoadingScreen message="Gurukul Sports Academy" subMessage="Loading student portal..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role === 'STUDENT') {
    return <Outlet />;
  }

  if (role === 'ADMIN' || role === 'DEMO_ADMIN') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (role === 'TEACHER') {
    return <Navigate to="/teacher/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
};

