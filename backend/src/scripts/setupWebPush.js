const dotenv = require('dotenv');
dotenv.config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkStudents() {
  const { data, error } = await supabase.from('students').select('*').limit(1);
  if (data && data.length > 0) {
    console.log('Students columns:', Object.keys(data[0]));
  }
  process.exit(0);
}
checkStudents();
