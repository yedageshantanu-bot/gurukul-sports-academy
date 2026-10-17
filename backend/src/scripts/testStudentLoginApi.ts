import { supabaseAdmin } from '../config/supabase.js';
import { studentPortalService } from '../services/studentPortal.service.js';

async function seedReceiptForAradhya() {
  const studentId = 'ac7785e9-7096-4894-bb65-9ccffd03c267';

  // 1. Insert payment
  const { data: payment, error: pErr } = await supabaseAdmin!
    .from('payments')
    .insert({
      student_id: studentId,
      amount: 700,
      status: 'SUCCESS',
      provider: 'CASH',
      paid_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (pErr) {
    console.error('Payment insert error:', pErr);
  } else {
    console.log('Payment created:', payment.id);
  }

  // 2. Insert receipt
  const { data: receipt, error: rErr } = await supabaseAdmin!
    .from('receipts')
    .insert({
      receipt_number: 'GSA-REC-2026-1001',
      student_id: studentId,
      payment_id: payment?.id || null,
      amount: 700,
      issued_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (rErr) {
    console.error('Receipt insert error:', rErr);
  } else {
    console.log('Receipt created:', receipt);
  }

  // 3. Test getReceiptPdfBuffer
  if (receipt) {
    const pdf = await studentPortalService.getReceiptPdfBuffer(receipt.id, studentId);
    console.log('PDF Generated successfully! Size:', pdf.buffer.length, 'bytes | File:', pdf.fileName);
  }

  process.exit(0);
}

seedReceiptForAradhya();
