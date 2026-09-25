import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/errorHandler.js';
import {
  AttendanceReportFilterQuery,
  FeesReportFilterQuery,
  PaymentsReportFilterQuery,
  AttendanceReportSummary,
  FeesReportSummary,
  PaymentsReportSummary,
} from '../types/report.types.js';

export class ReportService {
  private get supabase() {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }
    return supabaseAdmin;
  }

  // Helper to escape CSV fields RFC-4180 style
  private escapeCsv(field: any): string {
    if (field === null || field === undefined) return '';
    const stringField = String(field);
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n') || stringField.includes('\r')) {
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
  }

  // ============================================================================
  // 1. ATTENDANCE REPORT
  // ============================================================================
  async getAttendanceReport(filters: AttendanceReportFilterQuery, teacherId?: string): Promise<AttendanceReportSummary> {
    // 1. If teacher, verify assigned batches
    let allowedBatchIds: string[] | null = null;
    if (teacherId) {
      const { data: assignments, error: assignErr } = await this.supabase
        .from('batch_teachers')
        .select('batch_id')
        .eq('teacher_id', teacherId);

      if (assignErr) {
        throw new AppError(`Failed to verify teacher assignments: ${assignErr.message}`, 500);
      }

      allowedBatchIds = (assignments || []).map((a) => a.batch_id);

      if (filters.batchId && !allowedBatchIds.includes(filters.batchId)) {
        throw new AppError('Forbidden: You are not assigned to this batch', 403, 'FORBIDDEN_BATCH_ACCESS');
      }
    }

    // 2. Query attendance records with relations
    let query = this.supabase
      .from('attendance')
      .select(`
        id,
        date,
        status,
        created_at,
        student:students(id, name, course, student_mobile, parent_whatsapp),
        batch:batches(id, name, subject)
      `)
      .order('date', { ascending: false });

    if (filters.batchId) {
      query = query.eq('batch_id', filters.batchId);
    } else if (allowedBatchIds !== null) {
      if (allowedBatchIds.length === 0) {
        return {
          totalRecords: 0,
          presentCount: 0,
          absentCount: 0,
          attendancePercentage: 0,
          batchBreakdown: [],
          records: [],
        };
      }
      query = query.in('batch_id', allowedBatchIds);
    }

    if (filters.studentId) {
      query = query.eq('student_id', filters.studentId);
    }

    if (filters.startDate) {
      query = query.gte('date', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('date', filters.endDate);
    }

    const { data: records, error } = await query;
    if (error) {
      throw new AppError(`Failed to fetch attendance report: ${error.message}`, 500);
    }

    const rawRecords = (records || []).map((r: any) => ({
      ...r,
      attendance_date: r.date,
    }));
    let presentCount = 0;
    let absentCount = 0;
    const batchMap = new Map<string, { batchName: string; total: number; present: number; absent: number }>();

    for (const r of rawRecords) {
      if (r.status === 'PRESENT') presentCount++;
      if (r.status === 'ABSENT') absentCount++;

      const batchObj = r.batch as any;
      const bId = batchObj?.id || 'unknown';
      const bName = batchObj?.name || 'Unknown Batch';

      if (!batchMap.has(bId)) {
        batchMap.set(bId, { batchName: bName, total: 0, present: 0, absent: 0 });
      }
      const bStats = batchMap.get(bId)!;
      bStats.total++;
      if (r.status === 'PRESENT') bStats.present++;
      if (r.status === 'ABSENT') bStats.absent++;
    }

    const totalRecords = rawRecords.length;
    const attendancePercentage = totalRecords > 0 ? Number(((presentCount / totalRecords) * 100).toFixed(2)) : 0;

    const batchBreakdown = Array.from(batchMap.entries()).map(([bId, s]) => ({
      batchId: bId,
      batchName: s.batchName,
      totalRecords: s.total,
      presentCount: s.present,
      absentCount: s.absent,
      attendancePercentage: s.total > 0 ? Number(((s.present / s.total) * 100).toFixed(2)) : 0,
    }));

    return {
      totalRecords,
      presentCount,
      absentCount,
      attendancePercentage,
      batchBreakdown,
      records: rawRecords,
    };
  }

  // ============================================================================
  // 2. FEES REPORT (Admin Only)
  // ============================================================================
  async getFeesReport(filters: FeesReportFilterQuery): Promise<FeesReportSummary> {
    // If filtering by batch, resolve students in that batch
    let allowedStudentIds: string[] | null = null;
    if (filters.batchId) {
      const { data: batchStudents, error: bsError } = await this.supabase
        .from('batch_students')
        .select('student_id')
        .eq('batch_id', filters.batchId);

      if (bsError) {
        throw new AppError(`Failed to filter fees by batch: ${bsError.message}`, 500);
      }

      allowedStudentIds = (batchStudents || []).map((b) => b.student_id);
      if (allowedStudentIds.length === 0) {
        return {
          totalBilled: 0,
          totalCollected: 0,
          totalPending: 0,
          totalOverdue: 0,
          statusBreakdown: [],
          records: [],
        };
      }
    }

    let query = this.supabase
      .from('student_fees')
      .select(`
        id,
        billing_period,
        amount_due,
        amount_paid,
        due_date,
        status,
        student:students(id, name, course, student_mobile)
      `)
      .order('due_date', { ascending: false });

    if (allowedStudentIds !== null) {
      query = query.in('student_id', allowedStudentIds);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.startDate) {
      query = query.gte('due_date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('due_date', filters.endDate);
    }

    const { data: records, error } = await query;
    if (error) {
      throw new AppError(`Failed to fetch fees report: ${error.message}`, 500);
    }

    const rawRecords = (records || []).map((r: any) => ({
      ...r,
      fee_plan: {
        name: r.student?.course ? `${r.student.course} Monthly` : 'Standard Plan',
      },
    }));
    let totalBilled = 0;
    let totalCollected = 0;
    let totalPending = 0;
    let totalOverdue = 0;

    const statusMap = new Map<string, { count: number; amount: number }>();

    for (const r of rawRecords) {
      const due = Number(r.amount_due) || 0;
      const paid = Number(r.amount_paid) || 0;
      const remaining = Math.max(0, due - paid);

      totalBilled += due;
      totalCollected += paid;

      if (r.status === 'OVERDUE') {
        totalOverdue += remaining;
      } else if (r.status === 'PENDING' || r.status === 'PARTIAL') {
        totalPending += remaining;
      }

      if (!statusMap.has(r.status)) {
        statusMap.set(r.status, { count: 0, amount: 0 });
      }
      const st = statusMap.get(r.status)!;
      st.count++;
      st.amount += due;
    }

    const statusBreakdown = Array.from(statusMap.entries()).map(([status, val]) => ({
      status,
      count: val.count,
      amount: val.amount,
    }));

    return {
      totalBilled,
      totalCollected,
      totalPending,
      totalOverdue,
      statusBreakdown,
      records: rawRecords,
    };
  }

  // ============================================================================
  // 3. PAYMENTS REPORT (Admin Only)
  // ============================================================================
  async getPaymentsReport(filters: PaymentsReportFilterQuery): Promise<PaymentsReportSummary> {
    let query = this.supabase
      .from('payments')
      .select(`
        id,
        amount,
        payment_method,
        transaction_id,
        payment_date,
        status,
        created_at,
        student:students(id, name, student_mobile)
      `)
      .order('created_at', { ascending: false });

    if (filters.provider) {
      query = query.eq('payment_method', filters.provider);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data: records, error } = await query;
    if (error) {
      throw new AppError(`Failed to fetch payments report: ${error.message}`, 500);
    }

    const rawRecords = (records || []).map((r: any) => {
      const receiptNo = `GSA-REC-${r.id.slice(0, 8).toUpperCase()}`;
      return {
        ...r,
        provider: r.payment_method || 'UPI',
        provider_payment_id: r.transaction_id || `TXN-${r.id.slice(0, 6)}`,
        paid_at: r.payment_date || r.created_at,
        receipt: {
          id: r.id,
          receipt_number: receiptNo,
        },
      };
    });

    let totalVolume = 0;
    let successfulCount = 0;
    let failedCount = 0;

    const providerMap = new Map<string, { volume: number; count: number }>();

    for (const r of rawRecords) {
      const amt = Number(r.amount) || 0;
      if (r.status === 'SUCCESS') {
        totalVolume += amt;
        successfulCount++;
      } else if (r.status === 'FAILED') {
        failedCount++;
      }

      if (!providerMap.has(r.provider)) {
        providerMap.set(r.provider, { volume: 0, count: 0 });
      }
      const prov = providerMap.get(r.provider)!;
      prov.count++;
      if (r.status === 'SUCCESS') {
        prov.volume += amt;
      }
    }

    const providerBreakdown = Array.from(providerMap.entries()).map(([provider, val]) => ({
      provider,
      volume: val.volume,
      count: val.count,
    }));

    return {
      totalVolume,
      successfulCount,
      failedCount,
      providerBreakdown,
      records: rawRecords,
    };
  }

  // ============================================================================
  // 4. CSV EXPORTS
  // ============================================================================
  async exportAttendanceCsv(filters: AttendanceReportFilterQuery, teacherId?: string): Promise<string> {
    const report = await this.getAttendanceReport(filters, teacherId);
    const headers = ['Date', 'Student Name', 'Batch Name', 'Subject', 'Status', 'Parent WhatsApp'];
    const rows = report.records.map((r: any) => [
      this.escapeCsv(r.attendance_date || r.date),
      this.escapeCsv(r.student?.name || 'N/A'),
      this.escapeCsv(r.batch?.name || 'N/A'),
      this.escapeCsv(r.batch?.subject || 'N/A'),
      this.escapeCsv(r.status),
      this.escapeCsv(r.student?.parent_whatsapp || 'N/A'),
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  }

  async exportFeesCsv(filters: FeesReportFilterQuery): Promise<string> {
    const report = await this.getFeesReport(filters);
    const headers = ['Student Name', 'Course', 'Billing Period', 'Fee Plan', 'Amount Due', 'Amount Paid', 'Due Date', 'Status'];
    const rows = report.records.map((r: any) => [
      this.escapeCsv(r.student?.name || 'N/A'),
      this.escapeCsv(r.student?.course || 'N/A'),
      this.escapeCsv(r.billing_period || 'N/A'),
      this.escapeCsv(r.fee_plan?.name || 'N/A'),
      this.escapeCsv(r.amount_due),
      this.escapeCsv(r.amount_paid),
      this.escapeCsv(r.due_date),
      this.escapeCsv(r.status),
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  }

  async exportPaymentsCsv(filters: PaymentsReportFilterQuery): Promise<string> {
    const report = await this.getPaymentsReport(filters);
    const headers = ['Receipt No', 'Date', 'Student Name', 'Amount', 'Provider', 'Provider Ref', 'Status'];
    const rows = report.records.map((r: any) => {
      const receiptNo = Array.isArray(r.receipt) && r.receipt.length > 0
        ? r.receipt[0]?.receipt_number
        : r.receipt?.receipt_number || 'N/A';

      return [
        this.escapeCsv(receiptNo),
        this.escapeCsv(r.paid_at || r.created_at),
        this.escapeCsv(r.student?.name || 'N/A'),
        this.escapeCsv(r.amount),
        this.escapeCsv(r.provider),
        this.escapeCsv(r.provider_payment_id || 'N/A'),
        this.escapeCsv(r.status),
      ];
    });

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  }
}

export const reportService = new ReportService();
