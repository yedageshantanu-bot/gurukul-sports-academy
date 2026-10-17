import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, AlertCircle, MessageSquare, Phone, Smartphone, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { Button } from '../../components/ui/Button';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromDestination = (location.state as any)?.from?.pathname;

  const { login, studentLogin, isAuthenticated, role } = useAuth();
  const { settings } = useSettings();

  const [loginType, setLoginType] = useState<'STUDENT' | 'STAFF'>('STUDENT');
  const [email, setEmail] = useState('');
  const [studentMobile, setStudentMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTrialExpired, setIsTrialExpired] = useState(false);

  const [autoLoggingIn, setAutoLoggingIn] = useState(false);

  // If already authenticated, redirect to appropriate portal
  React.useEffect(() => {
    // If user arrived due to session expiration, do NOT auto-redirect!
    if (location.search.includes('expired=1')) {
      setErrorMessage('Your session has expired. Please log in again to resume.');
      return;
    }

    // Check for Magic Link / Auto-Login Query Parameters
    const params = new URLSearchParams(location.search);
    const phoneParam = params.get('phone');
    const pinParam = params.get('pin') || params.get('password');
    const autoLoginFlag = params.get('autologin');

    if (phoneParam) {
      setLoginType('STUDENT');
      setStudentMobile(phoneParam);
      if (pinParam) {
        setPassword(pinParam);
      }
      if (pinParam && (autoLoginFlag === '1' || autoLoginFlag === 'true')) {
        setAutoLoggingIn(true);
        setIsLoading(true);
        studentLogin(phoneParam.trim(), pinParam)
          .then(() => {
            navigate('/student/dashboard', { replace: true });
          })
          .catch((err: any) => {
            setAutoLoggingIn(false);
            setIsLoading(false);
            setErrorMessage(err.message || 'Auto-login failed. Please enter your credentials manually.');
          });
        return;
      }
    }

    if (isAuthenticated && role) {
      if (fromDestination && fromDestination !== '/login') {
        navigate(fromDestination, { replace: true });
      } else if (role === 'ADMIN' || role === 'DEMO_ADMIN') {
        navigate('/admin/dashboard', { replace: true });
      } else if (role === 'TEACHER') {
        navigate('/teacher/dashboard', { replace: true });
      } else if (role === 'STUDENT') {
        navigate('/student/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, role, navigate, fromDestination, location.search, studentLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setErrorMessage(null);
    setIsTrialExpired(false);

    // Basic client validation based on login type
    if (loginType === 'STAFF') {
      if (!email.trim()) {
        setErrorMessage('Please enter your email address.');
        return;
      }
    } else {
      if (!studentMobile.trim()) {
        setErrorMessage('Please enter your 10-digit registered mobile number.');
        return;
      }
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      if (loginType === 'STUDENT') {
        const cleanMobile = studentMobile.trim();
        await studentLogin(cleanMobile, password);
        navigate('/student/dashboard', { replace: true });
      } else {
        const result = await login(email.trim(), password);
        if (fromDestination && fromDestination !== '/login') {
          navigate(fromDestination, { replace: true });
        } else if (result.role === 'ADMIN' || result.role === 'DEMO_ADMIN') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate('/teacher/dashboard', { replace: true });
        }
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('trial has ended') || msg.includes('TRIAL_EXPIRED')) {
        setIsTrialExpired(true);
        setErrorMessage('Your 3-day trial has ended. Please contact us to continue using Academy CRM.');
      } else {
        setErrorMessage(msg || 'Authentication failed. Please verify your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isDemoHost = typeof window !== 'undefined' && (
    window.location.hostname.includes('effort-career') ||
    window.location.hostname.includes('demo') ||
    window.location.port === '3005'
  );
  const academyName = isDemoHost
    ? (settings?.academy_name && settings.academy_name !== 'Apex Academy' ? settings.academy_name : 'Effort Career Classes')
    : (settings?.academy_name || 'Gurukul Sports Academy');
  const logoSrc = isDemoHost
    ? (settings?.logo_url || '/effort-career-logo.png')
    : (settings?.logo_url && !settings.logo_url.includes('effort-career') ? settings.logo_url : '/logo.png');

  React.useEffect(() => {
    if (isDemoHost && !email) {
      setEmail('demo@effortcareerclasses.com');
      setPassword('EffortTrial@2026!');
    }
  }, [isDemoHost]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0F172A] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors">
      {/* Decorative background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-indigo-100/40 via-purple-50/20 to-transparent dark:from-indigo-900/20 dark:via-purple-900/10 blur-3xl pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-200/20 dark:bg-indigo-800/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-200/20 dark:bg-purple-800/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center mb-1">
            <img
              src={logoSrc}
              alt={academyName}
              className="w-20 h-20 object-contain"
              onError={(e) => {
                e.currentTarget.src = isDemoHost ? '/effort-career-logo.png' : '/logo.png';
              }}
            />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {academyName}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {loginType === 'STUDENT' ? 'Student Mobile App & Parent Portal' : 'Administrator & Coach Management Portal'}
          </p>
        </div>

        {/* Login Card */}
        <div className="mt-6 bg-white/95 dark:bg-slate-900/90 backdrop-blur-sm py-6 px-6 shadow-card border border-slate-200/80 dark:border-slate-800 rounded-3xl sm:px-8">
          {/* Tab Selector */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-950/70 rounded-2xl mb-6 border border-slate-200 dark:border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setLoginType('STUDENT');
                setErrorMessage(null);
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                loginType === 'STUDENT'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Student App
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginType('STAFF');
                setErrorMessage(null);
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                loginType === 'STAFF'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin / Staff
            </button>
          </div>

          {/* Demo Account Helper for Demo Host */}
          {isDemoHost && loginType === 'STAFF' && (
            <div className="mb-5 p-3.5 bg-indigo-50/80 dark:bg-indigo-950/40 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 block truncate">Demo Access (Effort Career Classes)</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">demo@effortcareerclasses.com</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('demo@effortcareerclasses.com');
                    setPassword('EffortTrial@2026!');
                  }}
                  className="px-2.5 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs transition-transform active:scale-95 cursor-pointer flex-shrink-0"
                >
                  Auto-Fill
                </button>
              </div>
            </div>
          )}

          {/* Error / Expiry Banner */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs animate-in fade-in duration-150">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
                <div className="flex-1 font-medium">{errorMessage}</div>
              </div>
              {isTrialExpired && (
                <div className="mt-3 pt-3 border-t border-rose-200 dark:border-rose-800/80 flex items-center justify-end">
                  <a
                    href="https://wa.me/919404849500?text=Hi,%20our%20Effort%20Career%20Classes%20trial%20has%20ended.%20We%20would%20like%20to%20continue%20using%20Academy%20CRM."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Contact Support on WhatsApp
                  </a>
                </div>
              )}
            </div>
          )}

          {autoLoggingIn ? (
            <div className="py-10 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 animate-pulse">
                <Smartphone className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Logging in to Student App...
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Verifying 1-Tap Auto-Login for <span className="font-semibold text-slate-800 dark:text-slate-200">{studentMobile}</span>
                </p>
              </div>
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mt-2" />
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {loginType === 'STUDENT' ? (
              /* Student Mobile Number */
              <div>
                <label htmlFor="studentMobile" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Registered Mobile Number
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                    <Phone className="h-4 w-4" />
                  </div>
                  <input
                    id="studentMobile"
                    name="studentMobile"
                    type="tel"
                    autoComplete="tel"
                    disabled={isLoading}
                    value={studentMobile}
                    onChange={(e) => setStudentMobile(e.target.value)}
                    className="block w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/30 focus:border-blue-600 dark:focus:border-blue-500 transition-colors disabled:bg-slate-50 dark:disabled:bg-slate-900/50"
                    placeholder="Enter 10-digit mobile number"
                    maxLength={13}
                  />
                </div>
              </div>
            ) : (
              /* Staff Email Field */
              <div>
                <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Staff Email
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    disabled={isLoading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-500/30 focus:border-indigo-600 dark:focus:border-indigo-500 transition-colors disabled:bg-slate-50 dark:disabled:bg-slate-900/50"
                    placeholder="admin@gurukulsports.in"
                  />
                </div>
              </div>
            )}

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {loginType === 'STUDENT' ? 'Password / PIN' : 'Password'}
                </label>
              </div>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-11 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-500/30 focus:border-indigo-600 dark:focus:border-indigo-500 transition-colors disabled:bg-slate-50 dark:disabled:bg-slate-900/50"
                  placeholder={loginType === 'STUDENT' ? 'Password received on WhatsApp' : '••••••••'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Student WhatsApp Note */}
            {loginType === 'STUDENT' && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                💬 <strong>Need login details?</strong> Check your WhatsApp message sent by Gurukul Sports Academy with your initial password/PIN.
              </p>
            )}

            {/* Submit Button */}
            <div className="pt-1">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                className="w-full justify-center shadow-glow font-semibold py-2.5"
              >
                {loginType === 'STUDENT' ? 'Log In to Student App 📲' : 'Staff Sign In'}
              </Button>
            </div>
          </form>
          )}
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            <span>Secure 256-bit encrypted authentication</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
