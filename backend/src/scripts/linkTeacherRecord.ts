import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function linkTeacher() {
  const { data } = await supabaseAdmin.auth.admin.listUsers();
  const teacherUser = data.users.find(u => u.email === 'teacher@gurukulsports.in');
  if (teacherUser) {
    const { data: existing } = await supabaseAdmin.from('teachers').select('*').eq('profile_id', teacherUser.id).maybeSingle();
    if (!existing) {
      await supabaseAdmin.from('teachers').insert({
        profile_id: teacherUser.id,
        phone: '+91 98765 43210',
        specialization: 'Cricket & Athletic Fitness',
        status: 'ACTIVE',
      });
      console.log('✅ Created linked teacher record in teachers table');
    } else {
      console.log('✅ Teacher record already linked');
    }
  }
}
linkTeacher().catch(console.error);
