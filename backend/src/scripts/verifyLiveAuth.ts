import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { ROLES, STATUS } from '../constants/index.js';
import app from '../app.js';
import { Server } from 'http';

async function verifyLivePhase1() {
  console.log('=====================================================');
  console.log('🔒 LIVE SUPABASE AUTHENTICATION & RBAC VERIFICATION');
  console.log('=====================================================\n');

  if (!supabaseAdmin) {
    console.error('❌ Supabase Admin client not configured');
    process.exit(1);
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    console.error('❌ Supabase URL or Anon Key not configured');
    process.exit(1);
  }

  if (
    !env.DEV_ADMIN_EMAIL ||
    !env.DEV_ADMIN_PASSWORD ||
    !env.DEV_TEACHER_EMAIL ||
    !env.DEV_TEACHER_PASSWORD
  ) {
    console.error('❌ Dev test credentials missing from environment variables');
    process.exit(1);
  }

  const adminEmail = env.DEV_ADMIN_EMAIL;
  const adminPassword = env.DEV_ADMIN_PASSWORD;
  const teacherEmail = env.DEV_TEACHER_EMAIL;
  const teacherPassword = env.DEV_TEACHER_PASSWORD;

  // Spin up local test server for backend JWT & RBAC endpoint calls
  let server: Server;
  const PORT = 10006;
  await new Promise<void>((resolve) => {
    server = app.listen(PORT, () => {
      resolve();
    });
  });

  const BASE_URL = `http://localhost:${PORT}/api`;
  let passCount = 0;
  let failCount = 0;

  function report(name: string, success: boolean, info?: string) {
    if (success) {
      passCount++;
      console.log(`✅ [PASS] ${name}${info ? ' (' + info + ')' : ''}`);
    } else {
      failCount++;
      console.error(`❌ [FAIL] ${name}${info ? ' (' + info + ')' : ''}`);
    }
  }

  try {
    // 1. Verify Auth Users Exist in Supabase Auth
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    if (usersError) throw usersError;

    const adminAuthUser = usersData.users.find(
      (u) => u.email?.toLowerCase() === adminEmail.toLowerCase()
    );
    const teacherAuthUser = usersData.users.find(
      (u) => u.email?.toLowerCase() === teacherEmail.toLowerCase()
    );

    report('Admin User exists in Supabase Auth', !!adminAuthUser, adminAuthUser ? `User ID verified` : 'Not found');
    report('Teacher User exists in Supabase Auth', !!teacherAuthUser, teacherAuthUser ? `User ID verified` : 'Not found');

    if (!adminAuthUser || !teacherAuthUser) {
      throw new Error('Required auth users not found. Run seed script first.');
    }

    // 2. Verify Database Profiles & Roles
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', adminAuthUser.id)
      .single();

    report(
      'Admin Profile exists with role ADMIN and status ACTIVE',
      adminProfile?.role === ROLES.ADMIN && adminProfile?.status === STATUS.ACTIVE,
      `role: ${adminProfile?.role}`
    );

    const { data: teacherProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', teacherAuthUser.id)
      .single();

    report(
      'Teacher Profile exists with role TEACHER and status ACTIVE',
      teacherProfile?.role === ROLES.TEACHER && teacherProfile?.status === STATUS.ACTIVE,
      `role: ${teacherProfile?.role}`
    );

    // 3. Verify Teacher Record Linked in teachers Table
    const { data: teacherRecord } = await supabaseAdmin
      .from('teachers')
      .select('*')
      .eq('profile_id', teacherAuthUser.id)
      .single();

    report(
      'Teacher record linked in teachers table with status ACTIVE',
      !!teacherRecord && teacherRecord.status === STATUS.ACTIVE,
      teacherRecord ? `linked to profile` : 'Missing'
    );

    // 4. Create standard Supabase client (using public anon key like frontend client)
    const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 5. Admin Live Login & Session Creation
    const { data: adminLoginData, error: adminLoginErr } = await client.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });

    const adminSession = adminLoginData?.session;
    report(
      'Admin live login against Supabase Auth succeeds',
      !adminLoginErr && !!adminSession,
      adminLoginErr ? adminLoginErr.message : 'Session created'
    );
    report(
      'Admin session creation verified with valid access token',
      !!adminSession?.access_token && !!adminSession?.user
    );

    // 6. Teacher Live Login & Session Creation
    const { data: teacherLoginData, error: teacherLoginErr } = await client.auth.signInWithPassword({
      email: teacherEmail,
      password: teacherPassword,
    });

    const teacherSession = teacherLoginData?.session;
    report(
      'Teacher live login against Supabase Auth succeeds',
      !teacherLoginErr && !!teacherSession,
      teacherLoginErr ? teacherLoginErr.message : 'Session created'
    );
    report(
      'Teacher session creation verified with valid access token',
      !!teacherSession?.access_token && !!teacherSession?.user
    );

    // 7. Backend JWT Verification
    const adminToken = adminSession?.access_token;
    const teacherToken = teacherSession?.access_token;

    if (adminToken) {
      const adminMeRes = await fetch(`${BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const adminMeJson = await adminMeRes.json();
      report(
        'Backend JWT verification: Validates Admin token and derives role ADMIN',
        adminMeRes.status === 200 && adminMeJson.data?.role === ROLES.ADMIN,
        `HTTP ${adminMeRes.status}, Derived Role: ${adminMeJson.data?.role}`
      );
    }

    if (teacherToken) {
      const teacherMeRes = await fetch(`${BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      const teacherMeJson = await teacherMeRes.json();
      report(
        'Backend JWT verification: Validates Teacher token, derives role TEACHER and teacherId',
        teacherMeRes.status === 200 &&
          teacherMeJson.data?.role === ROLES.TEACHER &&
          !!teacherMeJson.data?.teacherId,
        `HTTP ${teacherMeRes.status}, Derived Role: ${teacherMeJson.data?.role}, TeacherId: ${teacherMeJson.data?.teacherId}`
      );
    }

    // 8. ADMIN Authorization: access admin endpoint (Allowed) and teacher endpoint (Denied 403)
    if (adminToken) {
      const adminOnAdminRes = await fetch(`${BASE_URL}/test/admin-only`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      report(
        'ADMIN authorization: Access to /test/admin-only is ALLOWED (HTTP 200)',
        adminOnAdminRes.status === 200,
        `HTTP ${adminOnAdminRes.status}`
      );

      const adminOnTeacherRes = await fetch(`${BASE_URL}/test/teacher-only`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      report(
        'ADMIN role restriction: Access to /test/teacher-only is REJECTED (HTTP 403 FORBIDDEN)',
        adminOnTeacherRes.status === 403,
        `HTTP ${adminOnTeacherRes.status}`
      );
    }

    // 9. TEACHER Authorization: access teacher endpoint (Allowed) and admin endpoint (Denied 403)
    if (teacherToken) {
      const teacherOnTeacherRes = await fetch(`${BASE_URL}/test/teacher-only`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      report(
        'TEACHER authorization: Access to /test/teacher-only is ALLOWED (HTTP 200)',
        teacherOnTeacherRes.status === 200,
        `HTTP ${teacherOnTeacherRes.status}`
      );

      const teacherOnAdminRes = await fetch(`${BASE_URL}/test/admin-only`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      report(
        'TEACHER role restriction: Access to /test/admin-only is REJECTED (HTTP 403 FORBIDDEN)',
        teacherOnAdminRes.status === 403,
        `HTTP ${teacherOnAdminRes.status}`
      );
    }

    // 10. Unauthorized Role Access Rejection: unauthenticated requests
    const unauthAdminRes = await fetch(`${BASE_URL}/test/admin-only`);
    report(
      'Unauthorized access rejection: Request without token rejected with HTTP 401 UNAUTHORIZED',
      unauthAdminRes.status === 401,
      `HTTP ${unauthAdminRes.status}`
    );

    // 11. Invalid Login Rejection
    const { data: invalidLoginData, error: invalidLoginErr } = await client.auth.signInWithPassword({
      email: adminEmail,
      password: 'invalid_password_987654',
    });

    report(
      'Invalid credentials rejected by Supabase Auth with no session created',
      !!invalidLoginErr && !invalidLoginData.session,
      invalidLoginErr ? 'Correctly rejected' : 'Failed to reject'
    );

    // 12. Logout & Session Clearing Check
    const sessionTestClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    await sessionTestClient.auth.signInWithPassword({
      email: teacherEmail,
      password: teacherPassword,
    });
    const preSignOutSession = (await sessionTestClient.auth.getSession()).data.session;
    const { error: signOutErr } = await sessionTestClient.auth.signOut();
    const postSignOutSession = (await sessionTestClient.auth.getSession()).data.session;

    report(
      'Logout / session clearing succeeds (session destroyed)',
      !signOutErr && !!preSignOutSession && postSignOutSession === null,
      'Session successfully cleared'
    );

    // 13. Password reset request
    const { error: resetErr } = await client.auth.resetPasswordForEmail(adminEmail);
    const isResetValid = !resetErr || resetErr.message?.toLowerCase().includes('security purposes');
    report(
      'Password reset request triggered via Supabase Auth',
      isResetValid,
      resetErr ? `Supabase rate-limit protection active (${resetErr.message})` : 'Dispatched'
    );

    console.log('\n-----------------------------------------------------');
    console.log(`Summary: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('-----------------------------------------------------\n');

    if (failCount > 0) {
      process.exit(1);
    }
  } finally {
    server!.close();
  }
}

verifyLivePhase1().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
