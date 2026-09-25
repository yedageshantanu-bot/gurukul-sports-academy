import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { ROLES, STATUS } from '../constants/index.js';

async function seedUsers() {
  console.log('--- Development User Seeding Script ---');

  // Guard: Never run in production
  if (env.NODE_ENV === 'production') {
    console.error('❌ Error: Development seeding cannot be executed in production environment.');
    process.exit(1);
  }

  // Guard: Check Supabase Admin client
  if (!supabaseAdmin) {
    console.error('❌ Error: Supabase Admin client is not configured. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
    process.exit(1);
  }

  const { DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD, DEV_TEACHER_EMAIL, DEV_TEACHER_PASSWORD } = env;

  if (!DEV_ADMIN_EMAIL || !DEV_ADMIN_PASSWORD || !DEV_TEACHER_EMAIL || !DEV_TEACHER_PASSWORD) {
    console.error('❌ Error: Development credentials missing. Please set DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD, DEV_TEACHER_EMAIL, and DEV_TEACHER_PASSWORD.');
    process.exit(1);
  }

  console.log('Seeding development users with configured email addresses (passwords hidden)...');

  // Helper to get or create an auth user
  async function getOrCreateUser(email: string, password: string): Promise<string> {
    // Check if user already exists
    const { data: listData, error: listError } = await supabaseAdmin!.auth.admin.listUsers();
    if (listError) {
      console.warn(`Warning checking existing users: ${listError.message}`);
    }

    const existingUser = listData?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      console.log(`ℹ️ Auth user exists for ${email}. Reusing user ID: ${existingUser.id}`);
      return existingUser.id;
    }

    // Create new auth user
    const { data: createData, error: createError } = await supabaseAdmin!.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      throw new Error(`Failed to create auth user for ${email}: ${createError.message}`);
    }

    console.log(`✅ Created auth user for ${email}. User ID: ${createData.user.id}`);
    return createData.user.id;
  }

  try {
    // 1. Seed Admin User
    const adminUserId = await getOrCreateUser(DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD);

    // Upsert Admin profile
    const { error: adminProfileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: adminUserId,
          role: ROLES.ADMIN,
          full_name: 'Academy Administrator',
          email: DEV_ADMIN_EMAIL,
          status: STATUS.ACTIVE,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (adminProfileError) {
      throw new Error(`Failed to upsert Admin profile: ${adminProfileError.message}`);
    }
    console.log(`✅ Admin profile upserted for ${DEV_ADMIN_EMAIL} with role ${ROLES.ADMIN}`);

    // 2. Seed Teacher User
    const teacherUserId = await getOrCreateUser(DEV_TEACHER_EMAIL, DEV_TEACHER_PASSWORD);

    // Upsert Teacher profile
    const { error: teacherProfileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: teacherUserId,
          role: ROLES.TEACHER,
          full_name: 'Lead Instructor',
          email: DEV_TEACHER_EMAIL,
          status: STATUS.ACTIVE,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (teacherProfileError) {
      throw new Error(`Failed to upsert Teacher profile: ${teacherProfileError.message}`);
    }
    console.log(`✅ Teacher profile upserted for ${DEV_TEACHER_EMAIL} with role ${ROLES.TEACHER}`);

    // Upsert teacher record in teachers table
    const { error: teacherRecordError } = await supabaseAdmin
      .from('teachers')
      .upsert(
        {
          profile_id: teacherUserId,
          subject: 'Science & Mathematics',
          status: STATUS.ACTIVE,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id' }
      );

    if (teacherRecordError) {
      throw new Error(`Failed to upsert Teacher details: ${teacherRecordError.message}`);
    }
    console.log(`✅ Teacher record linked in teachers table for profile ${teacherUserId}`);

    console.log('🎉 Development user seeding completed successfully.');
  } catch (err: any) {
    console.error('❌ Seeding failed:', err?.message || err);
    process.exit(1);
  }
}

// Execute when invoked directly
seedUsers();
