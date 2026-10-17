import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import app from '../app.js';
import { Server } from 'http';

async function measure() {
  console.log('--- STARTING PERFORMANCE MEASUREMENT ---');

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
  const token = adminLogin.session.access_token;

  const PORT = 10005;
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(PORT, () => resolve(s));
  });

  const endpoints = [
    { name: 'Admin Dashboard', url: `http://localhost:${PORT}/api/dashboard/admin` },
    { name: 'List Students', url: `http://localhost:${PORT}/api/students` },
    { name: 'List Batches', url: `http://localhost:${PORT}/api/batches` },
    { name: 'List Fees', url: `http://localhost:${PORT}/api/fees` },
    { name: 'Academy Settings', url: `http://localhost:${PORT}/api/settings` },
  ];

  const results = [];

  for (const ep of endpoints) {
    // Warm up
    await fetch(ep.url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept-Encoding': 'gzip, deflate, br',
      },
    });

    // 3 runs for average
    const runs = [];
    let sizeBytes = 0;
    let contentEncoding = 'none';

    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      const res = await fetch(ep.url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Accept-Encoding': 'gzip, deflate, br',
        },
      });
      const duration = performance.now() - start;
      const cl = res.headers.get('content-length');
      contentEncoding = res.headers.get('content-encoding') || 'none';
      if (cl) {
        sizeBytes = parseInt(cl, 10);
      } else {
        const buf = await res.arrayBuffer();
        sizeBytes = buf.byteLength;
      }
      runs.push(duration);
    }

    const avgTime = runs.reduce((a, b) => a + b, 0) / runs.length;
    results.push({
      name: ep.name,
      endpoint: ep.url.replace(`http://localhost:${PORT}`, ''),
      avgTimeMs: Math.round(avgTime),
      sizeKB: (sizeBytes / 1024).toFixed(2),
      encoding: contentEncoding,
    });
  }

  console.log(JSON.stringify(results, null, 2));

  server.close();
}

measure().catch(console.error);
