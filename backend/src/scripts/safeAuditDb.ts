import { createClient } from '@supabase/supabase-js';

const url = 'https://litnduotmypvhnorjnwa.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpdG5kdW90bXlwdmhub3JqbndhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDI2ODI0OCwiZXhwIjoyMTA1ODQ0MjQ4fQ.Qwp_EPvk9JDReZVmNw5opDCIbKQzziDuA5R2S8MLhsg';
const supabase = createClient(url, serviceKey);

async function audit() {
  console.log('=== SAFE READ-ONLY DATABASE AUDIT ===');
  
  const tables = [
    'students',
    'batches',
    'courses',
    'student_fees',
    'fee_plans',
    'payments',
    'receipts',
    'publication_students',
    'tournaments',
    'announcements',
    'student_ranks',
    'rank_promotions',
    'attendance',
    'academy_settings'
  ];

  for (const table of tables) {
    try {
      const { data, error, count } = await supabase.from(table).select('*', { count: 'exact' }).limit(3);
      if (error) {
        console.log(`Table [${table}]: ERROR - ${error.message}`);
      } else {
        console.log(`Table [${table}]: ${count} rows total. Sample row keys: ${data && data[0] ? Object.keys(data[0]).join(', ') : '(empty)'}`);
        if (table === 'publication_students' && data && data.length > 0) {
          console.log('publication_students sample:', JSON.stringify(data[0], null, 2));
        }
      }
    } catch (e: any) {
      console.log(`Table [${table}]: EXCEPTION - ${e.message}`);
    }
  }

  // Check auth users
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.log('Auth users error:', authError.message);
  } else {
    console.log(`Auth users: ${authData.users.length} users registered:`);
    authData.users.forEach(u => {
      console.log(` - Email: ${u.email}, ID: ${u.id}, Created: ${u.created_at}, Metadata: ${JSON.stringify(u.user_metadata)}`);
    });
  }
}

audit();
