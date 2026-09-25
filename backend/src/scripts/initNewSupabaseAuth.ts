import { createClient } from '@supabase/supabase-js';

const url = 'https://litnduotmypvhnorjnwa.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpdG5kdW90bXlwdmhub3JqbndhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDI2ODI0OCwiZXhwIjoyMTA1ODQ0MjQ4fQ.Qwp_EPvk9JDReZVmNw5opDCIbKQzziDuA5R2S8MLhsg';

const client = createClient(url, serviceKey);

async function initAuth() {
  console.log('Seeding Auth users on new Supabase...');

  // 1. Admin
  const adminEmail = 'admin@gurukulsports.in';
  const adminPassword = 'Admin@Gurukul2026!';
  const { data: adminUser, error: adminErr } = await client.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { role: 'ADMIN', full_name: 'Gurukul Academy Admin' }
  });
  if (adminErr) {
    console.log('Admin user result:', adminErr.message);
  } else {
    console.log('✅ Created Admin user:', adminUser.user?.email, 'ID:', adminUser.user?.id);
  }

  // 2. Teacher
  const teacherEmail = 'teacher@gurukulsports.in';
  const teacherPassword = 'Teacher@Gurukul2026!';
  const { data: teacherUser, error: teacherErr } = await client.auth.admin.createUser({
    email: teacherEmail,
    password: teacherPassword,
    email_confirm: true,
    user_metadata: { role: 'TEACHER', full_name: 'Sensei Vikram Salunkhe' }
  });
  if (teacherErr) {
    console.log('Teacher user result:', teacherErr.message);
  } else {
    console.log('✅ Created Teacher user:', teacherUser.user?.email, 'ID:', teacherUser.user?.id);
  }

  const { data: list } = await client.auth.admin.listUsers();
  console.log('Total registered auth users now:', list?.users?.length);
}

initAuth();
