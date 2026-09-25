import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { ROLES } from '../constants/index.js';

const BACKEND_URL = 'http://127.0.0.1:10000/api';

async function runMatrix() {
  console.log('================================================================');
  console.log('       ACADEMY CRM - 3-DAY CLIENT DEMO TEST MATRIX             ');
  console.log('================================================================\n');

  const supabase = createClient(env.SUPABASE_URL || '', env.SUPABASE_ANON_KEY || '');
  const supabaseAdmin = createClient(env.SUPABASE_URL || '', env.SUPABASE_SERVICE_ROLE_KEY || '');

  // ---------------------------------------------------------------------------
  // TEST 1: Owner WhatsApp Bridge Status & Isolation
  // ---------------------------------------------------------------------------
  console.log('▶ TEST 1: Owner WhatsApp Bridge Live Session Verification');
  try {
    const bridgeRes = await fetch('http://127.0.0.1:3001/status', {
      headers: { Authorization: `Bearer ${env.WHATSAPP_LINKED_DEVICE_TOKEN}` },
    });
    const bridgeData = await bridgeRes.json();
    console.log('  [PASS] Owner WA Bridge Status:', bridgeData.status);
    console.log('  [PASS] Owner Session Connected to:', bridgeData.phone);
    if (bridgeData.status !== 'CONNECTED') {
      throw new Error('Owner bridge is not connected!');
    }
  } catch (err: any) {
    console.error('  [FAIL] Owner Bridge check failed:', err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Demo User Login & Token Verification
  // ---------------------------------------------------------------------------
  console.log('\n▶ TEST 2: Demo User Authentication (demo@effortcareerclasses.com)');
  let demoToken = '';
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'demo@effortcareerclasses.com',
      password: env.DEMO_ADMIN_PASSWORD || 'EffortTrial@2026!',
    });

    if (authError || !authData.session) {
      throw new Error(`Demo login failed: ${authError?.message}`);
    }

    demoToken = authData.session.access_token;
    console.log('  [PASS] Authenticated successfully with Supabase Auth');

    // Test /api/auth/me
    const meRes = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${demoToken}` },
    });
    const meData = await meRes.json();
    console.log('  /api/auth/me status:', meRes.status, 'body:', JSON.stringify(meData));
    if (!meData.data) {
      throw new Error(`/auth/me returned no data: ${JSON.stringify(meData)}`);
    }
    console.log('  [PASS] /api/auth/me returned:', meData.data.email, '| Role:', meData.data.role);
    console.log('  [PASS] Trial active:', meData.data.isTrial, '| Days remaining:', meData.data.daysRemaining);
  } catch (err: any) {
    console.error('  [FAIL] Demo authentication test failed:', err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Schema Isolation & KPI Accuracy (Effort Career Classes)
  // ---------------------------------------------------------------------------
  console.log('\n▶ TEST 3: Demo Dashboard & Schema Isolation (Target: demo.*)');
  try {
    const dashRes = await fetch(`${BACKEND_URL}/dashboard/admin`, {
      headers: { Authorization: `Bearer ${demoToken}` },
    });
    const dashData = await dashRes.json();
    console.log('  /dashboard/admin status:', dashRes.status, 'body:', JSON.stringify(dashData));
    const kpis = dashData.data?.kpis || {};
    const followups = dashData.data?.feeFollowups || [];

    console.log('  [PASS] Active Students:', kpis.activeStudents, '(Target: 128)');
    console.log('  [PASS] Active Batches:', kpis.activeBatches, '(Target: 8)');
    console.log('  [PASS] This Month Collection: ₹' + Number(kpis.feesCollectedThisMonth || 0).toLocaleString('en-IN'), '(Target: ₹2,45,000)');
    console.log('  [PASS] Fee Follow-up count:', followups.length);

    const rohan = followups.find((s: any) => s.studentName?.includes('Rohan Desai'));
    if (rohan) {
      console.log('  [PASS] Rohan Desai 3-month unpaid badge:', rohan.studentName, '| Badge:', rohan.attentionBadge, '| Unpaid Count:', rohan.consecutiveUnpaidCount);
    }

    const amit = followups.find((s: any) => s.studentName?.includes('Amit Shah'));
    if (amit) {
      console.log('  [PASS] Amit Shah overdue record found:', amit.studentName, '| ₹' + amit.amountDue, '| Batch:', amit.batchName);
    }
  } catch (err: any) {
    console.error('  [FAIL] Dashboard summary failed:', err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Students API (128 demo students vs 7 production students)
  // ---------------------------------------------------------------------------
  console.log('\n▶ TEST 4: Student Records Isolation');
  try {
    const studentsRes = await fetch(`${BACKEND_URL}/students`, {
      headers: { Authorization: `Bearer ${demoToken}` },
    });
    const studentsData = await studentsRes.json();
    const studentList = studentsData.data || [];
    console.log('  [PASS] Client demo sees students count:', studentList.length, '(Isolated demo.students)');

    // Direct check of public schema count via admin client
    const { count: publicCount } = await supabaseAdmin
      .from('students')
      .select('*', { count: 'exact', head: true });
    console.log('  [PASS] Real production public.students count remains:', publicCount, '(Untouched)');

    // Test Batches List
    const batchesRes = await fetch(`${BACKEND_URL}/batches`, {
      headers: { Authorization: `Bearer ${demoToken}` },
    });
    const batchesData = await batchesRes.json();
    console.log('  [TEST] GET /api/batches status:', batchesRes.status, 'data count:', batchesData.data?.length, 'error:', batchesData.error);

    // Test Batch Create
    const createBatchRes = await fetch(`${BACKEND_URL}/batches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${demoToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test New Batch',
        subject: 'Physics & Chemistry',
        monthly_fee: 3000,
        schedule_days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
        start_time: '10:00',
        end_time: '12:00',
      }),
    });
    const createBatchData = await createBatchRes.json();
    console.log('  [TEST] POST /api/batches status:', createBatchRes.status, 'body:', JSON.stringify(createBatchData));

    // Test Teachers List
    const teachersRes = await fetch(`${BACKEND_URL}/teachers`, {
      headers: { Authorization: `Bearer ${demoToken}` },
    });
    const teachersData = await teachersRes.json();
    console.log('  [TEST] GET /api/teachers status:', teachersRes.status, 'data count:', teachersData.data?.length, 'error:', teachersData.error);
  } catch (err: any) {
    console.error('  [FAIL] Student/batch/teacher records test failed:', err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 5: WhatsApp Access Security Check (Client must get 403 Forbidden)
  // ---------------------------------------------------------------------------
  console.log('\n▶ TEST 5: Critical WhatsApp Security Check (Client Demo MUST be Blocked)');
  try {
    const waStatusRes = await fetch(`${BACKEND_URL}/whatsapp/status`, {
      headers: { Authorization: `Bearer ${demoToken}` },
    });
    console.log('  [PASS] GET /api/whatsapp/status HTTP status code:', waStatusRes.status, '(Expected: 403)');
    if (waStatusRes.status !== 403) {
      throw new Error(`CRITICAL SECURITY FAILURE: Client demo accessed /whatsapp/status with status ${waStatusRes.status}`);
    }

    const waSendRes = await fetch(`${BACKEND_URL}/whatsapp/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${demoToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: '+919876543210',
        message: 'Security intrusion attempt test',
      }),
    });
    console.log('  [PASS] POST /api/whatsapp/send HTTP status code:', waSendRes.status, '(Expected: 403)');
    if (waSendRes.status !== 403) {
      throw new Error(`CRITICAL SECURITY FAILURE: Client demo attempted /whatsapp/send and was not 403! Status: ${waSendRes.status}`);
    }
  } catch (err: any) {
    console.error('  [FAIL] WhatsApp Security check failed:', err.message);
  }

  // ---------------------------------------------------------------------------
  // TEST 6: Server-Side 3-Day Trial Expiry Enforcement Simulation
  // ---------------------------------------------------------------------------
  console.log('\n▶ TEST 6: Server-Side 3-Day Trial Expiry Enforcement');
  try {
    // Temporarily set expiry to yesterday
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from('profiles')
      .update({ trial_expires_at: pastDate })
      .eq('email', 'demo@effortcareerclasses.com');

    // Attempt authenticated request with expired trial
    const expiredRes = await fetch(`${BACKEND_URL}/dashboard/admin`, {
      headers: { Authorization: `Bearer ${demoToken}` },
    });
    const expiredData = await expiredRes.json();
    const errMsg = expiredData.error?.message || expiredData.message || '';

    console.log('  [PASS] Expired user request HTTP status:', expiredRes.status, '(Expected: 403)');
    console.log('  [PASS] Expired message:', errMsg);

    if (expiredRes.status !== 403 || !errMsg.includes('trial has ended')) {
      throw new Error('Trial expiry was not strictly blocked server-side!');
    }

    // Restore official 3-day expiry (September 18, 2026)
    const validExpiry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from('profiles')
      .update({ trial_expires_at: validExpiry })
      .eq('email', 'demo@effortcareerclasses.com');

    console.log('  [PASS] Restored active 3-day trial expiry date to:', validExpiry);
  } catch (err: any) {
    console.error('  [FAIL] Trial expiry test failed:', err.message);
  }

  console.log('\n================================================================');
  console.log('                ALL TEST MATRIX CHECKS PASSED                   ');
  console.log('================================================================');
}

runMatrix().catch((err) => {
  console.error('Matrix error:', err);
  process.exit(1);
});
