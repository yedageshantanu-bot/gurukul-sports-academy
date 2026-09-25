import { createClient } from '@supabase/supabase-js';

const url = 'https://litnduotmypvhnorjnwa.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpdG5kdW90bXlwdmhub3JqbndhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDI2ODI0OCwiZXhwIjoyMTA1ODQ0MjQ4fQ.Qwp_EPvk9JDReZVmNw5opDCIbKQzziDuA5R2S8MLhsg';

const client = createClient(url, serviceKey);

async function check() {
  console.log('Testing connection to new Supabase project...');
  const { data, error } = await client.auth.admin.listUsers();
  if (error) {
    console.error('❌ Connection error:', error.message);
  } else {
    console.log('🎉 SUCCESS! Connected to litnduotmypvhnorjnwa. User count:', data.users.length);
  }

  const { data: tables, error: tableErr } = await client.from('academy_settings').select('*');
  if (tableErr) {
    console.log('Table academy_settings:', tableErr.message);
  } else {
    console.log('academy_settings rows:', tables.length);
  }
}

check();
