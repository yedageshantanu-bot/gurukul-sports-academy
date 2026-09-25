import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import app from '../app.js';
import { Server } from 'http';

async function runCrmTests() {
  console.log('🧪 Starting Automated Phase 2 Core CRM & RBAC Tests...\n');

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.DEV_ADMIN_EMAIL || !env.DEV_ADMIN_PASSWORD || !env.DEV_TEACHER_EMAIL || !env.DEV_TEACHER_PASSWORD) {
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
  const PORT = 10007;
  let server: Server;
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
    // Obtain Teacher's teacherId from /api/auth/me
    const teacherMeRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const teacherMe = await teacherMeRes.json();
    const currentTeacherId = teacherMe.data?.teacherId;
    assert('Teacher identity has linked teacherId', !!currentTeacherId, teacherMe);

    // Test 1: Admin Dashboard KPI
    const adminDashRes = await fetch(`${BASE_URL}/dashboard/admin`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminDash = await adminDashRes.json();
    assert(
      'Admin Dashboard returns 200 with live KPI counts',
      adminDashRes.status === 200 && adminDash.data?.kpis?.totalStudents !== undefined,
      adminDash
    );

    // Test 2: Teacher Dashboard KPI
    const teacherDashRes = await fetch(`${BASE_URL}/dashboard/teacher`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const teacherDash = await teacherDashRes.json();
    assert(
      'Teacher Dashboard returns 200 with assigned batch counts',
      teacherDashRes.status === 200 && teacherDash.data?.kpis?.assignedBatchCount !== undefined,
      teacherDash
    );

    // Test 3: Teacher restricted from creating Teacher (403 FORBIDDEN)
    const teacherCreateTeacherRes = await fetch(`${BASE_URL}/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({ fullName: 'Forbidden Teacher', email: 'forbidden@test.com', subject: 'Math' }),
    });
    assert('Teacher cannot create new teacher (HTTP 403)', teacherCreateTeacherRes.status === 403);

    // Test 4: Admin creates Teacher (POST /api/teachers)
    const uniqueEmail = `test.teacher.${Date.now()}@example.com`;
    const createTeacherRes = await fetch(`${BASE_URL}/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        fullName: 'Automated Test Teacher',
        email: uniqueEmail,
        phone: '9876543210',
        subject: 'Physics',
      }),
    });
    const createdTeacherJson = await createTeacherRes.json();
    const createdTeacherId = createdTeacherJson.data?.id;
    assert(
      'Admin creates teacher successfully (HTTP 201)',
      createTeacherRes.status === 201 && !!createdTeacherId,
      createdTeacherJson
    );

    // Test 5: Teacher accessing own profile vs other teacher profile
    if (currentTeacherId) {
      const ownProfileRes = await fetch(`${BASE_URL}/teachers/${currentTeacherId}`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      assert('Teacher can view own profile (HTTP 200)', ownProfileRes.status === 200);

      if (createdTeacherId) {
        const otherProfileRes = await fetch(`${BASE_URL}/teachers/${createdTeacherId}`, {
          headers: { Authorization: `Bearer ${teacherToken}` },
        });
        assert('Teacher blocked from viewing other teacher profile (HTTP 403)', otherProfileRes.status === 403);
      }
    }

    // Test 6: Admin creates Student (POST /api/students)
    const createStudentRes = await fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Automated Test Student',
        parentName: 'Parent Test',
        studentMobile: '9123456780',
        monthlyFee: 2500,
        feeDueDay: 10,
        course: 'Science Standard 10',
      }),
    });
    const createdStudentJson = await createStudentRes.json();
    const createdStudentId = createdStudentJson.data?.id;
    assert(
      'Admin creates student successfully (HTTP 201)',
      createStudentRes.status === 201 && !!createdStudentId,
      createdStudentJson
    );

    // Test 7: Teacher cannot create student (HTTP 403)
    const teacherCreateStudentRes = await fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({ name: 'Disallowed Student' }),
    });
    assert('Teacher cannot create student (HTTP 403)', teacherCreateStudentRes.status === 403);

    // Test 8: Admin creates Batch (POST /api/batches)
    const createBatchRes = await fetch(`${BASE_URL}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `Batch Alpha ${Date.now()}`,
        subject: 'Physics',
        scheduleDays: ['Mon', 'Wed', 'Fri'],
        startTime: '10:00',
        endTime: '11:30',
      }),
    });
    const createdBatchJson = await createBatchRes.json();
    const batchId = createdBatchJson.data?.id;
    assert('Admin creates batch successfully (HTTP 201)', createBatchRes.status === 201 && !!batchId, createdBatchJson);

    // Test 9: Assign teacher to batch (POST /api/batches/:batchId/teachers/:teacherId)
    if (batchId && currentTeacherId) {
      const assignTeacherRes = await fetch(`${BASE_URL}/batches/${batchId}/teachers/${currentTeacherId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert('Admin assigns teacher to batch (HTTP 200)', assignTeacherRes.status === 200);
    }

    // Test 10: Assign student to batch (POST /api/batches/:batchId/students/:studentId)
    if (batchId && createdStudentId) {
      const assignStudentRes = await fetch(`${BASE_URL}/batches/${batchId}/students/${createdStudentId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert('Admin assigns student to batch (HTTP 200)', assignStudentRes.status === 200);
    }

    // Test 11: Teacher can view assigned batch (HTTP 200)
    if (batchId) {
      const teacherGetBatchRes = await fetch(`${BASE_URL}/batches/${batchId}`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      assert('Teacher can view assigned batch (HTTP 200)', teacherGetBatchRes.status === 200);
    }

    // Test 12: Admin creates unassigned batch; Teacher attempted access yields 403
    const unassignedBatchRes = await fetch(`${BASE_URL}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `Unassigned Batch ${Date.now()}`,
        subject: 'Chemistry',
      }),
    });
    const unassignedBatchId = (await unassignedBatchRes.json()).data?.id;
    if (unassignedBatchId) {
      const teacherGetUnassignedRes = await fetch(`${BASE_URL}/batches/${unassignedBatchId}`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
      });
      assert(
        'Teacher attempting to access unassigned batch is REJECTED (HTTP 403)',
        teacherGetUnassignedRes.status === 403
      );
    }

    // Test 13: Teacher listing students only sees students in assigned batches
    const teacherStudentsRes = await fetch(`${BASE_URL}/students`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const teacherStudentsJson = await teacherStudentsRes.json();
    assert(
      'Teacher listing students succeeds and returns scoped array',
      teacherStudentsRes.status === 200 && Array.isArray(teacherStudentsJson.data),
      teacherStudentsJson
    );

    // Test 14: Admin can deactivate and activate student
    if (createdStudentId) {
      const deactStudentRes = await fetch(`${BASE_URL}/students/${createdStudentId}/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'INACTIVE' }),
      });
      const deactJson = await deactStudentRes.json();
      assert('Admin deactivates student (HTTP 200)', deactStudentRes.status === 200 && deactJson.data?.status === 'INACTIVE');

      const reactStudentRes = await fetch(`${BASE_URL}/students/${createdStudentId}/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'ACTIVE' }),
      });
      const reactJson = await reactStudentRes.json();
      assert('Admin reactivates student (HTTP 200)', reactStudentRes.status === 200 && reactJson.data?.status === 'ACTIVE');
    }

    // Test 15: Input validation error handling (Zod schema rejects invalid data)
    const invalidBatchRes = await fetch(`${BASE_URL}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'A' }), // name too short
    });
    assert('Input validation rejects invalid batch name with HTTP 400', invalidBatchRes.status === 400);

    console.log(`\n📊 CRM Test Summary: ${passCount} PASSED, ${failCount} FAILED\n`);
    if (failCount > 0) {
      process.exit(1);
    }
  } finally {
    server!.close();
  }
}

runCrmTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
