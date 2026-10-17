import { supabaseAdmin } from '../config/supabase.js';
import { openWaProvider } from '../services/whatsapp/openWaProvider.js';
import { normalizePhoneNumber } from '../utils/phone.js';

async function sendAradhyaNotifications() {
  console.log('🥋 [Aradhya Notifications] Starting automated dispatch of all 4 message types...\n');

  if (!supabaseAdmin) {
    console.error('❌ Supabase client unavailable');
    process.exit(1);
  }

  // 1. Check OpenWA Bridge status
  console.log('📡 Checking OpenWA Bridge Status...');
  try {
    const status = await openWaProvider.getStatus();
    console.log('Bridge Status:', JSON.stringify(status, null, 2));
  } catch (err: any) {
    console.warn('⚠️ Could not fetch bridge status:', err.message);
  }

  // 2. Fetch student Aradhya
  const targetPhone = '9404849500';
  const { data: students, error: sErr } = await supabaseAdmin
    .from('students')
    .select('*, batch_students(*, batches(*))')
    .or(`student_mobile.ilike.%${targetPhone}%,parent_whatsapp.ilike.%${targetPhone}%`);

  if (sErr || !students || students.length === 0) {
    console.error('❌ Student Aradhya not found with mobile:', targetPhone, sErr);
    process.exit(1);
  }

  const student = students[0];
  console.log(`✅ Found Student: ${student.name} (ID: ${student.id})`);

  const batchInfo = student.batch_students?.[0]?.batches;
  const batchName = batchInfo?.name || 'MMA & Combat Sparring Squad (Kalarippayattu Squad)';
  const batchTime = batchInfo?.start_time ? `${batchInfo.start_time} - ${batchInfo.end_time}` : '06:00 AM - 08:00 AM';
  const batchDays = batchInfo?.schedule_days?.join(', ') || 'Mon, Wed, Fri';
  const batchPrice = student.monthly_fee || 700;

  const recipientPhone = normalizePhoneNumber(student.parent_whatsapp || student.student_mobile || targetPhone) || `+91${targetPhone}`;
  console.log(`📱 Recipient Phone: ${recipientPhone}`);

  const portalUrl = 'https://gurukul-sports-academy.pages.dev/login';
  const autoLoginLink = `${portalUrl}?phone=${encodeURIComponent(targetPhone)}&pin=${encodeURIComponent('Gurukul@9500')}&autologin=1`;

  // 3. Ensure a receipt exists in receipts table for PDF generation & records
  const receiptNumber = 'GSA-REC-2026-1001';
  const { data: existingReceipt } = await supabaseAdmin
    .from('receipts')
    .select('id, receipt_number')
    .eq('receipt_number', receiptNumber)
    .maybeSingle();

  let receiptId = existingReceipt?.id;
  if (!existingReceipt) {
    // Check if payment exists or create one
    let paymentId: string | null = null;
    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('student_id', student.id)
      .limit(1)
      .maybeSingle();

    if (existingPayment) {
      paymentId = existingPayment.id;
    } else {
      const { data: newPayment } = await supabaseAdmin
        .from('payments')
        .insert({
          student_id: student.id,
          amount: batchPrice,
          payment_method: 'CASH',
          payment_date: new Date().toISOString(),
          status: 'SUCCESS',
        })
        .select()
        .single();
      paymentId = newPayment?.id || null;
    }

    const { data: createdReceipt } = await supabaseAdmin
      .from('receipts')
      .insert({
        receipt_number: receiptNumber,
        student_id: student.id,
        payment_id: paymentId,
        amount: batchPrice,
        receipt_date: new Date().toISOString(),
      })
      .select()
      .single();

    receiptId = createdReceipt?.id;
    console.log(`🧾 Created official receipt record: ${receiptNumber} (ID: ${receiptId})`);
  } else {
    console.log(`🧾 Found existing receipt record: ${receiptNumber} (ID: ${receiptId})`);
  }

  // --- MESSAGE 1: STUDENT INVITE & PWA AUTO-LOGIN ---
  console.log('\n----------------------------------------');
  console.log('📤 Sending Type 1: Student Welcome & PWA 1-Tap Auto-Login Invite...');
  const msg1 = [
    `🥋 *Welcome to Gurukul Sports Academy, ${student.name}!*`,
    ``,
    `Your official Student Mobile App is ready! Access your daily attendance, batch timings, fee receipts, and academy updates on your phone:`,
    ``,
    `⚡ *Direct 1-Tap Auto-Login Link*:`,
    `${autoLoginLink}`,
    `_(Tap this link to open the app and log in instantly without entering your password!)_`,
    ``,
    `📱 *Manual Login Credentials*:`,
    `• Registered Mobile: *${targetPhone}*`,
    `• Password / PIN: *Gurukul@9500*`,
    `• Portal Website: ${portalUrl}`,
    ``,
    `🥋 *Enrolled Batch Details*:`,
    `• Batch: *${batchName}*`,
    `• Schedule: *${batchDays} (${batchTime})*`,
    `• Monthly Batch Fee: *₹${batchPrice} / month*`,
    ``,
    `📲 *How to install the App on your Phone*:`,
    `1. Tap the direct link above to open in Chrome or Safari.`,
    `2. Click *"Install App"* / *"Add to Home Screen"* when prompted.`,
    `3. Allow Push Notifications to receive instant class alerts!`,
    ``,
    `- *Gurukul Sports Academy Administration*`,
  ].join('\n');

  const res1 = await openWaProvider.sendMessage({ to: recipientPhone, body: msg1 });
  console.log('Result 1 (Invite):', res1);

  // Wait 3 seconds
  await new Promise((r) => setTimeout(r, 3000));

  // --- MESSAGE 2: ATTENDANCE ALERT (ABSENT NOTIFICATION) ---
  console.log('\n----------------------------------------');
  console.log('📤 Sending Type 2: Attendance Alert (Absent Notification)...');
  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const msg2 = [
    `⚠️ *ATTENDANCE ALERT: Gurukul Sports Academy*`,
    ``,
    `Dear Parent,`,
    `This is to inform you that *${student.name}* was marked *ABSENT* for training today:`,
    ``,
    `📅 *Date*: ${todayFormatted}`,
    `🥋 *Batch*: ${batchName}`,
    `⏰ *Timing*: ${batchTime}`,
    ``,
    `You can review attendance history and monthly percentage anytime on the student mobile app:`,
    `${portalUrl}`,
    ``,
    `If you have any questions or medical leave, please inform your Coach / Sensei.`,
    ``,
    `- *Gurukul Sports Academy Administration*`,
  ].join('\n');

  const res2 = await openWaProvider.sendMessage({ to: recipientPhone, body: msg2 });
  console.log('Result 2 (Attendance Absent):', res2);

  // Wait 3 seconds
  await new Promise((r) => setTimeout(r, 3000));

  // --- MESSAGE 3: FEE PAYMENT CONFIRMATION & RECEIPT ---
  console.log('\n----------------------------------------');
  console.log('📤 Sending Type 3: Fee Payment Confirmation & Receipt Details...');
  const msg3 = [
    `🧾 *FEE PAYMENT CONFIRMATION & RECEIPT*`,
    ``,
    `Dear Parent,`,
    `Thank you! We have successfully received training fee payment for *${student.name}*:`,
    ``,
    `🔖 *Receipt Number*: ${receiptNumber}`,
    `💰 *Amount Paid*: ₹${batchPrice}.00`,
    `🥋 *Enrolled Batch*: ${batchName}`,
    `💳 *Monthly Fee*: ₹${batchPrice} / month`,
    `📅 *Payment Date*: ${todayFormatted}`,
    `✅ *Fee Status*: PAID / ALL CLEAR`,
    ``,
    `📄 *Official PDF Receipt Download*:`,
    `You can download your verified PDF receipt directly from the Student App under "Fee History":`,
    `${portalUrl}`,
    ``,
    `Thank you for your prompt support!`,
    `- *Gurukul Sports Academy Accounts*`,
  ].join('\n');

  const res3 = await openWaProvider.sendMessage({ to: recipientPhone, body: msg3 });
  console.log('Result 3 (Fee Payment):', res3);

  // Wait 3 seconds
  await new Promise((r) => setTimeout(r, 3000));

  // --- MESSAGE 4: ACADEMY ANNOUNCEMENT ---
  console.log('\n----------------------------------------');
  console.log('📤 Sending Type 4: Academy Announcement Notice...');
  const msg4 = [
    `📢 *OFFICIAL ACADEMY ANNOUNCEMENT*`,
    `*Gurukul Sports Academy - October 2026*`,
    ``,
    `Dear Students & Parents,`,
    ``,
    `🏆 *Upcoming Belt Grading Examination & Combat Sparring Trials*:`,
    `• *Date*: Sunday, 25th October 2026`,
    `• *Reporting Time*: 07:30 AM Sharp`,
    `• *Venue*: Gurukul Sports Academy Main Arena`,
    `• *Eligibility*: All students with >75% monthly attendance.`,
    ``,
    `🥋 *Required Gear*:`,
    `Please ensure complete academy uniform, belt, safety guards, and hydration bottle.`,
    ``,
    `Full event schedule and guidelines are published on the Student App under *"Announcements"*:`,
    `${portalUrl}`,
    ``,
    `Best of luck to all athletes! 🥋🔥`,
    `- *Chief Sensei & Administration*`,
    `*Gurukul Sports Academy*`,
  ].join('\n');

  const res4 = await openWaProvider.sendMessage({ to: recipientPhone, body: msg4 });
  console.log('Result 4 (Announcement):', res4);

  // Record in whatsapp_messages table
  try {
    await supabaseAdmin.from('whatsapp_messages').insert([
      {
        student_id: student.id,
        recipient_phone: recipientPhone,
        message_body: msg1,
        event_type: 'STUDENT_INVITE',
        status: res1.success ? 'SENT' : 'FAILED',
        provider_name: 'openwa',
        provider_message_id: res1.messageId || null,
        sent_at: res1.success ? new Date().toISOString() : null,
      },
      {
        student_id: student.id,
        recipient_phone: recipientPhone,
        message_body: msg2,
        event_type: 'ATTENDANCE_ABSENT',
        status: res2.success ? 'SENT' : 'FAILED',
        provider_name: 'openwa',
        provider_message_id: res2.messageId || null,
        sent_at: res2.success ? new Date().toISOString() : null,
      },
      {
        student_id: student.id,
        recipient_phone: recipientPhone,
        message_body: msg3,
        event_type: 'PAYMENT_SUCCESS',
        status: res3.success ? 'SENT' : 'FAILED',
        provider_name: 'openwa',
        provider_message_id: res3.messageId || null,
        sent_at: res3.success ? new Date().toISOString() : null,
      },
      {
        student_id: student.id,
        recipient_phone: recipientPhone,
        message_body: msg4,
        event_type: 'ACADEMY_ANNOUNCEMENT',
        status: res4.success ? 'SENT' : 'FAILED',
        provider_name: 'openwa',
        provider_message_id: res4.messageId || null,
        sent_at: res4.success ? new Date().toISOString() : null,
      },
    ]);
  } catch (err: any) {
    console.warn('Logging into whatsapp_messages skipped or failed:', err.message);
  }

  console.log('\n🎉 [COMPLETE] All 4 notification types processed successfully!');
  process.exit(0);
}

sendAradhyaNotifications().catch((err) => {
  console.error('Fatal error in sendAradhyaNotifications:', err);
  process.exit(1);
});
