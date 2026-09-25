import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import app from '../app.js';
import { Server } from 'http';

async function runPhase7Tests() {
  console.log('🧪 Starting Automated Phase 7 (Academy Branding, Settings & Security) Tests...\n');

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
  const PORT = 10015;
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
    // 1. ACADEMY SETTINGS / BRANDING ENDPOINTS
    // ========================================================================
    // 1.1 Unauthenticated request returns 401
    const unauthRes = await fetch(`${BASE_URL}/settings/academy`);
    assert('Unauthenticated request to /api/settings/academy returns HTTP 401', unauthRes.status === 401);

    // 1.2 Admin can fetch settings
    const adminGetRes = await fetch(`${BASE_URL}/settings/academy`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminGetData = await adminGetRes.json();
    assert(
      'Admin can fetch academy settings (HTTP 200)',
      adminGetRes.status === 200 && adminGetData.success === true && typeof adminGetData.data.academy_name === 'string'
    );

    // 1.3 Teacher can view academy branding
    const teacherGetRes = await fetch(`${BASE_URL}/settings/academy`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const teacherGetData = await teacherGetRes.json();
    assert(
      'Teacher can view academy branding info (HTTP 200)',
      teacherGetRes.status === 200 && teacherGetData.success === true && typeof teacherGetData.data.academy_name === 'string'
    );

    // 1.4 Teacher cannot update academy settings (403)
    const teacherPatchRes = await fetch(`${BASE_URL}/settings/academy`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({ academy_name: 'Hacked Academy' }),
    });
    assert('Teacher cannot update academy settings (HTTP 403)', teacherPatchRes.status === 403);

    // 1.5 Invalid payload rejected (400)
    const invalidPatchRes = await fetch(`${BASE_URL}/settings/academy`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ email: 'not-an-email-address' }),
    });
    assert('Invalid email format in settings rejected with HTTP 400', invalidPatchRes.status === 400);

    // 1.6 Admin can update academy settings successfully
    const testAcademyName = `Apex Academy Test ${Date.now()}`;
    const adminPatchRes = await fetch(`${BASE_URL}/settings/academy`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        academy_name: testAcademyName,
        phone: '+91 99999 88888',
        email: 'info@apexacademy.edu',
        address: '456 Knowledge Campus, Pune',
        website: 'https://apexacademy.edu',
      }),
    });
    const adminPatchData = await adminPatchRes.json();
    assert(
      'Admin updates academy settings successfully (HTTP 200)',
      adminPatchRes.status === 200 &&
        adminPatchData.success === true &&
        adminPatchData.data.academy_name === testAcademyName
    );

    // 1.7 Verify updated branding appears on receipt
    // Create a student and payment to verify receipt branding
    const studentRes = await fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `Branding Student ${Date.now()}`,
        parentName: 'Parent Branding',
        studentMobile: '9111122222',
        parentWhatsapp: '9111122222',
        course: 'JEE Advanced',
      }),
    });
    const studentData = await studentRes.json();
    const studentId = studentData.data.id;

    const paymentRes = await fetch(`${BASE_URL}/payments/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        studentId,
        amount: 3000,
        provider: 'MANUAL',
        referenceId: `TXN-BRAND-${Date.now()}`,
      }),
    });
    const paymentData = await paymentRes.json();
    const receiptId = paymentData.data?.receipt?.id;

    const receiptDetailsRes = await fetch(`${BASE_URL}/receipts/${receiptId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const receiptDetailsData = await receiptDetailsRes.json();
    assert(
      'Updated academy branding reflected in receipt details',
      receiptDetailsRes.status === 200 && receiptDetailsData.data.academy.name === testAcademyName
    );

    // ========================================================================
    // 2. SECURITY AUDIT CHECKS
    // ========================================================================
    // 2.1 Verify service role key is not returned on any public/client endpoint
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthText = await healthRes.text();
    assert(
      'Health endpoint contains no credentials',
      !Boolean(env.SUPABASE_SERVICE_ROLE_KEY && healthText.includes(env.SUPABASE_SERVICE_ROLE_KEY))
    );

    const settingsText = JSON.stringify(adminGetData);
    assert(
      'Settings endpoint contains no service role key or secrets',
      !Boolean(env.SUPABASE_SERVICE_ROLE_KEY && settingsText.includes(env.SUPABASE_SERVICE_ROLE_KEY))
    );

    // Restore clean default name for subsequent runs
    await fetch(`${BASE_URL}/settings/academy`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        academy_name: 'Apex Academy',
        phone: '+91 98765 43210',
        email: 'contact@apexacademy.edu',
        address: '123 Education Boulevard, Tech City',
        website: 'https://apexacademy.edu',
      }),
    });
  } catch (err: any) {
    console.error('Unhandled Phase 7 test error:', err);
    failCount++;
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log(`\n📊 Phase 7 Test Summary: ${passCount} PASSED, ${failCount} FAILED\n`);
  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase7Tests();
