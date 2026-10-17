import { openWaProvider } from '../services/whatsapp/openWaProvider.js';
import { supabaseAdmin } from '../config/supabase.js';

async function sendPushConfirmedWhatsApp() {
  console.log('Sending notification confirmation WhatsApp message to Aradhya (+919404849500)...');
  const recipientPhone = '+919404849500';
  const portalUrl = 'https://gurukul-sports-academy.pages.dev/login?phone=9404849500&pin=Gurukul%409500&autologin=1';

  const body = [
    `🔔 *Gurukul Sports Academy: Push Notifications Activated!* 🥋`,
    ``,
    `Hello Aradhya,`,
    `We detected that push notifications have been successfully enabled on your device!`,
    ``,
    `✅ *What you will now receive instantly*:`,
    `• 🥋 Daily Attendance mark & alert updates`,
    `• ⏰ Class schedule and timing reminders`,
    `• 🧾 Verified PDF fee payment receipts`,
    `• 📢 Belt grading examinations & tournament announcements`,
    ``,
    `📲 *Open Your Student Dashboard*:`,
    `${portalUrl}`,
    ``,
    `_(Tip: You can tap "Send Test Notification" on your dashboard anytime to test the device notification tray!)_`,
    ``,
    `- *Gurukul Sports Academy Administration*`,
  ].join('\n');

  const res = await openWaProvider.sendMessage({
    to: recipientPhone,
    body,
  });

  console.log('Dispatch result:', res);

  try {
    await supabaseAdmin!.from('whatsapp_messages').insert({
      student_id: 'ac7785e9-7096-4894-bb65-9ccffd03c267',
      recipient_phone: recipientPhone,
      message_body: body,
      event_type: 'CUSTOM_NOTIFICATION',
      status: res.success ? 'SENT' : 'FAILED',
      provider_name: 'openwa',
      provider_message_id: res.messageId || null,
      sent_at: res.success ? new Date().toISOString() : null,
    });
  } catch (err: any) {
    console.warn('Logging error:', err.message);
  }

  process.exit(0);
}

sendPushConfirmedWhatsApp().catch((err) => {
  console.error(err);
  process.exit(1);
});
