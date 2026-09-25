/**
 * GURUKUL SPORTS ACADEMY — 24/7 RENDER KEEP-ALIVE SCRIPT
 * Pings both Render services every 5 minutes so they NEVER go to sleep.
 */

const PING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const TARGETS = [
  { name: 'Account 1 Backend', url: 'https://gurukul-sports-backend.onrender.com/api/health' },
  { name: 'Account 2 WhatsApp Bridge', url: 'https://gurukul-openwa-bridge-a0m4.onrender.com/health' }
];

async function pingAll() {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n[${timestamp}] 📡 Pinging Render services...`);

  for (const target of TARGETS) {
    try {
      const start = Date.now();
      const res = await fetch(target.url, { signal: AbortSignal.timeout(30000) });
      const latency = Date.now() - start;
      console.log(`✅ [${res.status}] ${target.name} is AWAKE (${latency}ms)`);
    } catch (err) {
      console.warn(`⚠️ [FAIL] ${target.name}: ${err.message}`);
    }
  }
}

// First ping immediately
pingAll();

// Repeat every 5 minutes
setInterval(pingAll, PING_INTERVAL_MS);
