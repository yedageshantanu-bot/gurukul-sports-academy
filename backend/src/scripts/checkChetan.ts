import { supabaseAdmin } from '../config/supabase.js';

async function check() {
  const chetanId = '100c2eb9-efa1-4681-a1de-97295e5799e6';
  const { data: batches } = await supabaseAdmin!
    .from('batch_students')
    .select('*, batches(*)')
    .eq('student_id', chetanId);
  console.log('CHETAN BATCHES:', JSON.stringify(batches, null, 2));

  const { data: ranks } = await supabaseAdmin!
    .from('student_ranks')
    .select('*, martial_arts_ranks(*)')
    .eq('student_id', chetanId);
  console.log('CHETAN RANKS:', JSON.stringify(ranks, null, 2));
}

check();
