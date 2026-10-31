import { supabaseAdmin } from '../config/supabase.js';

async function checkTournamentsAndRegistrations() {
  const { data: tournaments } = await supabaseAdmin!
    .from('tournaments')
    .select('id, name, title, entry_fee');
  console.log('TOURNAMENTS:', tournaments);

  const { data: registrations } = await supabaseAdmin!
    .from('tournament_registrations')
    .select('id, tournament_id, student_id, fee_amount, amount_paid, payment_status');
  console.log('REGISTRATIONS COUNT:', registrations?.length);
  console.log('REGISTRATIONS SAMPLE:', registrations);
}

checkTournamentsAndRegistrations();
