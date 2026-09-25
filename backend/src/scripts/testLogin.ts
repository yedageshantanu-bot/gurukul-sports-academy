import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_ANON_KEY || '');

async function test() {
  const { data, error } = await client.auth.signInWithPassword({
    email: 'admin@gurukulsports.in',
    password: 'Admin@Gurukul2026!',
  });
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('✅ SIGN IN WORKED! User:', data.user.email);
  }
}
test().catch(console.error);
