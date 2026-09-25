import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { DashboardService } from '../services/dashboard.service.js';
import { StudentService } from '../services/student.service.js';
import { BatchService } from '../services/batch.service.js';
import { FeeService } from '../services/fee.service.js';
import { queueService } from '../services/whatsapp/queue.service.js';
import { automationService } from '../services/whatsapp/automation.service.js';
import { ROLES, STATUS } from '../constants/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('🚀 BUSINESS UX & FEES MANAGEMENT VERIFICATION SUITE');
  console.log('============================================================\n');

  // Authenticate Admin
  const authClient = createClient(env.SUPABASE_URL || '', env.SUPABASE_ANON_KEY || '', {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email: env.DEV_ADMIN_EMAIL || 'admin@apexacademy.demo',
    password: env.DEV_ADMIN_PASSWORD || 'AdminPassword@123',
  });

  if (authError || !authData.user) {
    throw new Error(`Failed to authenticate admin: ${authError?.message}`);
  }

  const adminUser = {
    userId: authData.user.id,
    profileId: authData.user.id,
    role: ROLES.ADMIN,
    email: authData.user.email || '',
    fullName: 'System Admin',
  };

  // Authenticate Teacher
  const { data: teacherAuthData } = await authClient.auth.signInWithPassword({
    email: env.DEV_TEACHER_EMAIL || 'teacher@apexacademy.demo',
    password: env.DEV_TEACHER_PASSWORD || 'TeacherPassword@123',
  });

  const teacherUser = teacherAuthData?.user ? {
    userId: teacherAuthData.user.id,
    profileId: teacherAuthData.user.id,
    role: ROLES.TEACHER,
    email: teacherAuthData.user.email || '',
    fullName: 'Teacher Demo',
  } : null;

  // -------------------------------------------------------------
  // TEST GROUP 1: Batch Business Fields (Monthly Fee, Description, Active Student Count)
  // -------------------------------------------------------------
  console.log('--- TEST GROUP 1: Batch Business Fields & Roster ---');
  let createdBatch: any = null;
  try {
    createdBatch = await BatchService.createBatch({
      name: `Test JEE Batch ${Date.now().toString().slice(-4)}`,
      monthlyFee: 3500,
      description: 'JEE Preparation Batch',
      scheduleDays: ['Mon', 'Wed', 'Fri'],
      status: 'ACTIVE',
    });

    assert(createdBatch && createdBatch.id, 'Batch created with business fields');
    assert(Number(createdBatch.monthlyFee) === 3500, 'Monthly fee preserved as 3500');
    assert(createdBatch.description === 'JEE Preparation Batch', 'Description preserved');

    // Fetch batch detail as Admin
    const batchDetail = await BatchService.getBatchById(createdBatch.id, adminUser);
    assert(batchDetail && batchDetail.name === createdBatch.name, 'Batch detail retrieved successfully');
    assert(typeof batchDetail.monthlyFee === 'number', 'Batch detail returns numeric monthly fee');
  } catch (err: any) {
    assert(false, 'Batch creation/retrieval failed', err.message);
  }

  // -------------------------------------------------------------
  // TEST GROUP 2: Strict RBAC Verification (Teacher Dashboard Has ZERO Financial Fields)
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: RBAC Teacher Dashboard Strict Privacy ---');
  if (teacherUser) {
    try {
      const teacherDashboard = await DashboardService.getTeacherKPIs(teacherUser.userId);
      assert(teacherDashboard && typeof teacherDashboard.kpis?.assignedBatchCount === 'number', 'Teacher KPIs return teaching stats');
      assert(!('feesCollectedThisMonth' in (teacherDashboard as any)), 'Teacher KPIs omit feesCollectedThisMonth');
      assert(!('feesPendingThisMonth' in (teacherDashboard as any)), 'Teacher KPIs omit feesPendingThisMonth');
      assert(!('monthlyFeeSummary' in (teacherDashboard as any)), 'Teacher KPIs omit monthlyFeeSummary');
      assert(!('feeFollowups' in (teacherDashboard as any)), 'Teacher KPIs omit feeFollowups');

      if (createdBatch) {
        // Teacher is not assigned to this batch yet, so server-side RBAC must reject with 403
        try {
          await BatchService.getBatchById(createdBatch.id, teacherUser);
          assert(false, 'Teacher cannot view unassigned batch');
        } catch (err: any) {
          assert(err.message.includes('not authorized'), 'Teacher correctly rejected from unassigned batch');
        }
      }
    } catch (err: any) {
      assert(false, 'Teacher RBAC verification failed', err.message);
    }
  } else {
    console.log('  ⚠️ Skipping Teacher auth check (no teacher credentials available)');
  }

  // -------------------------------------------------------------
  // TEST GROUP 3: Section 34 Scenarios 1-7: Fee Follow-up Logic & Consecutive Unpaid Calculation
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Section 34 Fee Follow-up & Consecutive Unpaid Calculation ---');

  // We will create 4 isolated test students and fee records to test exact scenarios
  let studentScenario1: any = null;
  let studentScenario23: any = null;
  let studentScenario4: any = null;
  let studentScenario5: any = null;
  let studentScenario6: any = null;
  let studentScenario7: any = null;
  let studentScenario8: any = null;

  try {
    // Helper to create test student
    const createTestStudent = async (name: string, optIn: boolean = true) => {
      return await StudentService.createStudent({
        name,
        parentName: `Parent of ${name}`,
        parentWhatsapp: `94048${Math.floor(10000 + Math.random() * 90000)}`,
        batchId: createdBatch?.id,
        whatsappOptIn: optIn,
        status: 'ACTIVE',
        monthlyFee: 3500,
        feeDueDay: 10,
      });
    };

    studentScenario1 = await createTestStudent('Student Scen1 Paid');
    studentScenario23 = await createTestStudent('Student Scen2 Pending');
    studentScenario4 = await createTestStudent('Student Scen4 Critical');
    studentScenario5 = await createTestStudent('Student Scen5 Intermittent');
    studentScenario6 = await createTestStudent('Student Scen6 JoinedAug');
    studentScenario7 = await createTestStudent('Student Scen7 Partial');
    studentScenario8 = await createTestStudent('Student Scen8 OptOut', false); // opted-out

    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    const currentPeriod = `${currentYear}-${currentMonth}`;

    // Past periods: M-1, M-2, M-3
    const getPastPeriod = (monthsAgo: number) => {
      const d = new Date();
      d.setMonth(d.getMonth() - monthsAgo);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };
    const periodM1 = getPastPeriod(1);
    const periodM2 = getPastPeriod(2);
    const periodM3 = getPastPeriod(3);

    // SCENARIO 1: September -> PAID (Result: Not in follow-up)
    await supabaseAdmin!.from('student_fees').insert({
      student_id: studentScenario1.id,
      amount_due: 3500,
      amount_paid: 3500,
      status: 'PAID',
      due_date: '2026-09-10',
      billing_period: currentPeriod,
    });

    // SCENARIO 2: September -> PENDING (Result: In follow-up, NORMAL / Due Soon)
    const futureDueDate = new Date();
    futureDueDate.setDate(futureDueDate.getDate() + 10);
    await supabaseAdmin!.from('student_fees').insert({
      student_id: studentScenario23.id,
      amount_due: 3500,
      amount_paid: 0,
      status: 'PENDING',
      due_date: futureDueDate.toISOString().slice(0, 10),
      billing_period: currentPeriod,
    });

    // SCENARIO 4: M-3 OVERDUE, M-2 OVERDUE, M-1 OVERDUE (Result: 3 unpaid periods -> CRITICAL / 3+ Months Unpaid)
    await supabaseAdmin!.from('student_fees').insert([
      { student_id: studentScenario4.id, amount_due: 3500, amount_paid: 0, status: 'OVERDUE', due_date: '2026-05-10', billing_period: periodM3 },
      { student_id: studentScenario4.id, amount_due: 3500, amount_paid: 0, status: 'OVERDUE', due_date: '2026-06-10', billing_period: periodM2 },
      { student_id: studentScenario4.id, amount_due: 3500, amount_paid: 0, status: 'OVERDUE', due_date: '2026-07-10', billing_period: periodM1 },
    ]);

    // SCENARIO 5: M-3 OVERDUE, M-2 PAID, M-1 OVERDUE (Result: Only 1 consecutive unpaid period, NOT 3)
    await supabaseAdmin!.from('student_fees').insert([
      { student_id: studentScenario5.id, amount_due: 3500, amount_paid: 0, status: 'OVERDUE', due_date: '2026-05-10', billing_period: periodM3 },
      { student_id: studentScenario5.id, amount_due: 3500, amount_paid: 3500, status: 'PAID', due_date: '2026-06-10', billing_period: periodM2 },
      { student_id: studentScenario5.id, amount_due: 3500, amount_paid: 0, status: 'OVERDUE', due_date: '2026-07-10', billing_period: periodM1 },
    ]);

    // SCENARIO 6: Joined recently: only 2 fee records exist: M-2 OVERDUE, M-1 OVERDUE (Result: Exactly 2 recorded unpaid periods, NOT 3)
    await supabaseAdmin!.from('student_fees').insert([
      { student_id: studentScenario6.id, amount_due: 3500, amount_paid: 0, status: 'OVERDUE', due_date: '2026-06-10', billing_period: periodM2 },
      { student_id: studentScenario6.id, amount_due: 3500, amount_paid: 0, status: 'OVERDUE', due_date: '2026-07-10', billing_period: periodM1 },
    ]);

    // SCENARIO 7: Partial payment: Fee = 3500, Paid = 2000 -> PARTIAL, Remaining = 1500
    await supabaseAdmin!.from('student_fees').insert({
      student_id: studentScenario7.id,
      amount_due: 3500,
      amount_paid: 2000,
      status: 'PARTIAL',
      due_date: '2026-09-10',
      billing_period: currentPeriod,
    });

    // SCENARIO 8: Opted-out student has OVERDUE fee
    await supabaseAdmin!.from('student_fees').insert({
      student_id: studentScenario8.id,
      amount_due: 3500,
      amount_paid: 0,
      status: 'OVERDUE',
      due_date: '2026-09-01',
      billing_period: currentPeriod,
    });

    // Now fetch Admin Dashboard KPIs and Fee Follow-ups
    const adminKPIs = await DashboardService.getAdminKPIs();
    const followups = adminKPIs.feeFollowups;

    // Check Scenario 1: studentScenario1 must NOT be in follow-up
    const scen1Followup = followups.find((f: any) => f.studentId === studentScenario1.id);
    assert(!scen1Followup, 'Scenario 1: Student with PAID fee is NOT in fee follow-up');

    // Check Scenario 2: studentScenario23 must be in follow-up with PENDING status
    const scen2Followup = followups.find((f: any) => f.studentId === studentScenario23.id);
    assert(!!scen2Followup, 'Scenario 2: Student with PENDING fee IS in fee follow-up');
    assert(scen2Followup?.status === 'PENDING', 'Scenario 2: Fee status is PENDING');

    // Check Scenario 4: studentScenario4 must have consecutiveUnpaidCount = 3 and attentionLevel = CRITICAL
    const scen4Followup = followups.find((f: any) => f.studentId === studentScenario4.id);
    assert(scen4Followup?.consecutiveUnpaidCount === 3, `Scenario 4: 3 unpaid periods counted (got: ${scen4Followup?.consecutiveUnpaidCount})`);
    assert(scen4Followup?.attentionLevel === 'CRITICAL', `Scenario 4: Attention level is CRITICAL (got: ${scen4Followup?.attentionLevel})`);
    assert(
      scen4Followup?.attentionBadge === '3 Months Unpaid' || scen4Followup?.attentionBadge === '3+ Months Unpaid',
      `Scenario 4: Attention badge is '3 Months Unpaid' (got: ${scen4Followup?.attentionBadge})`
    );

    // Check Scenario 5: studentScenario5 has M-1 OVERDUE, M-2 PAID -> consecutiveUnpaidCount must be 1, NOT 3
    const scen5Followup = followups.find((f: any) => f.studentId === studentScenario5.id);
    assert(!!scen5Followup, 'Scenario 5: Student with interrupted overdue history found in follow-up');
    assert(scen5Followup?.consecutiveUnpaidCount === 1, `Scenario 5: Consecutive unpaid count stops at paid month (got: ${scen5Followup?.consecutiveUnpaidCount}, expected: 1)`);
    assert(scen5Followup?.attentionLevel !== 'CRITICAL', 'Scenario 5: Not falsely marked CRITICAL');

    // Check Scenario 6: studentScenario6 has only 2 records -> consecutiveUnpaidCount must be 2, NOT 3
    const scen6Followup = followups.find((f: any) => f.studentId === studentScenario6.id);
    assert(!!scen6Followup, 'Scenario 6: Student joined recently found in follow-up');
    assert(scen6Followup?.consecutiveUnpaidCount === 2, `Scenario 6: Exactly 2 recorded unpaid periods counted (got: ${scen6Followup?.consecutiveUnpaidCount}, expected: 2)`);
    assert(scen6Followup?.attentionBadge === '2 Months Unpaid', `Scenario 6: Attention badge is '2 Months Unpaid'`);

    // Check Scenario 7: studentScenario7 has PARTIAL status with remaining 1500
    const scen7Followup = followups.find((f: any) => f.studentId === studentScenario7.id);
    assert(!!scen7Followup, 'Scenario 7: Student with PARTIAL payment found in follow-up');
    assert(scen7Followup?.status === 'PARTIAL', 'Scenario 7: Status is PARTIAL');
    assert(scen7Followup?.paidAmount === 2000, `Scenario 7: Paid amount is 2000 (got: ${scen7Followup?.paidAmount})`);
    assert(scen7Followup?.remainingAmount === 1500, `Scenario 7: Remaining amount is 1500 (got: ${scen7Followup?.remainingAmount})`);

    // -------------------------------------------------------------
    // TEST GROUP 4: Scenario 8: WhatsApp Reminder Opt-out & Queue Safety
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 4: Scenario 8 WhatsApp Reminder Safety & Opt-out ---');
    const scen8Followup = followups.find((f: any) => f.studentId === studentScenario8.id);
    assert(!!scen8Followup, 'Scenario 8: Opted-out student appears in follow-up for admin awareness');
    assert(scen8Followup?.whatsappOptIn === false, 'Scenario 8: Opt-in flag correctly reflects false');

    // Try triggering fee reminder for opted-out student
    const reminderResult = await automationService.triggerFeeReminderAutomation({
      studentId: studentScenario8.id,
      studentFeeId: scen8Followup!.feeId,
    });

    assert(reminderResult.status === 'FAILED', 'Scenario 8: Opted-out student reminder marked FAILED in queue');
    assert(
      Boolean(
        reminderResult.error_message?.includes('opted out') ||
        reminderResult.error_message?.includes('opt-out') ||
        reminderResult.error_message?.includes('whatsapp_opt_in = false')
      ),
      `Scenario 8: Failure reason states student opted out (${reminderResult.error_message})`
    );

  } catch (err: any) {
    assert(false, 'Scenario tests failed with error', err.message);
  } finally {
    // Clean up created test students & batch
    console.log('\n--- Cleaning up test artifacts ---');
    const studentIds = [
      studentScenario1?.id,
      studentScenario23?.id,
      studentScenario4?.id,
      studentScenario5?.id,
      studentScenario6?.id,
      studentScenario7?.id,
      studentScenario8?.id,
    ].filter(Boolean);

    if (studentIds.length > 0) {
      await supabaseAdmin!.from('student_fees').delete().in('student_id', studentIds);
      await supabaseAdmin!.from('batch_students').delete().in('student_id', studentIds);
      await supabaseAdmin!.from('students').delete().in('id', studentIds);
    }
    if (createdBatch?.id) {
      await supabaseAdmin!.from('batches').delete().eq('id', createdBatch.id);
    }
    console.log('  Cleaned up test data.');
  }

  // -------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------
  console.log('\n============================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
