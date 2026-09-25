import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ShieldCheck, User } from 'lucide-react';

export const TeacherDashboardPlaceholder: React.FC = () => {
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Teacher Portal Dashboard</h1>
          <Badge variant="success">TEACHER ROLE</Badge>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Authenticated teacher session verified via Supabase JWT and backend RBAC.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600" />
              Authenticated Instructor Context
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Instructor Name:</span>
              <span className="font-semibold text-slate-800">{profile?.fullName || 'Instructor'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Email:</span>
              <span className="font-semibold text-slate-800">{profile?.email}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Role:</span>
              <Badge variant="success">{profile?.role}</Badge>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Teacher ID:</span>
              <span className="font-mono text-xs text-slate-600">{profile?.teacherId || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">User ID:</span>
              <span className="font-mono text-xs text-slate-600">{profile?.userId}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Teacher Scope & Permissions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p className="text-xs text-slate-500">
              This route is protected by <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-700 font-mono">TeacherRoute</code>.
            </p>
            <ul className="list-disc list-inside text-xs space-y-1 text-slate-500">
              <li>Teacher role is strictly verified server-side.</li>
              <li>Teacher cannot access Admin-only modules (Settings, Fees, Teachers).</li>
              <li>Attendance and batch operations in Phase 3 will be restricted to assigned batches only.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
