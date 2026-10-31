import { supabaseAdmin } from '../config/supabase.js';

async function check() {
  const { data } = await supabaseAdmin!
    .from('students')
    .select('id, name, parent_name, student_mobile, parent_whatsapp, monthly_fee, course');
  console.log('STUDENTS COUNT:', data?.length);
  const invalid = data?.filter(s => !s.parent_name || !s.parent_whatsapp || !s.name);
  console.log('STUDENTS WITH NULL/EMPTY PARENT_NAME OR PARENT_WHATSAPP:', JSON.stringify(invalid, null, 2));
}

check();
