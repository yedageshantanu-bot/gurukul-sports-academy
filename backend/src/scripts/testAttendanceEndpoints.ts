import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import app from '../app.js';
import { Server } from 'http';

async function runAttendanceTests() {
  console.log('🧪 Starting Automated Phase 3 Attendance & RBAC Tests...\n');

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
  const PORT = 10011;
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
    // 3. Setup test fixtures: Teacher ID, Student, and Batches
    const teacherMeRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const teacherMe = await teacherMeRes.json();
    const currentTeacherId = teacherMe.data?.teacherId;
    assert('Teacher has linked teacherId', !!currentTeacherId);

    // Create a student for attendance testing
    const createStudentRes = await fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `Attendance Test Student ${Date.now()}`,
        studentMobile: '9888877777',
      }),
    });
    const studentJson = await createStudentRes.json();
    const studentId = studentJson.data?.id;
    assert('Created test student for attendance', !!studentId);

    // Create an assigned batch for attendance testing
    const createBatchRes = await fetch(`${BASE_URL}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `Assigned Batch ${Date.now()}`,
        subject: 'Attendance Subject',
        scheduleDays: ['Mon', 'Tue'],
      }),
    });
    const batchJson = await createBatchRes.json();
    const assignedBatchId = batchJson.data?.id;
    assert('Created assigned batch', !!assignedBatchId);

    // Assign teacher to batch
    await fetch(`${BASE_URL}/batches/${assignedBatchId}/teachers/${currentTeacherId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // Enroll student in batch
    await fetch(`${BASE_URL}/batches/${assignedBatchId}/students/${studentId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // Create an unassigned batch
    const unassignedBatchRes = await fetch(`${BASE_URL}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `Unassigned Batch ${Date.now()}`,
        subject: 'Other Subject',
      }),
    });
    const unassignedBatchId = (await unassignedBatchRes.json()).data?.id;

    // Test Date
    const testDate = '2026-09-15';

    // Test 1: Admin can mark PRESENT
    const adminMarkPresentRes = await fetch(`${BASE_URL}/attendance/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        batchId: assignedBatchId,
        date: testDate,
        records: [{ studentId, status: 'PRESENT' }],
      }),
    });
    const adminMarkPresentJson = await adminMarkPresentRes.json();
    assert(
      'Admin can mark PRESENT (HTTP 200)',
      adminMarkPresentRes.status === 200 && adminMarkPresentJson.data?.records?.[0]?.status === 'PRESENT',
      adminMarkPresentJson
    );
    const createdAttendanceId = adminMarkPresentJson.data?.records?.[0]?.id;

    // Test 2: Admin can edit attendance (PATCH /api/attendance/:id)
    if (createdAttendanceId) {
      const editAttendanceRes = await fetch(`${BASE_URL}/attendance/${createdAttendanceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'ABSENT' }),
      });
      const editJson = await editAttendanceRes.json();
      assert(
        'Admin can edit attendance record to ABSENT (HTTP 200)',
        editAttendanceRes.status === 200 && editJson.data?.status === 'ABSENT',
        editJson
      );
    }

    // Test 3: Teacher can mark attendance for assigned batch (HTTP 200)
    const teacherDate = '2026-09-16';
    const teacherMarkRes = await fetch(`${BASE_URL}/attendance/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({
        batchId: assignedBatchId,
        date: teacherDate,
        records: [{ studentId, status: 'PRESENT' }],
      }),
    });
    const teacherMarkJson = await teacherMarkRes.json();
    assert(
      'Teacher can mark attendance for assigned batch (HTTP 200)',
      teacherMarkRes.status === 200 && teacherMarkJson.data?.recordedCount === 1,
      teacherMarkJson
    );
    const teacherAttendanceId = teacherMarkJson.data?.records?.[0]?.id;

    // Test 4: Teacher can edit attendance for assigned batch (HTTP 200)
    if (teacherAttendanceId) {
      const teacherEditRes = await fetch(`${BASE_URL}/attendance/${teacherAttendanceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
        body: JSON.stringify({ status: 'ABSENT' }),
      });
      assert('Teacher can edit attendance for assigned batch (HTTP 200)', teacherEditRes.status === 200);
    }

    // Test 5: Teacher cannot mark attendance for unassigned batch (HTTP 403)
    if (unassignedBatchId) {
      const teacherUnassignedMarkRes = await fetch(`${BASE_URL}/attendance/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
        body: JSON.stringify({
          batchId: unassignedBatchId,
          date: testDate,
          records: [{ studentId, status: 'PRESENT' }],
        }),
      });
      assert(
        'Teacher cannot mark attendance for unassigned batch (HTTP 403)',
        teacherUnassignedMarkRes.status === 403
      );

      // Test 6: Teacher cannot access unassigned batch attendance sheet (HTTP 403)
      const teacherSheetUnassignedRes = await fetch(
        `${BASE_URL}/attendance/sheet?batchId=${unassignedBatchId}&date=${testDate}`,
        {
          headers: { Authorization: `Bearer ${teacherToken}` },
        }
      );
      assert(
        'Teacher cannot access attendance sheet for unassigned batch (HTTP 403)',
        teacherSheetUnassignedRes.status === 403
      );
    }

    // Test 7: Unauthenticated request returns 401
    const unauthRes = await fetch(`${BASE_URL}/attendance`);
    assert('Unauthenticated request returns HTTP 401', unauthRes.status === 401);

    // Test 8: Non-enrolled student attendance rejected (HTTP 400)
    // Create a new student NOT enrolled in assignedBatchId
    const outsiderStudentRes = await fetch(`${BASE_URL}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Outsider Student', studentMobile: '9000000000' }),
    });
    const outsiderStudentId = (await outsiderStudentRes.json()).data?.id;

    const invalidStudentAttendanceRes = await fetch(`${BASE_URL}/attendance/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        batchId: assignedBatchId,
        date: '2026-09-17',
        records: [{ studentId: outsiderStudentId, status: 'PRESENT' }],
      }),
    });
    assert(
      'Attendance rejected when student does not belong to batch (HTTP 400)',
      invalidStudentAttendanceRes.status === 400
    );

    // Test 9: Duplicate student+batch+date updates existing record idempotently
    // Resubmit attendance for testDate with ABSENT
    const duplicateSubmissionRes = await fetch(`${BASE_URL}/attendance/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        batchId: assignedBatchId,
        date: testDate,
        records: [{ studentId, status: 'ABSENT' }],
      }),
    });
    assert('Resubmitting attendance for same date/batch/student succeeds (HTTP 200)', duplicateSubmissionRes.status === 200);

    // Verify there is still only 1 record for this student + batch + date
    const listRes = await fetch(
      `${BASE_URL}/attendance?batchId=${assignedBatchId}&date=${testDate}&studentId=${studentId}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    const listJson = await listRes.json();
    assert(
      'Duplicate submission updated existing record without creating duplicate row',
      listRes.status === 200 && listJson.data?.length === 1 && listJson.data[0].status === 'ABSENT',
      listJson
    );

    // Test 10: Invalid attendance status is rejected (e.g. 'LEAVE' or 'LATE' -> HTTP 400)
    const invalidStatusRes = await fetch(`${BASE_URL}/attendance/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        batchId: assignedBatchId,
        date: '2026-09-18',
        records: [{ studentId, status: 'LEAVE' }],
      }),
    });
    assert('Invalid attendance status (e.g. LEAVE) is rejected (HTTP 400)', invalidStatusRes.status === 400);

    // Test 11: Attendance sheet prefill
    const sheetRes = await fetch(`${BASE_URL}/attendance/sheet?batchId=${assignedBatchId}&date=${testDate}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const sheetJson = await sheetRes.json();
    assert(
      'Attendance sheet prefill returns enrolled students and their marked status',
      sheetRes.status === 200 && sheetJson.data?.students?.[0]?.status === 'ABSENT',
      sheetJson
    );

    console.log(`\n📊 Attendance Test Summary: ${passCount} PASSED, ${failCount} FAILED\n`);
    if (failCount > 0) {
      process.exit(1);
    }
  } finally {
    server!.close();
  }
}

runAttendanceTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
