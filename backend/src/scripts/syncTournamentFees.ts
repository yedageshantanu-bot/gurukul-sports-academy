import { supabaseAdmin } from '../config/supabase.js';

async function syncAllTournamentRegistrationFees() {
  const { data: tournaments, error: tErr } = await supabaseAdmin!
    .from('tournaments')
    .select('id, name, entry_fee');
  console.log('TOURNAMENTS:', tournaments, tErr);

  if (tournaments) {
    for (const t of tournaments) {
      const fee = Number(t.entry_fee || 0);
      console.log(`Tournament: "${t.name}" -> entry_fee=${fee}`);
      if (fee === 0) {
        // If tournament is free, cascade update all registrations to 0 and PAID
        const { data: updated, error: uErr } = await supabaseAdmin!
          .from('tournament_registrations')
          .update({ fee_amount: 0, payment_status: 'PAID' })
          .eq('tournament_id', t.id)
          .eq('amount_paid', 0);
        console.log(`  Updated registrations for ${t.name}:`, updated, uErr);
      }
    }
  }

  const { data: regs } = await supabaseAdmin!
    .from('tournament_registrations')
    .select('id, tournament_id, fee_amount, amount_paid, payment_status');
  console.log('UPDATED REGISTRATIONS:', regs);
}

syncAllTournamentRegistrationFees();
