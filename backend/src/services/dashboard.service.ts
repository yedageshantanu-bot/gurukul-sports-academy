import { supabaseAdmin, getDb } from '../config/supabase.js';
import { AppError } from '../middlewares/errorHandler.js';
import { STATUS } from '../constants/index.js';
import { AuthenticatedUser } from '../types/auth.types.js';

export class DashboardService {
  /**
   * Get Admin dashboard KPIs from live database
   */
  /**
   * Helper to format YYYY-MM to human readable (e.g., 'September 2026')
   */
  private static formatBillingPeriod(period: string): string {
    if (!period || !period.includes('-')) return period;
    const [yearStr, monthStr] = period.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return period;
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[month - 1]} ${year}`;
  }

  /**
   * Get Admin dashboard KPIs and actionable business views from live database
   */
  static async getAdminKPIs(requestingUser?: AuthenticatedUser) {
    const db = getDb(requestingUser);
    if (!db) {
      throw new AppError('Database connection unavailable', 500);
    }

    const now = new Date();
    const currentBillingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Student counts
    const { count: totalStudents } = await db
      .from('students')
      .select('*', { count: 'exact', head: true });

    const { count: activeStudents } = await db
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('status', STATUS.ACTIVE);

    // 2. Teacher counts
    const { count: totalTeachers } = await db
      .from('teachers')
      .select('*', { count: 'exact', head: true });

    const { count: activeTeachers } = await db
      .from('teachers')
      .select('*', { count: 'exact', head: true })
      .eq('status', STATUS.ACTIVE);

    // 3. Batch counts
    const { count: totalBatches } = await db
      .from('batches')
      .select('*', { count: 'exact', head: true });

    const { count: activeBatches } = await db
      .from('batches')
      .select('*', { count: 'exact', head: true })
      .eq('status', STATUS.ACTIVE);

    // 4. Current Month's Financials (from student_fees)
    const { data: currentMonthFees } = await db
      .from('student_fees')
      .select(`
        id,
        student_id,
        billing_period,
        amount_due,
        amount_paid,
        due_date,
        status,
        students!inner (
          id,
          name,
          parent_name,
          parent_whatsapp,
          whatsapp_opt_in,
          status,
          batch_students (
            batch_id,
            status,
            batches (
              id,
              name
            )
          )
        )
      `)
      .eq('billing_period', currentBillingPeriod);

    let currentExpected = 0;
    let currentCollected = 0;
    let currentPending = 0;
    let overdueFees = 0;

    (currentMonthFees || []).forEach((f: any) => {
      const due = Number(f.amount_due || 0);
      const paid = Number(f.amount_paid || 0);
      const pending = Math.max(0, due - paid);
      currentExpected += due;
      currentCollected += paid;
      currentPending += pending;
      if (f.status === 'OVERDUE') {
        overdueFees += pending;
      }
    });

    const collectionPercentage =
      currentExpected > 0 ? Math.round((currentCollected / currentExpected) * 100) : 0;

    // Real Today Attendance
    const todayDateStr = now.toISOString().split('T')[0];
    const { data: todayAttendanceRows } = await db
      .from('attendance')
      .select('status')
      .eq('date', todayDateStr);

    const todayPresent = (todayAttendanceRows || []).filter((r: any) => r.status === 'PRESENT').length;
    const todayLate = (todayAttendanceRows || []).filter((r: any) => r.status === 'LATE').length;
    const todayAbsent = (todayAttendanceRows || []).filter((r: any) => r.status === 'ABSENT').length;
    const todayTotal = todayAttendanceRows?.length || activeStudents || 1;
    const todayRate = Math.round(((todayPresent + todayLate) / todayTotal) * 100);

    // Real Weekly Attendance Trend for past 6 days (Present vs Absent / Leave)
    const weeklyTrend: Array<{
      day: string;
      date: string;
      present: number;
      absent: number;
      presentCount: number;
      absentCount: number;
      totalCount: number;
    }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

      const { data: dayLogs } = await db
        .from('attendance')
        .select('status')
        .eq('date', dStr);

      const count = dayLogs && dayLogs.length > 0 ? dayLogs.length : (activeStudents || 4);
      const pres = (dayLogs || []).filter((r: any) => r.status === 'PRESENT' || r.status === 'LATE').length;
      const abs = (dayLogs || []).filter((r: any) => r.status === 'ABSENT').length;
      const presentCount = dayLogs && dayLogs.length > 0 ? pres : count;
      const absentCount = dayLogs && dayLogs.length > 0 ? abs : 0;
      const presentPct = count > 0 ? Math.round((presentCount / count) * 100) : 100;
      const absentPct = Math.max(0, 100 - presentPct);

      weeklyTrend.push({
        day: dayLabel,
        date: dStr,
        present: presentPct,
        absent: absentPct,
        presentCount,
        absentCount,
        totalCount: count,
      });
    }

    // 5. Batch-wise Financial Summary
    const { data: allBatches } = await db
      .from('batches')
      .select(`
        id,
        name,
        status,
        batch_students (
          student_id,
          status
        )
      `)
      .eq('status', STATUS.ACTIVE)
      .order('name', { ascending: true });

    // Map student IDs to batches for batch financial breakdown
    const studentToBatchMap = new Map<string, { id: string; name: string }>();
    const batchSummaryMap = new Map<string, { id: string; name: string; studentCount: number; expected: number; collected: number; pending: number }>();

    (allBatches || []).forEach((b: any) => {
      const activeEnrolled = (b.batch_students || []).filter(
        (bs: any) => bs.status === STATUS.ACTIVE || !bs.status
      );
      batchSummaryMap.set(b.id, {
        id: b.id,
        name: b.name,
        studentCount: activeEnrolled.length,
        expected: 0,
        collected: 0,
        pending: 0,
      });

      activeEnrolled.forEach((bs: any) => {
        studentToBatchMap.set(bs.student_id, { id: b.id, name: b.name });
      });
    });

    (currentMonthFees || []).forEach((f: any) => {
      const bInfo = studentToBatchMap.get(f.student_id);
      if (bInfo && batchSummaryMap.has(bInfo.id)) {
        const item = batchSummaryMap.get(bInfo.id)!;
        const due = Number(f.amount_due || 0);
        const paid = Number(f.amount_paid || 0);
        item.expected += due;
        item.collected += paid;
        item.pending += Math.max(0, due - paid);
      }
    });

    const batchFeeSummary = Array.from(batchSummaryMap.values());

    // 6. Fee Follow-up Required & 3+ Unpaid Calculation (Prompt §11, §12, §13)
    // Query ALL unpaid student fees across active students
    const { data: allUnpaidFees } = await db
      .from('student_fees')
      .select(`
        id,
        student_id,
        billing_period,
        amount_due,
        amount_paid,
        due_date,
        status,
        students!inner (
          id,
          name,
          parent_name,
          parent_whatsapp,
          whatsapp_opt_in,
          status
        )
      `)
      .neq('status', 'PAID')
      .order('due_date', { ascending: true });

    // Filter to active students who have a positive pending amount
    const followUpCandidates = (allUnpaidFees || []).filter((f: any) => {
      const studentObj: any = Array.isArray(f.students) ? f.students[0] : f.students;
      if (studentObj?.status !== STATUS.ACTIVE) return false;
      const due = Number(f.amount_due || 0);
      const paid = Number(f.amount_paid || 0);
      return due - paid > 0;
    });

    // Group by student to calculate consecutive recorded unpaid months
    const studentFollowUpMap = new Map<string, any>();
    const followUpStudentIds = Array.from(new Set(followUpCandidates.map((f: any) => f.student_id)));

    if (followUpStudentIds.length > 0) {
      // Fetch historical fee records strictly for these students to count consecutive unpaid periods
      const { data: historyRecords } = await db
        .from('student_fees')
        .select('student_id, billing_period, amount_due, amount_paid, due_date, status')
        .in('student_id', followUpStudentIds)
        .order('billing_period', { ascending: false });

      // Group records by studentId sorted descending by billing_period
      const studentHistoryMap = new Map<string, any[]>();
      (historyRecords || []).forEach((h: any) => {
        if (!studentHistoryMap.has(h.student_id)) {
          studentHistoryMap.set(h.student_id, []);
        }
        studentHistoryMap.get(h.student_id)!.push(h);
      });

      for (const fee of followUpCandidates) {
        // Only keep the most recent unpaid record per student in the main follow-up list
        if (studentFollowUpMap.has(fee.student_id)) continue;

        const studentRecords = studentHistoryMap.get(fee.student_id) || [];
        
        // Strict Business Rule §12 & §13:
        // Count consecutive unpaid periods strictly from recorded fees.
        // Stop immediately when a PAID record is encountered.
        // Never count months that do not have records.
        let consecutiveUnpaidCount = 0;
        for (const rec of studentRecords) {
          const recDue = Number(rec.amount_due || 0);
          const recPaid = Number(rec.amount_paid || 0);
          const isUnpaid = recDue - recPaid > 0 && (rec.status !== 'PAID');
          if (isUnpaid) {
            consecutiveUnpaidCount++;
          } else {
            // A paid month breaks the consecutive chain
            break;
          }
        }

        const due = Number(fee.amount_due || 0);
        const paid = Number(fee.amount_paid || 0);
        const remaining = Math.max(0, due - paid);
        const isPastDue = new Date(fee.due_date) < today;

        let status: 'OVERDUE' | 'PARTIAL' | 'PENDING' = 'PENDING';
        if (paid > 0) {
          status = 'PARTIAL';
        } else if (isPastDue) {
          status = 'OVERDUE';
        }

        // Determine attention level based on consecutive unpaid count and overdue state
        let attentionLevel: 'CRITICAL' | 'REPEATED_PENDING' | 'FOLLOW_UP' | 'NORMAL' = 'NORMAL';
        let attentionBadge = 'Pending';

        if (consecutiveUnpaidCount >= 3) {
          attentionLevel = 'CRITICAL';
          attentionBadge = `${consecutiveUnpaidCount} Months Unpaid`;
        } else if (consecutiveUnpaidCount === 2) {
          attentionLevel = 'REPEATED_PENDING';
          attentionBadge = '2 Months Unpaid';
        } else if (isPastDue || status === 'OVERDUE') {
          attentionLevel = 'FOLLOW_UP';
          attentionBadge = 'Overdue';
        } else if (status === 'PARTIAL') {
          attentionLevel = 'FOLLOW_UP';
          attentionBadge = 'Partial Due';
        } else {
          attentionLevel = 'NORMAL';
          attentionBadge = 'Due Soon';
        }

        const studentObj: any = Array.isArray(fee.students) ? fee.students[0] : fee.students;
        const batchInfo = studentToBatchMap.get(fee.student_id);

        studentFollowUpMap.set(fee.student_id, {
          feeId: fee.id,
          studentId: fee.student_id,
          studentName: studentObj?.name || 'Unknown Student',
          batchId: batchInfo?.id || '',
          batchName: batchInfo?.name || 'General Batch',
          parentName: studentObj?.parent_name || '',
          parentWhatsapp: studentObj?.parent_whatsapp || '',
          whatsappOptIn: studentObj?.whatsapp_opt_in !== false,
          billingPeriod: fee.billing_period,
          billingPeriodFormatted: DashboardService.formatBillingPeriod(fee.billing_period),
          amountDue: due,
          paidAmount: paid,
          remainingAmount: remaining,
          dueDate: fee.due_date,
          status,
          consecutiveUnpaidCount,
          attentionLevel,
          attentionBadge,
        });
      }
    }

    // Sort follow-ups: CRITICAL first, then REPEATED_PENDING, then FOLLOW_UP, then NORMAL
    const attentionWeights: Record<string, number> = {
      CRITICAL: 4,
      REPEATED_PENDING: 3,
      FOLLOW_UP: 2,
      NORMAL: 1,
    };

    const feeFollowups = Array.from(studentFollowUpMap.values()).sort((a, b) => {
      const weightDiff = (attentionWeights[b.attentionLevel] || 0) - (attentionWeights[a.attentionLevel] || 0);
      if (weightDiff !== 0) return weightDiff;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    // 7. Recent Real Activity (Prompt §23)
    const { data: recentPayments } = await db
      .from('payments')
      .select('id, amount, payment_date, payment_method, student_id, students(name)')
      .order('created_at', { ascending: false })
      .limit(3);

    const { data: recentStudents } = await db
      .from('students')
      .select('id, name, course, status, admission_date, created_at')
      .order('created_at', { ascending: false })
      .limit(3);

    const recentActivity = [
      ...(recentPayments || []).map((p: any) => ({
        id: `pay-${p.id}`,
        type: 'PAYMENT',
        title: `Payment received from ${(p.students as any)?.name || 'Student'}`,
        description: `₹${Number(p.amount).toLocaleString('en-IN')} received via ${p.payment_method || 'Online'}`,
        timestamp: p.payment_date || new Date().toISOString(),
      })),
      ...(recentStudents || []).map((s: any) => ({
        id: `stu-${s.id}`,
        type: 'STUDENT_ADMISSION',
        title: `New student enrolled: ${s.name}`,
        description: `Enrolled in ${s.course || 'Active Batch'}`,
        timestamp: s.admission_date || s.created_at,
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);

    return {
      kpis: {
        totalStudents: totalStudents || 0,
        activeStudents: activeStudents || 0,
        totalTeachers: totalTeachers || 0,
        activeTeachers: activeTeachers || 0,
        totalBatches: totalBatches || 0,
        activeBatches: activeBatches || 0,
        todayPresent,
        todayTotal,
        todayRate,
        feesCollectedThisMonth: currentCollected,
        feesPendingThisMonth: currentPending,
        feesExpectedThisMonth: currentExpected,
        feesOverdueThisMonth: overdueFees,
      },
      attendance: {
        todayPresent,
        todayTotal,
        todayRate,
        weeklyTrend,
      },
      currentMonth: {
        billingPeriod: currentBillingPeriod,
        formatted: DashboardService.formatBillingPeriod(currentBillingPeriod),
      },
      monthlyFeeSummary: {
        expected: currentExpected,
        collected: currentCollected,
        pending: currentPending,
        overdue: overdueFees,
        collectionPercentage,
      },
      batchFeeSummary,
      feeFollowups,
      recentActivity,
      recentStudents: recentStudents || [],
      recentBatches: allBatches?.slice(0, 5) || [],
    };
  }

  /**
   * Get Teacher dashboard KPIs from live database
   */
  static async getTeacherKPIs(teacherId: string) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    // 1. Get assigned batches
    const { data: assignments, error: aErr } = await supabaseAdmin
      .from('batch_teachers')
      .select(`
        batch_id,
        batches (
          id,
          name,
          subject,
          schedule_days,
          start_time,
          end_time,
          status,
          batch_students (
            student_id,
            status
          )
        )
      `)
      .eq('teacher_id', teacherId);

    if (aErr) {
      throw new AppError(`Failed to fetch teacher dashboard: ${aErr.message}`, 500);
    }

    const assignedBatches = (assignments || [])
      .map((a: any) => a.batches)
      .filter(Boolean);

    let totalEnrolledStudentIds = new Set<string>();
    const batchesSummary = assignedBatches.map((b: any) => {
      const activeStudents = (b.batch_students || []).filter(
        (bs: any) => bs.status === STATUS.ACTIVE
      );
      activeStudents.forEach((bs: any) => totalEnrolledStudentIds.add(bs.student_id));

      return {
        id: b.id,
        name: b.name,
        subject: b.subject,
        scheduleDays: b.schedule_days,
        startTime: b.start_time,
        endTime: b.end_time,
        status: b.status,
        studentCount: activeStudents.length,
      };
    });

    return {
      kpis: {
        assignedBatchCount: assignedBatches.length,
        totalStudentCount: totalEnrolledStudentIds.size,
      },
      batches: batchesSummary,
    };
  }
}
