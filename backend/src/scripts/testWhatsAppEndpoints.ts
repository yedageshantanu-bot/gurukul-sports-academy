import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import app from '../app.js';
import { Server } from 'http';

async function runWhatsAppTests() {
  console.log('🧪 Starting Automated Phase 5 WhatsApp Automation & RBAC Tests...\n');

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
  const PORT = 10013;
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
    // -------------------------------------------------------------------------
    // TEST 1: Unauthenticated request is rejected (401)
    // -------------------------------------------------------------------------
    const unauthRes = await fetch(`${BASE_URL}/whatsapp/templates`);
    assert('Unauthenticated request to /api/whatsapp/templates returns HTTP 401', unauthRes.status === 401);

    // -------------------------------------------------------------------------
    // TEST 2: Teacher cannot access WhatsApp templates (403)
    // -------------------------------------------------------------------------
    const teacherTplRes = await fetch(`${BASE_URL}/whatsapp/templates`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert('Teacher cannot access WhatsApp templates (HTTP 403)', teacherTplRes.status === 403);

    // -------------------------------------------------------------------------
    // TEST 3: Teacher cannot access WhatsApp messages (403)
    // -------------------------------------------------------------------------
    const teacherMsgRes = await fetch(`${BASE_URL}/whatsapp/messages`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert('Teacher cannot access WhatsApp message audit log (HTTP 403)', teacherMsgRes.status === 403);

    // -------------------------------------------------------------------------
    // TEST 4: Admin lists templates (auto-seeds defaults if empty) (200)
    // -------------------------------------------------------------------------
    const listTplRes = await fetch(`${BASE_URL}/whatsapp/templates`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listTplData = await listTplRes.json();
    assert(
      'Admin lists WhatsApp templates successfully (HTTP 200)',
      listTplRes.status === 200 && Array.isArray(listTplData.data) && listTplData.data.length >= 4,
      listTplData
    );

    // -------------------------------------------------------------------------
    // TEST 5: Admin creates a new custom template (201)
    // -------------------------------------------------------------------------
    const createTplRes = await fetch(`${BASE_URL}/whatsapp/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: `Custom Test Template ${Date.now()}`,
        eventType: 'ATTENDANCE_ABSENT',
        body: 'Alert: {{student_name}} absent from {{batch_name}} at {{academy_name}} on {{date}}.',
      }),
    });
    const createTplData = await createTplRes.json();
    assert(
      'Admin creates custom template successfully (HTTP 201)',
      createTplRes.status === 201 && createTplData.success && createTplData.data?.id,
      createTplData
    );
    const createdTplId = createTplData.data?.id;

    // -------------------------------------------------------------------------
    // TEST 6: Admin edits template (200)
    // -------------------------------------------------------------------------
    const editTplRes = await fetch(`${BASE_URL}/whatsapp/templates/${createdTplId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        body: 'Updated Alert: {{student_name}} absent from {{batch_name}} at {{academy_name}} on {{date}}.',
      }),
    });
    const editTplData = await editTplRes.json();
    assert(
      'Admin updates template body successfully (HTTP 200)',
      editTplRes.status === 200 && editTplData.data?.body?.startsWith('Updated Alert:'),
      editTplData
    );

    // -------------------------------------------------------------------------
    // TEST 7: Admin deactivates & reactivates template (200)
    // -------------------------------------------------------------------------
    const deactTplRes = await fetch(`${BASE_URL}/whatsapp/templates/${createdTplId}/deactivate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const deactTplData = await deactTplRes.json();
    assert(
      'Admin deactivates template (HTTP 200)',
      deactTplRes.status === 200 && deactTplData.data?.active === false
    );

    const actTplRes = await fetch(`${BASE_URL}/whatsapp/templates/${createdTplId}/activate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const actTplData = await actTplRes.json();
    assert(
      'Admin reactivates template (HTTP 200)',
      actTplRes.status === 200 && actTplData.data?.active === true
    );

    // -------------------------------------------------------------------------
    // TEST 8: Whitelisted Admin Number sends custom message (HTTP 200, status SENT/MOCK)
    // -------------------------------------------------------------------------
    const sendCustomRes = await fetch(`${BASE_URL}/whatsapp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        recipientPhone: '+919404849500',
        messageBody: 'Hello from Gurukul Academy automated WhatsApp system test.',
        eventType: 'TEST_DIRECT',
      }),
    });
    const sendCustomData = await sendCustomRes.json();
    assert(
      'Admin sends custom message to whitelisted number (HTTP 200, sent, queued, or honest QR_READY)',
      (sendCustomRes.status === 200 &&
        sendCustomData.success &&
        (sendCustomData.queued === true || sendCustomData.connected === true)) ||
      (sendCustomData.disconnected === true && sendCustomData.error?.code === 'WHATSAPP_DISCONNECTED'),
      sendCustomData
    );

    // -------------------------------------------------------------------------
    // TEST 9: Dummy number is safely blocked from live delivery to protect real users
    // -------------------------------------------------------------------------
    const sendFailRes = await fetch(`${BASE_URL}/whatsapp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        recipientPhone: '0000000000',
        messageBody: 'This dummy message should be blocked from reaching live users.',
        eventType: 'FAILURE_TEST',
      }),
    });
    const sendFailData = await sendFailRes.json();
    assert(
      'Dummy number is safely blocked or failed without crashing server',
      sendFailRes.status === 400 || sendFailData.success === false || sendFailData.error?.code === 'DELIVERY_FAILED',
      sendFailData
    );

    // -------------------------------------------------------------------------
    // Setup Test Entities: Student, Batch, Enrollment
    // -------------------------------------------------------------------------
    const studentRes = await fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: `WhatsApp Test Student ${Date.now()}`,
        studentMobile: '919876500001',
        parentWhatsapp: '919876500002',
        parentName: 'Ramesh Sharma',
        course: 'Physics IIT',
        monthlyFee: 4500.0,
      }),
    });
    const studentData = await studentRes.json();
    const testStudentId = studentData.data?.id;

    const batchRes = await fetch(`${BASE_URL}/batches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: `WhatsApp Batch ${Date.now()}`,
        subject: 'Physics',
        scheduleDays: ['MONDAY', 'WEDNESDAY'],
      }),
    });
    const batchData = await batchRes.json();
    const testBatchId = batchData.data?.id;

    // Enroll student into batch
    await fetch(`${BASE_URL}/batches/${testBatchId}/students/${testStudentId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // -------------------------------------------------------------------------
    // TEST 10: Marking Attendance ABSENT automatically triggers ATTENDANCE_ABSENT log
    // -------------------------------------------------------------------------
    const today = new Date().toISOString().split('T')[0];
    const markAbsentRes = await fetch(`${BASE_URL}/attendance/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        batchId: testBatchId,
        date: today,
        records: [{ studentId: testStudentId, status: 'ABSENT' }],
      }),
    });
    assert('Admin marks student ABSENT (HTTP 200)', markAbsentRes.status === 200);

    // Wait 500ms for non-blocking automation execution
    await new Promise((r) => setTimeout(r, 600));

    // Verify message record in either whatsapp_messages (if sent) or whatsapp_queue (if queued)
    const absentLogsRes = await fetch(
      `${BASE_URL}/whatsapp/messages?studentId=${testStudentId}&eventType=ATTENDANCE_ABSENT`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const absentLogsData = await absentLogsRes.json();
    const absentQueueRes = await fetch(
      `${BASE_URL}/whatsapp/queue?studentId=${testStudentId}&eventType=ATTENDANCE_ABSENT`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const absentQueueData = await absentQueueRes.json();
    const hasAbsentRecord = (Array.isArray(absentLogsData.data) && absentLogsData.data.length > 0) ||
      (Array.isArray(absentQueueData.data) && absentQueueData.data.length > 0);
    assert(
      'ATTENDANCE_ABSENT automation message generated in audit log or queue',
      hasAbsentRecord
    );

    // -------------------------------------------------------------------------
    // TEST 11: Recording Payment automatically triggers PAYMENT_SUCCESS log
    // -------------------------------------------------------------------------
    const manualPayRes = await fetch(`${BASE_URL}/payments/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        studentId: testStudentId,
        amount: 4500.0,
        paymentMethod: 'CASH',
        notes: 'WhatsApp automation test payment',
      }),
    });
    assert('Payment recorded successfully (HTTP 200)', manualPayRes.status === 200);

    // Wait 500ms for non-blocking automation
    await new Promise((r) => setTimeout(r, 600));

    const payLogsRes = await fetch(
      `${BASE_URL}/whatsapp/messages?studentId=${testStudentId}&eventType=PAYMENT_SUCCESS`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const payLogsData = await payLogsRes.json();
    const payQueueRes = await fetch(
      `${BASE_URL}/whatsapp/queue?studentId=${testStudentId}&eventType=PAYMENT_SUCCESS`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const payQueueData = await payQueueRes.json();
    const hasPayRecord = (Array.isArray(payLogsData.data) && payLogsData.data.length > 0) ||
      (Array.isArray(payQueueData.data) && payQueueData.data.length > 0);
    assert(
      'PAYMENT_SUCCESS automation message generated in audit log or queue',
      hasPayRecord
    );

    // -------------------------------------------------------------------------
    // TEST 12: Trigger Fee Due Reminder automation
    // -------------------------------------------------------------------------
    // Assign student fee
    const billingPeriod = '2026-12';
    const assignFeeRes = await fetch(`${BASE_URL}/fees/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        studentId: testStudentId,
        billingPeriod,
        amountDue: 4500.0,
        dueDate: '2026-12-28',
      }),
    });
    const assignFeeData = await assignFeeRes.json();
    const testStudentFeeId = assignFeeData.data?.id;

    const feeReminderRes = await fetch(`${BASE_URL}/whatsapp/trigger-fee-reminder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        studentId: testStudentId,
        studentFeeId: testStudentFeeId,
        eventType: 'FEE_DUE',
      }),
    });
    const feeReminderData = await feeReminderRes.json();
    assert(
      'Admin triggers FEE_DUE reminder automation successfully (HTTP 200 or honest QR_READY)',
      (feeReminderRes.status === 200 &&
        feeReminderData.success &&
        (feeReminderData.queued === true || feeReminderData.data?.event_type === 'FEE_DUE')) ||
      (feeReminderData.disconnected === true && feeReminderData.error?.code === 'WHATSAPP_DISCONNECTED'),
      feeReminderData
    );

    // -------------------------------------------------------------------------
    // TEST 13: Admin lists message audit logs with filters
    // -------------------------------------------------------------------------
    const listMessagesRes = await fetch(`${BASE_URL}/whatsapp/messages`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listMessagesData = await listMessagesRes.json();
    assert(
      'Admin lists filtered message audit log (HTTP 200)',
      listMessagesRes.status === 200 &&
        Array.isArray(listMessagesData.data)
    );
  } finally {
    server?.close();
  }

  console.log(`\n📊 WhatsApp Automation Test Summary: ${passCount} PASSED, ${failCount} FAILED\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runWhatsAppTests().catch((err) => {
  console.error('Unhandled error in WhatsApp tests:', err);
  process.exit(1);
});
