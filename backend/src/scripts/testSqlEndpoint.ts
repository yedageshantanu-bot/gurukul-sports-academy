import dotenv from 'dotenv';
dotenv.config();

const url = 'https://litnduotmypvhnorjnwa.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpdG5kdW90bXlwdmhub3JqbndhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDI2ODI0OCwiZXhwIjoyMTA1ODQ0MjQ4fQ.Qwp_EPvk9JDReZVmNw5opDCIbKQzziDuA5R2S8MLhsg';

async function testSql() {
  // Test pg-meta endpoint
  const res = await fetch(`${url}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    },
    body: JSON.stringify({ query: 'SELECT 1;' })
  });
  console.log('pg/query status:', res.status, await res.text().catch(() => ''));
}

testSql();
