import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import app from '../app.js';
import { Server } from 'http';

async function runFeesTests() {
  console.log('🧪 Starting Automated Phase 4 Fees, Payments & Provider Abstraction Tests...\n');

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
  const PORT = 10012;
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
    const unauthRes = await fetch(`${BASE_URL}/fees/plans`);
    assert('Unauthenticated request to /api/fees/plans returns HTTP 401', unauthRes.status === 401);

    // -------------------------------------------------------------------------
    // TEST 2: Teacher is forbidden from managing fee plans (403)
    // -------------------------------------------------------------------------
    const teacherPlanRes = await fetch(`${BASE_URL}/fees/plans`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert('Teacher cannot access fee plans (HTTP 403)', teacherPlanRes.status === 403);

    // -------------------------------------------------------------------------
    // TEST 3: Admin creates a fee plan (201)
    // -------------------------------------------------------------------------
    const createPlanRes = await fetch(`${BASE_URL}/fees/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: `Maths Olympiad Plan ${Date.now()}`,
        amount: 3500.0,
        frequency: 'MONTHLY',
        dueDay: 10,
      }),
    });
    const createPlanData = await createPlanRes.json();
    assert(
      'Admin creates fee plan successfully (HTTP 201)',
      createPlanRes.status === 201 && createPlanData.success && createPlanData.data?.id,
      createPlanData
    );
    const createdPlanId = createPlanData.data?.id;

    // -------------------------------------------------------------------------
    // TEST 4: Admin edits fee plan (200)
    // -------------------------------------------------------------------------
    const updatePlanRes = await fetch(`${BASE_URL}/fees/plans/${createdPlanId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        amount: 3800.0,
      }),
    });
    const updatePlanData = await updatePlanRes.json();
    assert(
      'Admin edits fee plan successfully (HTTP 200)',
      updatePlanRes.status === 200 && Number(updatePlanData.data?.amount) === 3800.0,
      updatePlanData
    );

    // -------------------------------------------------------------------------
    // TEST 5: Admin deactivates & reactivates fee plan (200)
    // -------------------------------------------------------------------------
    const deactPlanRes = await fetch(`${BASE_URL}/fees/plans/${createdPlanId}/deactivate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const deactPlanData = await deactPlanRes.json();
    assert(
      'Admin deactivates fee plan (HTTP 200)',
      deactPlanRes.status === 200 && deactPlanData.data?.active === false
    );

    const actPlanRes = await fetch(`${BASE_URL}/fees/plans/${createdPlanId}/activate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const actPlanData = await actPlanRes.json();
    assert(
      'Admin reactivates fee plan (HTTP 200)',
      actPlanRes.status === 200 && actPlanData.data?.active === true
    );

    // -------------------------------------------------------------------------
    // Setup a test student
    // -------------------------------------------------------------------------
    const studentRes = await fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: `Fee Test Student ${Date.now()}`,
        studentMobile: '9876543210',
        parentWhatsapp: '9876543210',
        course: 'Science & Maths',
        monthlyFee: 3800.0,
      }),
    });
    const studentData = await studentRes.json();
    const testStudentId = studentData.data?.id;

    // -------------------------------------------------------------------------
    // TEST 6: Teacher cannot assign or modify student fees (403)
    // -------------------------------------------------------------------------
    const teacherFeeRes = await fetch(`${BASE_URL}/fees/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`,
      },
      body: JSON.stringify({
        studentId: testStudentId,
        billingPeriod: '2026-09',
        amountDue: 3800.0,
        dueDate: '2026-09-10',
      }),
    });
    assert('Teacher cannot assign student fees (HTTP 403)', teacherFeeRes.status === 403);

    // -------------------------------------------------------------------------
    // TEST 7: Admin assigns student fee (201)
    // -------------------------------------------------------------------------
    const billingPeriod = `2026-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const assignFeeRes = await fetch(`${BASE_URL}/fees/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        studentId: testStudentId,
        feePlanId: createdPlanId,
        billingPeriod,
        amountDue: 3800.0,
        dueDate: '2026-09-25',
      }),
    });
    const assignFeeData = await assignFeeRes.json();
    assert(
      'Admin assigns student fee successfully (HTTP 201)',
      assignFeeRes.status === 201 && assignFeeData.success && assignFeeData.data?.id,
      assignFeeData
    );
    const testStudentFeeId = assignFeeData.data?.id;

    // -------------------------------------------------------------------------
    // TEST 8: Duplicate student fee for same billing period is rejected (400)
    // -------------------------------------------------------------------------
    const dupFeeRes = await fetch(`${BASE_URL}/fees/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        studentId: testStudentId,
        billingPeriod,
        amountDue: 3800.0,
        dueDate: '2026-09-25',
      }),
    });
    assert('Duplicate student fee for same billing period is rejected (HTTP 400)', dupFeeRes.status === 400);

    // -------------------------------------------------------------------------
    // TEST 9: Invalid student/fee relationship is rejected (400 or 404)
    // -------------------------------------------------------------------------
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const invalidStudentFeeRes = await fetch(`${BASE_URL}/fees/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        studentId: fakeUuid,
        billingPeriod: '2026-10',
        amountDue: 3800.0,
        dueDate: '2026-10-25',
      }),
    });
    assert('Non-existent student ID is rejected (HTTP 404)', invalidStudentFeeRes.status === 404);

    // -------------------------------------------------------------------------
    // TEST 10: Teacher cannot view payment records (403)
    // -------------------------------------------------------------------------
    const teacherPayRes = await fetch(`${BASE_URL}/payments`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert('Teacher cannot access payment records (HTTP 403)', teacherPayRes.status === 403);

    // -------------------------------------------------------------------------
    // TEST 11: Mock payment order creation works (200)
    // -------------------------------------------------------------------------
    const orderRes = await fetch(`${BASE_URL}/payments/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        studentId: testStudentId,
        studentFeeId: testStudentFeeId,
        amount: 2000.0,
        provider: 'MOCK',
      }),
    });
    const orderData = await orderRes.json();
    assert(
      'Mock payment order creation works (HTTP 200)',
      orderRes.status === 200 &&
        orderData.success &&
        orderData.data?.orderId?.startsWith('mock_ord_') &&
        orderData.data?.provider === 'MOCK',
      orderData
    );
    const { paymentRecordId, orderId } = orderData.data || {};

    // -------------------------------------------------------------------------
    // TEST 12: Failed payment is not marked successful (HTTP 400 rejection)
    // -------------------------------------------------------------------------
    const failVerifyRes = await fetch(`${BASE_URL}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        paymentRecordId,
        orderId,
        paymentId: 'mock_pay_fail_test',
        signature: 'mock_fail_signature',
        provider: 'MOCK',
      }),
    });
    assert(
      'Simulated payment failure is rejected and not marked successful (HTTP 400)',
      failVerifyRes.status === 400
    );

    // Check payment record status is FAILED
    const checkFailedPayRes = await fetch(`${BASE_URL}/payments/${paymentRecordId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const checkFailedPayData = await checkFailedPayRes.json();
    assert(
      'Payment record status is FAILED in database',
      checkFailedPayData.data?.status === 'FAILED'
    );

    // Check student fee is untouched
    const checkFeeUntouchedRes = await fetch(`${BASE_URL}/fees/students/${testStudentFeeId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const checkFeeUntouchedData = await checkFeeUntouchedRes.json();
    assert(
      'Student fee amount_paid remains untouched after failed payment',
      Number(checkFeeUntouchedData.data?.amount_paid) === 0
    );

    // -------------------------------------------------------------------------
    // TEST 13: Mock payment verification works server-side (200)
    // -------------------------------------------------------------------------
    // Create fresh order for successful verification
    const validOrderRes = await fetch(`${BASE_URL}/payments/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        studentId: testStudentId,
        studentFeeId: testStudentFeeId,
        amount: 2000.0,
        provider: 'MOCK',
      }),
    });
    const validOrderData = await validOrderRes.json();
    const validPaymentRecordId = validOrderData.data?.paymentRecordId;
    const validOrderId = validOrderData.data?.orderId;

    const verifyRes = await fetch(`${BASE_URL}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        paymentRecordId: validPaymentRecordId,
        orderId: validOrderId,
        paymentId: `mock_pay_${Date.now()}`,
        provider: 'MOCK',
      }),
    });
    const verifyData = await verifyRes.json();
    assert(
      'Mock payment verification succeeds server-side (HTTP 200)',
      verifyRes.status === 200 && verifyData.success && verifyData.data?.payment?.status === 'SUCCESS',
      verifyData
    );
    assert(
      'Receipt is generated upon successful payment verification',
      verifyData.data?.receipt?.receipt_number?.startsWith('REC-')
    );

    // Check student fee status is updated to PARTIAL
    const checkPartialFeeRes = await fetch(`${BASE_URL}/fees/students/${testStudentFeeId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const checkPartialFeeData = await checkPartialFeeRes.json();
    assert(
      'Student fee status updated to PARTIAL and amount_paid credited',
      Number(checkPartialFeeData.data?.amount_paid) === 2000.0 &&
        checkPartialFeeData.data?.status === 'PARTIAL'
    );

    // -------------------------------------------------------------------------
    // TEST 14: Duplicate payment verification is idempotent (does not double credit)
    // -------------------------------------------------------------------------
    const duplicateVerifyRes = await fetch(`${BASE_URL}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        paymentRecordId: validPaymentRecordId,
        orderId: validOrderId,
        paymentId: 'mock_pay_already_done',
        provider: 'MOCK',
      }),
    });
    const duplicateVerifyData = await duplicateVerifyRes.json();
    assert(
      'Duplicate payment verification is idempotent (isDuplicate=true)',
      duplicateVerifyRes.status === 200 && duplicateVerifyData.data?.isDuplicate === true
    );

    // Check student fee amount_paid is still 2000, NOT 4000
    const checkIdempotentFeeRes = await fetch(`${BASE_URL}/fees/students/${testStudentFeeId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const checkIdempotentFeeData = await checkIdempotentFeeRes.json();
    assert(
      'Student fee was NOT double credited by duplicate verification',
      Number(checkIdempotentFeeData.data?.amount_paid) === 2000.0
    );

    // -------------------------------------------------------------------------
    // TEST 15: Manual cash payment recording works and transitions status to PAID
    // -------------------------------------------------------------------------
    const manualPayRes = await fetch(`${BASE_URL}/payments/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        studentId: testStudentId,
        studentFeeId: testStudentFeeId,
        amount: 1800.0, // Remaining balance (3800 - 2000 = 1800)
        paymentMethod: 'CASH',
        notes: 'Cash received at academy front desk',
      }),
    });
    const manualPayData = await manualPayRes.json();
    assert(
      'Admin records manual payment successfully (HTTP 200)',
      manualPayRes.status === 200 && manualPayData.success && manualPayData.data?.payment?.status === 'SUCCESS',
      manualPayData
    );

    // Check student fee status transitions to PAID
    const checkPaidFeeRes = await fetch(`${BASE_URL}/fees/students/${testStudentFeeId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const checkPaidFeeData = await checkPaidFeeRes.json();
    assert(
      'Student fee balance fully settled and status transitions to PAID',
      Number(checkPaidFeeData.data?.amount_paid) === 3800.0 && checkPaidFeeData.data?.status === 'PAID'
    );

    // -------------------------------------------------------------------------
    // TEST 16: Admin views payment records list (200)
    // -------------------------------------------------------------------------
    const listPaymentsRes = await fetch(`${BASE_URL}/payments?studentId=${testStudentId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listPaymentsData = await listPaymentsRes.json();
    assert(
      'Admin lists payment records with linked student & receipt (HTTP 200)',
      listPaymentsRes.status === 200 && Array.isArray(listPaymentsData.data) && listPaymentsData.data.length >= 2
    );
  } finally {
    server?.close();
  }

  console.log(`\n📊 Fees & Payments Test Summary: ${passCount} PASSED, ${failCount} FAILED\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runFeesTests().catch((err) => {
  console.error('Unhandled error in fees tests:', err);
  process.exit(1);
});
