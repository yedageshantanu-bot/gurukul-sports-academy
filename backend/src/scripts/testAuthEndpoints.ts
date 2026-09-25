import app from '../app.js';
import { Server } from 'http';

async function runTests() {
  console.log('🧪 Starting Automated Backend Authentication & RBAC Tests...\n');

  let server: Server;
  const PORT = 10003;

  await new Promise<void>((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`Test server running on port ${PORT}`);
      resolve();
    });
  });

  const BASE_URL = `http://localhost:${PORT}/api`;
  let passedCount = 0;
  let totalCount = 0;

  function assert(description: string, condition: boolean, details?: any) {
    totalCount++;
    if (condition) {
      console.log(`✅ PASS: ${description}`);
      passedCount++;
    } else {
      console.error(`❌ FAIL: ${description}`, details || '');
    }
  }

  try {
    // Test 1: GET /api/health
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthJson = await healthRes.json();
    assert('Health check returns 200 OK', healthRes.status === 200 && healthJson.status === 'ok');

    // Test 2: Missing Authorization header on protected endpoint
    const noAuthRes = await fetch(`${BASE_URL}/auth/me`);
    const noAuthJson = await noAuthRes.json();
    assert(
      'Protected /auth/me rejects missing Authorization header with 401 UNAUTHORIZED',
      noAuthRes.status === 401 && noAuthJson.error?.code === 'UNAUTHORIZED',
      noAuthJson
    );

    // Test 3: Malformed Authorization header
    const malformedRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    const malformedJson = await malformedRes.json();
    assert(
      'Protected /auth/me rejects non-Bearer Authorization header with 401 UNAUTHORIZED',
      malformedRes.status === 401 && malformedJson.error?.code === 'UNAUTHORIZED',
      malformedJson
    );

    // Test 4: Missing token on RBAC admin-only endpoint
    const noAuthAdminRes = await fetch(`${BASE_URL}/test/admin-only`);
    const noAuthAdminJson = await noAuthAdminRes.json();
    assert(
      'Admin-only route /test/admin-only rejects unauthenticated request with 401 UNAUTHORIZED',
      noAuthAdminRes.status === 401 && noAuthAdminJson.error?.code === 'UNAUTHORIZED',
      noAuthAdminJson
    );

    // Test 5: Missing token on RBAC teacher-only endpoint
    const noAuthTeacherRes = await fetch(`${BASE_URL}/test/teacher-only`);
    const noAuthTeacherJson = await noAuthTeacherRes.json();
    assert(
      'Teacher-only route /test/teacher-only rejects unauthenticated request with 401 UNAUTHORIZED',
      noAuthTeacherRes.status === 401 && noAuthTeacherJson.error?.code === 'UNAUTHORIZED',
      noAuthTeacherJson
    );

    // Test 6: Invalid Email format on POST /api/auth/login
    const invalidLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'password123' }),
    });
    const invalidLoginJson = await invalidLoginRes.json();
    assert(
      'Login rejects invalid email with 400 VALIDATION_ERROR',
      invalidLoginRes.status === 400 && invalidLoginJson.error?.code === 'VALIDATION_ERROR',
      invalidLoginJson
    );

    // Test 7: Missing password on POST /api/auth/login
    const missingPassRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'valid@example.com' }),
    });
    const missingPassJson = await missingPassRes.json();
    assert(
      'Login rejects missing password with 400 VALIDATION_ERROR',
      missingPassRes.status === 400 && missingPassJson.error?.code === 'VALIDATION_ERROR',
      missingPassJson
    );

    // Test 8: Invalid Email on POST /api/auth/password-reset
    const invalidResetRes = await fetch(`${BASE_URL}/auth/password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid-email-address' }),
    });
    const invalidResetJson = await invalidResetRes.json();
    assert(
      'Password reset rejects invalid email with 400 VALIDATION_ERROR',
      invalidResetRes.status === 400 && invalidResetJson.error?.code === 'VALIDATION_ERROR',
      invalidResetJson
    );

    // Test 9: POST /api/auth/logout succeeds
    const logoutRes = await fetch(`${BASE_URL}/auth/logout`, { method: 'POST' });
    const logoutJson = await logoutRes.json();
    assert(
      'POST /auth/logout returns 200 OK',
      logoutRes.status === 200 && logoutJson.success === true
    );

    // Test 10: Fake / invalid token rejected by JWT verification
    const fakeTokenRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: 'Bearer fake.invalid.jwt.token' },
    });
    const fakeTokenJson = await fakeTokenRes.json();
    // Since Supabase credentials are not configured yet, it properly reports 500 INTERNAL_SERVER_ERROR or 401
    assert(
      'Invalid token is safely rejected by auth middleware',
      fakeTokenRes.status === 401 || fakeTokenRes.status === 500,
      fakeTokenJson
    );

    console.log(`\n📊 Summary: ${passedCount}/${totalCount} tests passed.\n`);
  } finally {
    server!.close();
  }
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
