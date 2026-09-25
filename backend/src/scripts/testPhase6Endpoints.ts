import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import app from '../app.js';
import { Server } from 'http';

async function runPhase6Tests() {
  console.log('🧪 Starting Automated Phase 6 (Reports, Announcements, Receipts, CSV Export) Tests...\n');

  if (
    !env.SUPABASE_URL ||
    !env.SUPABASE_ANON_KEY ||
    !env.DEV_ADMIN_EMAIL ||
    !env.DEV_ADMIN_PASSWORD ||
    !env.DEV_TEACHER_EMAIL ||
    !env.DEV_TEACHER_PASSWORD
  ) {
    console.error('❌ Environment credentials missing.');
    process.exit(1);
  }

  // 1. Authenticate real Admin & Teacher to obtain valid Supabase JWTs
  const authClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: adminLogin, error: adminLoginErr } = await authClient.auth.signInWithPassword({
    email: env.DEV_ADMIN_EMAIL,
    password: env.DEV_ADMIN_PASSWORD,
  });
  if (adminLoginErr || !adminLogin.session) {
    console.error('Failed to log in Admin:', adminLoginErr);
    process.exit(1);
  }
  const adminToken = adminLogin.session.access_token;

  const { data: teacherLogin, error: teacherLoginErr } = await authClient.auth.signInWithPassword({
    email: env.DEV_TEACHER_EMAIL,
    password: env.DEV_TEACHER_PASSWORD,
  });
  if (teacherLoginErr || !teacherLogin.session) {
    console.error('Failed to log in Teacher:', teacherLoginErr);
    process.exit(1);
  }
  const teacherToken = teacherLogin.session.access_token;

  // 2. Start test server
  const PORT = 10014;
  let server: Server | undefined;
  await new Promise<void>((resolve) => {
    server = app.listen(PORT, () => resolve());
  });

  const BASE_URL = `http://localhost:${PORT}/api`;
  let passCount = 0;
  let failCount = 0;

  function assert(name: string, condition: boolean, details?: any) {
    if (condition) {
      passCount++;
      console.log(`✅ PASS: ${name}`);
    } else {
      failCount++;
      console.error(`❌ FAIL: ${name}`, details ? JSON.stringify(details, null, 2) : '');
    }
  }

  try {
    // ========================================================================
    // SETUP: Get or create a batch assigned to teacher, and an unassigned batch
    // ========================================================================
    // Fetch teacher profile/record
    const teacherProfileRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const teacherProfileData = await teacherProfileRes.json();
    const teacherId = teacherProfileData.data?.teacherId;

    // Admin creates assigned batch
    const batch1Res = await fetch(`${BASE_URL}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `Phase6 Assigned Batch ${Date.now()}`,
        subject: 'Mathematics',
        scheduleDays: ['MON', 'WED'],
        startTime: '09:00',
        endTime: '10:30',
      }),
    });
    const batch1Data = await batch1Res.json();
    const assignedBatchId = batch1Data.data.id;

    // Assign teacher to batch1
    if (teacherId) {
      await fetch(`${BASE_URL}/batches/${assignedBatchId}/teachers/${teacherId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    }

    // Admin creates unassigned batch
    const batch2Res = await fetch(`${BASE_URL}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `Phase6 Unassigned Batch ${Date.now()}`,
        subject: 'Physics',
        scheduleDays: ['TUE', 'THU'],
        startTime: '11:00',
        endTime: '12:30',
      }),
    });
    const batch2Data = await batch2Res.json();
    const unassignedBatchId = batch2Data.data.id;

    // Create a student in assigned batch
    const studentRes = await fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `Report Student ${Date.now()}`,
        parentName: 'Parent Report',
        studentMobile: '9888877777',
        parentWhatsapp: '9888877777',
        course: 'Science',
      }),
    });
    const studentData = await studentRes.json();
    const studentId = studentData.data.id;

    // Enroll student into assigned batch
    await fetch(`${BASE_URL}/batches/${assignedBatchId}/students/${studentId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // Mark attendance
    const today = new Date().toISOString().split('T')[0];
    await fetch(`${BASE_URL}/attendance/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        batchId: assignedBatchId,
        date: today,
        records: [{ studentId, status: 'PRESENT' }],
      }),
    });

    // ========================================================================
    // 1. REPORTS TESTS
    // ========================================================================
    // 1.1 Unauthenticated request returns 401
    const unauthReports = await fetch(`${BASE_URL}/reports/attendance`);
    assert('Unauthenticated request to /api/reports/attendance returns HTTP 401', unauthReports.status === 401);

    // 1.2 Admin accesses attendance reports
    const adminAttReport = await fetch(`${BASE_URL}/reports/attendance`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminAttData = await adminAttReport.json();
    assert(
      'Admin can access attendance reports (HTTP 200)',
      adminAttReport.status === 200 && adminAttData.success === true && typeof adminAttData.data.attendancePercentage === 'number'
    );

    // 1.3 Teacher accesses attendance report for assigned batch
    const teacherAssignedAtt = await fetch(`${BASE_URL}/reports/attendance?batchId=${assignedBatchId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const teacherAssignedData = await teacherAssignedAtt.json();
    assert(
      'Teacher can access attendance report for assigned batch (HTTP 200)',
      teacherAssignedAtt.status === 200 && teacherAssignedData.success === true
    );

    // 1.4 Teacher requesting unassigned batch returns 403
    const teacherUnassignedAtt = await fetch(`${BASE_URL}/reports/attendance?batchId=${unassignedBatchId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert(
      'Teacher requesting attendance report for unassigned batch returns HTTP 403',
      teacherUnassignedAtt.status === 403
    );

    // 1.5 Teacher forbidden from Fees report
    const teacherFeesReport = await fetch(`${BASE_URL}/reports/fees`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert('Teacher forbidden from accessing Fees report (HTTP 403)', teacherFeesReport.status === 403);

    // 1.6 Teacher forbidden from Payments report
    const teacherPaymentsReport = await fetch(`${BASE_URL}/reports/payments`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert('Teacher forbidden from accessing Payments report (HTTP 403)', teacherPaymentsReport.status === 403);

    // 1.7 Admin accesses Fees report
    const adminFeesReport = await fetch(`${BASE_URL}/reports/fees`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminFeesData = await adminFeesReport.json();
    assert(
      'Admin can access fees report (HTTP 200)',
      adminFeesReport.status === 200 && adminFeesData.success === true && typeof adminFeesData.data.totalBilled === 'number'
    );

    // 1.8 Admin accesses Payments report
    const adminPaymentsReport = await fetch(`${BASE_URL}/reports/payments`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminPaymentsData = await adminPaymentsReport.json();
    assert(
      'Admin can access payments report (HTTP 200)',
      adminPaymentsReport.status === 200 && adminPaymentsData.success === true && Array.isArray(adminPaymentsData.data.records)
    );

    // ========================================================================
    // 2. CSV EXPORT TESTS
    // ========================================================================
    // 2.1 Admin exports attendance CSV
    const adminAttCsv = await fetch(`${BASE_URL}/reports/attendance/export?batchId=${assignedBatchId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const attCsvText = await adminAttCsv.text();
    assert(
      'Admin can export attendance CSV with text/csv header (HTTP 200)',
      adminAttCsv.status === 200 &&
        Boolean(adminAttCsv.headers.get('content-type')?.includes('text/csv')) &&
        attCsvText.includes('Date,Student Name,Batch Name')
    );

    // 2.2 Verify no secrets or credentials appear in exported CSV
    const containsSecrets = Boolean(
      (env.SUPABASE_SERVICE_ROLE_KEY && attCsvText.includes(env.SUPABASE_SERVICE_ROLE_KEY)) ||
      attCsvText.includes('password')
    );
    assert('Attendance CSV export does not contain secrets or passwords', !containsSecrets);

    // 2.3 Teacher exports assigned batch attendance CSV
    const teacherAttCsv = await fetch(`${BASE_URL}/reports/attendance/export?batchId=${assignedBatchId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert(
      'Teacher can export attendance CSV for assigned batch (HTTP 200)',
      teacherAttCsv.status === 200 && Boolean(teacherAttCsv.headers.get('content-type')?.includes('text/csv'))
    );

    // 2.4 Teacher attempting unassigned batch attendance CSV export returns 403
    const teacherUnassignedCsv = await fetch(`${BASE_URL}/reports/attendance/export?batchId=${unassignedBatchId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert('Teacher attempting unassigned batch export returns HTTP 403', teacherUnassignedCsv.status === 403);

    // 2.5 Teacher forbidden from fees CSV export
    const teacherFeesCsv = await fetch(`${BASE_URL}/reports/fees/export`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert('Teacher forbidden from exporting fees CSV (HTTP 403)', teacherFeesCsv.status === 403);

    // 2.6 Admin exports fees CSV and payments CSV
    const adminFeesCsv = await fetch(`${BASE_URL}/reports/fees/export`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminPaymentsCsv = await fetch(`${BASE_URL}/reports/payments/export`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      'Admin can export fees and payments CSV (HTTP 200)',
      adminFeesCsv.status === 200 && adminPaymentsCsv.status === 200
    );

    // ========================================================================
    // 3. ANNOUNCEMENTS TESTS
    // ========================================================================
    // 3.1 Unauthenticated announcement creation rejected (401)
    const unauthAnnounce = await fetch(`${BASE_URL}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', message: 'Hello', batchIds: [assignedBatchId] }),
    });
    assert('Unauthenticated announcement creation returns HTTP 401', unauthAnnounce.status === 401);

    // 3.2 Teacher cannot create announcement (403)
    const teacherAnnounce = await fetch(`${BASE_URL}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({ title: 'Test', message: 'Hello', batchIds: [assignedBatchId] }),
    });
    assert('Teacher cannot create announcements (HTTP 403)', teacherAnnounce.status === 403);

    // 3.3 Invalid announcement payload rejected (400)
    const invalidAnnounce = await fetch(`${BASE_URL}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ title: '', message: '', batchIds: [] }),
    });
    assert('Invalid announcement payload rejected with HTTP 400', invalidAnnounce.status === 400);

    // 3.4 Admin creates valid announcement targeting assigned batch
    const createAnnounce = await fetch(`${BASE_URL}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: 'Important Exam Notification',
        message: 'Midterm exams will commence next Monday at 09:00 AM sharp.',
        batchIds: [assignedBatchId],
      }),
    });
    const announceData = await createAnnounce.json();
    const createdAnnouncementId = announceData.data?.id;
    assert(
      'Admin creates announcement targeting batch successfully (HTTP 201)',
      createAnnounce.status === 201 && announceData.success === true && announceData.data.status === 'DRAFT'
    );

    // 3.5 Teacher cannot trigger announcement send (403)
    const teacherSendAnnounce = await fetch(`${BASE_URL}/announcements/${createdAnnouncementId}/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert('Teacher cannot trigger announcement send (HTTP 403)', teacherSendAnnounce.status === 403);

    // 3.6 Admin sends announcement via provider abstraction
    const sendAnnounce = await fetch(`${BASE_URL}/announcements/${createdAnnouncementId}/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const sendData = await sendAnnounce.json();
    assert(
      'Admin sends announcement successfully via WhatsApp provider (HTTP 200)',
      sendAnnounce.status === 200 && sendData.success === true && sendData.data.announcement.status === 'SENT'
    );

    // ========================================================================
    // 4. RECEIPTS TESTS
    // ========================================================================
    // Record a successful payment to test receipt generation
    const paymentRes = await fetch(`${BASE_URL}/payments/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        studentId,
        amount: 2500,
        provider: 'MANUAL',
        referenceId: `TXN-REC-${Date.now()}`,
        remarks: 'Tuition Fee Payment with Receipt',
      }),
    });
    const paymentData = await paymentRes.json();
    const receipt = paymentData.data?.receipt;
    const receiptId = receipt?.id;

    assert(
      'Successful payment automatically generates valid receipt record',
      receiptId !== undefined && receipt.receipt_number.startsWith('REC-')
    );

    // 4.1 Teacher cannot access receipts (403)
    const teacherReceipt = await fetch(`${BASE_URL}/receipts/${receiptId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert('Teacher cannot access receipt endpoint (HTTP 403)', teacherReceipt.status === 403);

    // 4.2 Admin views detailed receipt
    const adminReceipt = await fetch(`${BASE_URL}/receipts/${receiptId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminReceiptData = await adminReceipt.json();
    assert(
      'Admin views detailed receipt information (HTTP 200)',
      adminReceipt.status === 200 &&
        adminReceiptData.success === true &&
        adminReceiptData.data.receipt.receipt_number === receipt.receipt_number
    );

    // 4.3 Printable receipt endpoint returns HTML
    const printableReceipt = await fetch(`${BASE_URL}/receipts/${receiptId}/pdf`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const receiptHtml = await printableReceipt.text();
    assert(
      'Printable receipt endpoint returns HTML with receipt number and amount (HTTP 200)',
      printableReceipt.status === 200 &&
        receiptHtml.includes(receipt.receipt_number) &&
        receiptHtml.includes('2,500.00')
    );

    // 4.4 Failed payments do not produce valid receipts
    const failedPaymentLookup = await fetch(`${BASE_URL}/receipts/00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert('Non-existent or invalid payment receipt lookup returns HTTP 404', failedPaymentLookup.status === 404);
  } catch (err: any) {
    console.error('Unhandled test error:', err);
    failCount++;
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log(`\n📊 Phase 6 Test Summary: ${passCount} PASSED, ${failCount} FAILED\n`);
  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase6Tests();
