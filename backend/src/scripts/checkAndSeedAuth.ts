import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) {
    console.error('Error listing users:', error);
    return;
  }
  console.log('--- USERS IN SUPABASE ---');
  for (const u of data.users) {
    console.log(`Email: ${u.email} | ID: ${u.id}`);
  }

  // Ensure admin@gurukulsports.in exists and has password Admin@Gurukul2026!
  let gurukulAdmin = data.users.find(u => u.email === 'admin@gurukulsports.in');
  if (!gurukulAdmin) {
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: 'admin@gurukulsports.in',
      password: 'Admin@Gurukul2026!',
      email_confirm: true,
    });
    if (createErr) console.error('Failed to create admin@gurukulsports.in:', createErr);
    else {
      console.log('✅ Created admin@gurukulsports.in successfully!');
      gurukulAdmin = newUser.user;
    }
  } else {
    // Update password
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(gurukulAdmin.id, {
      password: 'Admin@Gurukul2026!',
    });
    if (updErr) console.error('Update password failed:', updErr);
    else console.log('✅ Password set to Admin@Gurukul2026! for admin@gurukulsports.in');
  }

  if (gurukulAdmin) {
    // Ensure profile exists with role ADMIN
    const { error: profErr } = await supabaseAdmin.from('profiles').upsert({
      id: gurukulAdmin.id,
      role: 'ADMIN',
      full_name: 'Gurukul Academy Admin',
      email: 'admin@gurukulsports.in',
      status: 'ACTIVE',
      updated_at: new Date().toISOString(),
    });
    if (profErr) console.error('Profile upsert error:', profErr);
    else console.log('✅ Profile upserted with role ADMIN');
  }

  // Also check teacher@gurukulsports.in
  let gurukulTeacher = data.users.find(u => u.email === 'teacher@gurukulsports.in');
  if (!gurukulTeacher) {
    const { data: newTeacher, error: tErr } = await supabaseAdmin.auth.admin.createUser({
      email: 'teacher@gurukulsports.in',
      password: 'Teacher@Gurukul2026!',
      email_confirm: true,
    });
    if (tErr) console.error('Failed to create teacher@gurukulsports.in:', tErr);
    else {
      console.log('✅ Created teacher@gurukulsports.in successfully!');
      gurukulTeacher = newTeacher.user;
    }
  } else {
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(gurukulTeacher.id, {
      password: 'Teacher@Gurukul2026!',
    });
    if (updErr) console.error('Update password failed for teacher:', updErr);
    else console.log('✅ Password set to Teacher@Gurukul2026! for teacher@gurukulsports.in');
  }

  if (gurukulTeacher) {
    await supabaseAdmin.from('profiles').upsert({
      id: gurukulTeacher.id,
      role: 'TEACHER',
      full_name: 'Head Coach / Instructor',
      email: 'teacher@gurukulsports.in',
      status: 'ACTIVE',
      updated_at: new Date().toISOString(),
    });
    console.log('✅ Profile upserted with role TEACHER');
  }
}

main().catch(console.error);
