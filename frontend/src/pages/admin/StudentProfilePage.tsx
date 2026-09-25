import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Skeleton } from '../../components/common/SkeletonLoader';
import { EmptyState } from '../../components/common/EmptyState';
import { apiClient, getApiUrl } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { StudentItem } from '../../types/crm';
import {
  ArrowLeft,
  User,
  Phone,
  MessageSquare,
  Mail,
  Calendar,
  Layers,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CreditCard,
  FileText,
  Printer,
  ChevronRight,
  TrendingUp,
  Percent,
  Award,
  Send,
} from 'lucide-react';

export const StudentProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [student, setStudent] = useState<StudentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'fees' | 'batches'>('overview');
  const [pdfSending, setPdfSending] = useState(false);
  const [pdfSendResult, setPdfSendResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSendMonthlyReport = async () => {
    if (!id) return;
    try {
      setPdfSending(true);
      setPdfSendResult(null);
      const res = await apiClient<any>(`/whatsapp/reports/send-student/${id}`, {
        method: 'POST',
      });
      if (res?.success) {
        setPdfSendResult({
          success: true,
          message: `Official Monthly PDF Report successfully dispatched to ${res.data?.recipientPhone || 'parent WhatsApp'}!`,
        });
      } else {
        setPdfSendResult({
          success: false,
          message: res?.error || 'Failed to dispatch PDF via WhatsApp socket.',
        });
      }
    } catch (err: any) {
      setPdfSendResult({
        success: false,
        message: err?.message || 'Failed to send PDF report.',
      });
    } finally {
      setPdfSending(false);
    }
  };

  const fetchStudentDetails = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      const data = await apiClient<StudentItem>(`/students/${id}`);
      setStudent(data);
    } catch (err: any) {
      console.error('Failed to load student details:', err);
      setError(err?.message || 'Could not load student profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-44 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Card className="p-8 text-center border-slate-200 dark:border-slate-800">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Student Not Found</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">{error || 'The requested student profile could not be located.'}</p>
          <Button onClick={() => navigate('/admin/students')} variant="secondary">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Students
          </Button>
        </Card>
      </div>
    );
  }

  const initials = student.name
    ? student.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2)
    : 'ST';

  const attendanceStats = student.attendanceStats || {
    totalSessions: 0,
    presentCount: 0,
    absentCount: 0,
    attendanceRate: 100,
  };

  const attendanceHistory = student.attendanceHistory || [];
  const feeHistory = student.feeHistory || [];
  const enrolledBatches = student.enrolledBatches || [];

  const handleDownloadOfficialPdf = () => {
    if (!id) return;
    const url = getApiUrl(`/whatsapp/reports/download-pdf/${id}${token ? `?token=${encodeURIComponent(token)}` : ''}`);
    const win = window.open(url, '_blank');
    if (win) {
      win.focus();
    }
  };

  const { toast } = useToast();
  const [directMsgSending, setDirectMsgSending] = useState(false);

  const sendDirectWhatsApp = async (phone: string, text: string) => {
    setDirectMsgSending(true);
    try {
      await apiClient<any>('/whatsapp/send', {
        method: 'POST',
        body: JSON.stringify({
          phone,
          message: text,
        }),
      });
      toast.success('Direct WhatsApp message dispatched to parent via OpenWA gateway!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch WhatsApp message via OpenWA');
    } finally {
      setDirectMsgSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 print:p-0">
      {/* Top Bar / Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <button
          onClick={() => navigate('/admin/students')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Students Directory
        </button>

        <div className="flex items-center gap-3">
          {student.parentWhatsapp && (
            <Button
              variant="outline"
              size="sm"
              disabled={directMsgSending}
              onClick={() =>
                sendDirectWhatsApp(
                  student.parentWhatsapp!,
                  `Hello ${student.parentName || 'Parent'}, regarding ${student.name}'s performance and training at Gurukul Sports Academy:`
                )
              }
              className="border-emerald-500/40 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              title="Send direct WhatsApp notification via OpenWA gateway"
            >
              <MessageSquare className="w-4 h-4 mr-2 text-emerald-500" />
              {directMsgSending ? 'Sending...' : 'Direct WhatsApp'}
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleSendMonthlyReport}
            disabled={pdfSending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold shadow-xs cursor-pointer"
          >
            <Send className="w-4 h-4" />
            {pdfSending ? 'Sending PDF...' : 'Send Monthly PDF on WhatsApp'}
          </Button>

          <Button variant="secondary" size="sm" onClick={handleDownloadOfficialPdf} className="gap-2">
            <Printer className="w-4 h-4" />
            Official PDF Statement
          </Button>
        </div>
      </div>

      {/* Hero Profile Banner */}
      <Card className="relative overflow-hidden border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/20 dark:from-slate-900 dark:via-slate-900/90 dark:to-indigo-950/20 shadow-card">
        <div className="p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-sky-600 text-white flex items-center justify-center font-black text-2xl sm:text-3xl shadow-lg shadow-indigo-500/20 flex-shrink-0">
              {initials}
            </div>

            {/* Identity Info */}
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {student.name}
                </h1>
                <StatusBadge status={student.status} />
                {student.whatsappOptIn !== false ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    WhatsApp Opt-In
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <XCircle className="w-3.5 h-3.5" />
                    Opted Out
                  </span>
                )}
              </div>

              {student.course && (
                <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1.5">
                  <Award className="w-4 h-4" />
                  {student.course}
                </p>
              )}

              {/* Quick Contact Chips */}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                {student.parentName && (
                  <span className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Parent: <strong className="text-slate-800 dark:text-slate-200">{student.parentName}</strong>
                  </span>
                )}

                {student.parentWhatsapp && (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-lg border border-emerald-200/80 dark:border-emerald-800">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    WA: {student.parentWhatsapp}
                  </span>
                )}

                {student.studentMobile && (
                  <span className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    Mob: {student.studentMobile}
                  </span>
                )}

                {student.admissionDate && (
                  <span className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Enrolled: {new Date(student.admissionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Attendance Rate */}
        <Card className="p-5 border-slate-200/80 dark:border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Attendance Rate</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {attendanceStats.attendanceRate}%
            </span>
            <span className="text-xs text-slate-500 font-medium">
              ({attendanceStats.presentCount}/{attendanceStats.totalSessions} sessions)
            </span>
          </div>
          {/* Visual Progress Bar */}
          <div className="mt-3 w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                attendanceStats.attendanceRate >= 80
                  ? 'bg-emerald-500'
                  : attendanceStats.attendanceRate >= 60
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${attendanceStats.attendanceRate}%` }}
            />
          </div>
        </Card>

        {/* Enrolled Batches */}
        <Card className="p-5 border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Batches</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {enrolledBatches.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Active Enrollment{enrolledBatches.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 truncate">
            {enrolledBatches[0]?.name ? `Primary: ${enrolledBatches[0].name}` : 'No batch assigned'}
          </div>
        </Card>

        {/* Monthly Fee */}
        <Card className="p-5 border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tuition Fee</span>
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              ₹{Number(student.monthlyFee || 0).toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-slate-500 font-medium">/ month</span>
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Due every {student.feeDueDay || 5}th of the month
          </div>
        </Card>

        {/* Current Month Fee Status */}
        <Card className="p-5 border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Current Month Fee</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {student.currentMonthFeeStatus === 'PAID' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                PAID IN FULL
              </span>
            )}
            {student.currentMonthFeeStatus === 'PARTIAL' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                PARTIAL (₹{student.currentMonthPendingAmount} due)
              </span>
            )}
            {student.currentMonthFeeStatus === 'PENDING' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
                PENDING (₹{student.currentMonthPendingAmount || student.monthlyFee} due)
              </span>
            )}
            {student.currentMonthFeeStatus === 'OVERDUE' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">
                OVERDUE (₹{student.currentMonthPendingAmount || student.monthlyFee} due)
              </span>
            )}
            {(!student.currentMonthFeeStatus || student.currentMonthFeeStatus === 'NOT_ASSIGNED') && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                No Fee Bill Generated
              </span>
            )}
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Billing Period: {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
          </div>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-sm font-semibold print:hidden">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <User className="w-4 h-4" />
          General Overview
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'attendance'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Attendance Records ({attendanceHistory.length})
        </button>

        <button
          onClick={() => setActiveTab('batches')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'batches'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Enrolled Batches ({enrolledBatches.length})
        </button>

        <button
          onClick={() => setActiveTab('fees')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'fees'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Fee History ({feeHistory.length})
        </button>
      </div>

      {/* TAB CONTENT: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Details Card */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 border-slate-200/80 dark:border-slate-800 shadow-card">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                Comprehensive Student Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400 block mb-0.5">Full Student Name</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{student.name}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400 block mb-0.5">Parent / Guardian</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{student.parentName || 'Not specified'}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400 block mb-0.5">Parent WhatsApp</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {student.parentWhatsapp || 'None'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400 block mb-0.5">Student Mobile</span>
                  <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {student.studentMobile || 'None'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400 block mb-0.5">Email Address</span>
                  <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {student.email || 'None'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400 block mb-0.5">Course / Stream</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{student.course || 'General'}</span>
                </div>
              </div>
            </Card>

            {/* Recent Attendance Preview */}
            <Card className="p-6 border-slate-200/80 dark:border-slate-800 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  Recent Attendance Logs
                </h3>
                <button
                  onClick={() => setActiveTab('attendance')}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  View all ({attendanceHistory.length}) <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {attendanceHistory.length === 0 ? (
                <EmptyState
                  icon={Calendar}
                  title="No attendance recorded yet"
                  description="Attendance marked by teachers during class sessions will show up here automatically."
                />
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {attendanceHistory.slice(0, 5).map((att) => (
                    <div key={att.id} className="py-3 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white block">
                          {new Date(att.attendanceDate).toLocaleDateString('en-IN', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="text-xs text-slate-400">{att.batchName}</span>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                          att.status === 'PRESENT'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                        }`}
                      >
                        {att.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right Col: PDF & Automation Box */}
          <div className="space-y-6">
            <Card className="p-6 border-indigo-200/80 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/50 to-white dark:from-slate-900 dark:to-indigo-950/30 shadow-card">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-4 shadow-md shadow-indigo-600/20">
                <FileText className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Monthly Progress & Fee PDF
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                Parents receive an official monthly statement PDF directly to their WhatsApp: Batch names & schedule, attendance rate %, and fee receipt status.
              </p>

              {pdfSendResult && (
                <div
                  className={`mt-3 p-3 rounded-xl text-xs font-semibold ${
                    pdfSendResult.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {pdfSendResult.message}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-indigo-100 dark:border-indigo-900/60 flex flex-col gap-2.5">
                <Button
                  size="sm"
                  onClick={handleSendMonthlyReport}
                  disabled={pdfSending}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {pdfSending ? 'Dispatching PDF to WhatsApp...' : 'Send PDF to Parent WhatsApp'}
                </Button>

                <Button size="sm" variant="secondary" onClick={handleDownloadOfficialPdf} className="w-full gap-2">
                  <Printer className="w-4 h-4" /> View / Download Official PDF
                </Button>
              </div>
            </Card>

            <Card className="p-6 border-slate-200/80 dark:border-slate-800 shadow-card">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                Current Batches
              </h4>
              {enrolledBatches.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No batches assigned yet.</p>
              ) : (
                <div className="space-y-2">
                  {enrolledBatches.map((b: any) => (
                    <div
                      key={b.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 text-xs"
                    >
                      <div className="font-bold text-slate-900 dark:text-white">{b.name}</div>
                      {b.subject && <div className="text-slate-500 mt-0.5">{b.subject}</div>}
                      {b.start_time && (
                        <div className="text-indigo-600 dark:text-indigo-400 font-medium mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {b.start_time} - {b.end_time || 'End'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Attendance */}
      {activeTab === 'attendance' && (
        <Card className="p-6 border-slate-200/80 dark:border-slate-800 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Attendance Log Book</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Complete historical record of student presence and absence across all classes.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                Present: {attendanceStats.presentCount}
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800">
                Absent: {attendanceStats.absentCount}
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800">
                Rate: {attendanceStats.attendanceRate}%
              </span>
            </div>
          </div>

          {attendanceHistory.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No Attendance Records Found"
              description="When a teacher marks attendance for batches this student belongs to, records will populate here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Session Date</th>
                    <th className="px-5 py-3.5">Batch</th>
                    <th className="px-5 py-3.5">Attendance Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {attendanceHistory.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                        {new Date(att.attendanceDate).toLocaleDateString('en-IN', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{att.batchName}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                            att.status === 'PRESENT'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200'
                          }`}
                        >
                          {att.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB CONTENT: Batches */}
      {activeTab === 'batches' && (
        <Card className="p-6 border-slate-200/80 dark:border-slate-800 shadow-card">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Enrolled Batches & Timings</h3>
          {enrolledBatches.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No Batches Assigned"
              description="Go to Batches or Students directory to assign this student to active batches."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {enrolledBatches.map((batch: any) => (
                <div
                  key={batch.id}
                  className="p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 dark:text-white text-base">{batch.name}</h4>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300">
                      {batch.enrollmentStatus || 'ACTIVE'}
                    </span>
                  </div>

                  {batch.subject && (
                    <p className="text-xs text-slate-500 font-medium">Subject: {batch.subject}</p>
                  )}

                  {batch.schedule_days && batch.schedule_days.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {batch.schedule_days.map((day: string) => (
                        <span
                          key={day}
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        >
                          {day}
                        </span>
                      ))}
                    </div>
                  )}

                  {batch.start_time && (
                    <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 pt-1">
                      <Clock className="w-3.5 h-3.5" />
                      {batch.start_time} - {batch.end_time || 'End of class'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB CONTENT: Fees */}
      {activeTab === 'fees' && (
        <Card className="p-6 border-slate-200/80 dark:border-slate-800 shadow-card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Fee Invoices & Payments</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Monthly tuition fees, due dates, and payment transaction logs.
              </p>
            </div>
          </div>

          {feeHistory.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No Fee Records Yet"
              description="Tuition fees generated for this student will appear here with instant payment links and status."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Billing Period</th>
                    <th className="px-5 py-3.5">Amount Due</th>
                    <th className="px-5 py-3.5">Amount Paid</th>
                    <th className="px-5 py-3.5">Pending Amount</th>
                    <th className="px-5 py-3.5">Due Date</th>
                    <th className="px-5 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {feeHistory.map((fee) => (
                    <tr key={fee.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{fee.billingPeriod}</td>
                      <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">
                        ₹{Number(fee.amountDue).toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-4 font-semibold text-emerald-600 dark:text-emerald-400">
                        ₹{Number(fee.amountPaid).toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-4 font-semibold text-rose-600 dark:text-rose-400">
                        ₹{Number(fee.pendingAmount).toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                        {new Date(fee.dueDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                            fee.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : fee.status === 'OVERDUE'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {fee.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
