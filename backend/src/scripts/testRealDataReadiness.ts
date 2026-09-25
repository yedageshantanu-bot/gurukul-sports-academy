import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { normalizePhoneNumber, validatePhoneNumber } from '../utils/phone.js';
import { automationService } from '../services/whatsapp/automation.service.js';
import { queueService } from '../services/whatsapp/queue.service.js';
import { whatsappSettingsService } from '../services/whatsapp/whatsappSettings.service.js';
import { StudentService } from '../services/student.service.js';
import { AttendanceService } from '../services/attendance.service.js';
import { FeeService } from '../services/fee.service.js';
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
  console.log('🚀 REAL-DATA READINESS & PRODUCTION POLISH TEST SUITE');
  console.log('============================================================\n');

  // -------------------------------------------------------------
  // TEST GROUP 1: Phone Normalization & Validation
  // -------------------------------------------------------------
  console.log('--- TEST GROUP 1: Phone Normalization & Validation ---');
  assert(normalizePhoneNumber('9404849500') === '+919404849500', '10-digit Indian number normalized to +91XXXXXXXXXX');
  assert(normalizePhoneNumber('09404849500') === '+919404849500', '11-digit leading-zero Indian number normalized to +91XXXXXXXXXX');
  assert(normalizePhoneNumber('+91 9404849500') === '+919404849500', 'Spaced Indian number with +91 normalized');
  assert(normalizePhoneNumber('+14155552671') === '+14155552671', 'Valid US E.164 number preserved');
  assert(normalizePhoneNumber('+447911123456') === '+447911123456', 'Valid UK E.164 number preserved');

  const validCheck = validatePhoneNumber('9404849500', true);
  assert(validCheck.valid && validCheck.normalized === '+919404849500', 'Valid 10-digit passes validation');

  const invalidShort = validatePhoneNumber('12345', true);
  assert(!invalidShort.valid, 'Short invalid phone rejected (<7 digits)');

  const emptyOptional = validatePhoneNumber('', false);
  assert(emptyOptional.valid && emptyOptional.normalized === '', 'Empty phone allowed when optional');

  const emptyRequired = validatePhoneNumber('', true);
  assert(!emptyRequired.valid, 'Empty phone rejected when required');

  // -------------------------------------------------------------
  // Authenticate Admin Client
  // -------------------------------------------------------------
  console.log('\n--- Authenticating Admin for CRM Operations ---');
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
  console.log('  Admin Authenticated Successfully.');

  // -------------------------------------------------------------
  // TEST GROUP 2: Student Management with Batch & Opt-in
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Student Management & Batch Assignment ---');
  const testStudentName = `Automated Student ${Date.now().toString().slice(-4)}`;
  const testParentPhone = `94048${Math.floor(10000 + Math.random() * 90000)}`;

  // Find an existing active batch using service role
  const { data: batches } = await supabaseAdmin!.from('batches').select('id, name').eq('status', 'ACTIVE').limit(2);
  const testBatch1 = batches?.[0];
  const testBatch2 = batches?.[1];

  let createdStudent: any = null;
  try {
    createdStudent = await StudentService.createStudent({
      name: testStudentName,
      parentName: 'Parent Tester',
      parentWhatsapp: testParentPhone,
      studentMobile: '9123456780',
      batchId: testBatch1?.id,
      whatsappOptIn: true,
      status: 'ACTIVE',
      course: 'Test Course',
      monthlyFee: 3000,
      feeDueDay: 10,
    });

    assert(createdStudent && createdStudent.id, 'Student created successfully');
    assert(createdStudent.parentWhatsapp === `+91${testParentPhone}`, 'Parent WhatsApp normalized to E.164');
    assert(createdStudent.whatsappOptIn === true, 'WhatsApp opt-in flag set to true');
    assert(createdStudent.batchId === testBatch1?.id, 'Student enrolled in initial batch');
  } catch (err: any) {
    assert(false, 'Create student failed', err.message);
  }

  // Test updating student batch
  if (createdStudent && testBatch2) {
    try {
      const updated = await StudentService.updateStudent(createdStudent.id, {
        batchId: testBatch2.id,
        whatsappOptIn: false,
      });
      assert(updated.whatsappOptIn === false, 'Student opt-in toggled to false');

      const retrieved = await StudentService.getStudentById(createdStudent.id, adminUser);
      assert(retrieved.batchId === testBatch2.id, 'Student batch reassigned to Batch 2');
      assert(retrieved.whatsappOptIn === false, 'Retrieved student reflects opt-in change');
    } catch (err: any) {
      assert(false, 'Update student batch failed', err.message);
    }
  }

  // -------------------------------------------------------------
  // TEST GROUP 3: Attendance Correction (ABSENT -> PRESENT)
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Attendance Correction & Idempotency ---');
  const testDate = new Date().toISOString().split('T')[0];

  if (createdStudent && testBatch2) {
    try {
      // 1. Mark ABSENT first
      const mark1 = await AttendanceService.markBulkAttendance(
        {
          batchId: testBatch2.id,
          date: testDate,
          records: [{ studentId: createdStudent.id, status: 'ABSENT' }],
        },
        adminUser
      );
      assert(mark1.recordedCount === 1, 'Initial ABSENT attendance saved');

      // 2. Mark PRESENT (Correction)
      const mark2 = await AttendanceService.markBulkAttendance(
        {
          batchId: testBatch2.id,
          date: testDate,
          records: [{ studentId: createdStudent.id, status: 'PRESENT' }],
        },
        adminUser
      );
      assert(mark2.recordedCount === 1, 'Attendance corrected from ABSENT to PRESENT');

      // 3. Mark PRESENT again (No-op correction idempotency)
      const mark3 = await AttendanceService.markBulkAttendance(
        {
          batchId: testBatch2.id,
          date: testDate,
          records: [{ studentId: createdStudent.id, status: 'PRESENT' }],
        },
        adminUser
      );
      assert(mark3.recordedCount === 1, 'Idempotent PRESENT -> PRESENT handled without error');
    } catch (err: any) {
      assert(false, 'Attendance correction workflow error', err.message);
    }
  }

  // -------------------------------------------------------------
  // TEST GROUP 4: Fees Monthly Period & Duplicate Protection
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Monthly Fee Periods & Duplicate Protection ---');
  const feeService = new FeeService();

  if (createdStudent) {
    try {
      // Create September 2026 fee
      const feeSep = await feeService.assignStudentFee({
        studentId: createdStudent.id,
        billingPeriod: '2026-09',
        amountDue: 2500,
        amountPaid: 0,
        dueDate: '2026-09-15',
      });
      assert(feeSep && feeSep.id, 'September 2026 (2026-09) fee assigned successfully');

      // Create October 2026 fee (Valid distinct period)
      const feeOct = await feeService.assignStudentFee({
        studentId: createdStudent.id,
        billingPeriod: '2026-10',
        amountDue: 2500,
        amountPaid: 0,
        dueDate: '2026-10-15',
      });
      assert(feeOct && feeOct.id, 'October 2026 (2026-10) fee assigned successfully');

      // Attempt duplicate September 2026 fee (Should throw duplicate error)
      let duplicateCaught = false;
      try {
        await feeService.assignStudentFee({
          studentId: createdStudent.id,
          billingPeriod: '2026-09',
          amountDue: 2500,
          amountPaid: 0,
          dueDate: '2026-09-15',
        });
      } catch (err: any) {
        if (err.message.includes('already assigned') || err.message.includes('DUPLICATE')) {
          duplicateCaught = true;
        }
      }
      assert(duplicateCaught, 'Duplicate fee assignment for same student + 2026-09 rejected');
    } catch (err: any) {
      assert(false, 'Fee assignment test error', err.message);
    }
  }

  // -------------------------------------------------------------
  // TEST GROUP 5: WhatsApp Safety Checks & Opt-in Enforcement
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: WhatsApp Safety Checks & Opt-in ---');
  const settings = await whatsappSettingsService.getSettings();
  assert(settings !== null, 'WhatsApp settings loaded from database');
  assert(settings.global_automation_enabled === true, 'Global automation is enabled');
  assert(settings.emergency_stop === false, 'Emergency stop is disabled');

  // Test opt-in check: student had opt-in set to false
  if (createdStudent) {
    const isOptedIn = await whatsappSettingsService.isOptedIn({
      studentId: createdStudent.id,
      phoneNumber: createdStudent.parentWhatsapp,
    });
    assert(isOptedIn === false, 'Opt-out correctly verified: isOptedIn returns false');
  }

  // -------------------------------------------------------------
  // TEST RESULTS SUMMARY
  // -------------------------------------------------------------
  console.log('\n============================================================');
  console.log(`📊 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution exception:', err);
  process.exit(1);
});
