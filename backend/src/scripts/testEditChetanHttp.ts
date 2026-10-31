import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import app from '../app.js';
import { Server } from 'http';

async function testHttpEdit() {
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

  const PORT = 10042;
  const server: Server = app.listen(PORT);
  await new Promise<void>((resolve) => server.on('listening', resolve));

  try {
    const chetanId = '100c2eb9-efa1-4681-a1de-97295e5799e6';
    
    // Test the exact payload the frontend sends when editing Chetan
    const payload = {
      name: 'CHETAN PAWAR',
      parentName: 'RAJESH',
      parentWhatsapp: '+919145803596',
      studentMobile: null,
      batchId: '11047cb4-fe47-45ea-ba27-206e382d14e7',
      batchIds: ['11047cb4-fe47-45ea-ba27-206e382d14e7'],
      whatsappOptIn: true,
      status: 'ACTIVE',
      course: 'Dual Discipline (Kalarippayattu + Karate)',
      monthlyFee: 1200,
      feeDueDay: 5,
      admissionDate: '2026-06-01',
      sports: [
        { disciplineCode: 'KALARIPPAYATTU', rankName: 'Level 0 - प्रवेशिका (Praveshika - White Sash)' },
        { disciplineCode: 'KARATE_WUSHU', rankName: 'Level 0 - White Belt' }
      ],
      sportDiscipline: 'KALARIPPAYATTU',
      initialBeltRank: 'Level 0 - प्रवेशिका (Praveshika - White Sash)',
    };

    console.log('Sending PATCH /api/students/' + chetanId);
    const res = await fetch(`http://localhost:${PORT}/api/students/${chetanId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(payload),
    });

    const status = res.status;
    const body = await res.json();
    console.log('HTTP Status:', status);
    console.log('HTTP Body:', JSON.stringify(body, null, 2));

    if (status !== 200) {
      throw new Error(`Expected status 200, got ${status}`);
    }
    console.log('✅ Student edit HTTP test PASSED!');
  } finally {
    server.close();
  }
}

testHttpEdit().catch((e) => {
  console.error('❌ Test failed:', e);
  process.exit(1);
});
