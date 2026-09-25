import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import app from '../app.js';
import { Server } from 'http';
import { whatsappProviderFactory } from '../services/whatsapp/whatsappProvider.factory.js';
import { whatsappSettingsService } from '../services/whatsapp/whatsappSettings.service.js';
import { queueService } from '../services/whatsapp/queue.service.js';

async function runWhatsAppPhase1Tests() {
  console.log('🧪 Starting Comprehensive Phase 1 WhatsApp Automation, Queue & Safety Tests...\n');

  if (
    !env.SUPABASE_URL ||
    !env.SUPABASE_ANON_KEY ||
    !env.DEV_ADMIN_EMAIL ||
    !env.DEV_ADMIN_PASSWORD ||
    !env.DEV_TEACHER_EMAIL ||
    !env.DEV_TEACHER_PASSWORD
  ) {
    console.error('❌ Environment credentials missing.');
    process.exit(1);
  }

  // 1. Authenticate real Admin & Teacher to obtain valid Supabase JWTs
  const authClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: adminLogin, error: adminLoginErr } = await authClient.auth.signInWithPassword({
    email: env.DEV_ADMIN_EMAIL,
    password: env.DEV_ADMIN_PASSWORD,
  });
  if (adminLoginErr || !adminLogin.session) {
    console.error('Failed to log in Admin:', adminLoginErr);
    process.exit(1);
  }
  const adminToken = adminLogin.session.access_token;

  const { data: teacherLogin, error: teacherLoginErr } = await authClient.auth.signInWithPassword({
    email: env.DEV_TEACHER_EMAIL,
    password: env.DEV_TEACHER_PASSWORD,
  });
  if (teacherLoginErr || !teacherLogin.session) {
    console.error('Failed to log in Teacher:', teacherLoginErr);
    process.exit(1);
  }
  const teacherToken = teacherLogin.session.access_token;

  // 2. Start test server on dedicated port
  const PORT = 10025;
  let server: Server | undefined;
  await new Promise<void>((resolve) => {
    server = app.listen(PORT, () => resolve());
  });

  const BASE_URL = `http://localhost:${PORT}/api`;
  let passCount = 0;
  let failCount = 0;

  function assert(name: string, condition: boolean, details?: any) {
    if (condition) {
      passCount++;
      console.log(`✅ PASS: ${name}`);
    } else {
      failCount++;
      console.error(`❌ FAIL: ${name}`, details ? JSON.stringify(details, null, 2) : '');
    }
  }

  try {
    // -------------------------------------------------------------------------
    // RBAC VERIFICATION
    // -------------------------------------------------------------------------
    const unauthStatus = await fetch(`${BASE_URL}/whatsapp/status`);
    assert('Unauthenticated request to /api/whatsapp/status is rejected with HTTP 401', unauthStatus.status === 401);

    const teacherStatus = await fetch(`${BASE_URL}/whatsapp/status`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert('Teacher cannot access /api/whatsapp/status (HTTP 403 Forbidden)', teacherStatus.status === 403);

    const teacherQueue = await fetch(`${BASE_URL}/whatsapp/queue`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert('Teacher cannot access /api/whatsapp/queue (HTTP 403 Forbidden)', teacherQueue.status === 403);

    const teacherSettings = await fetch(`${BASE_URL}/whatsapp/settings`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert('Teacher cannot access /api/whatsapp/settings (HTTP 403 Forbidden)', teacherSettings.status === 403);

    // -------------------------------------------------------------------------
    // TEST 1: Status endpoint & Honest Device Reporting (No fake connected data)
    // -------------------------------------------------------------------------
    const statusRes = await fetch(`${BASE_URL}/whatsapp/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const statusData = await statusRes.json();
    assert(
      'Admin fetches /api/whatsapp/status (HTTP 200 with live device & provider metadata)',
      statusRes.status === 200 &&
        statusData.success &&
        statusData.data?.provider &&
        statusData.data?.device &&
        typeof statusData.data?.stats?.dailyLimit === 'number',
      statusData
    );

    // Verify Prototype Sender reports honest status (NOT_CONFIGURED or DISCONNECTED when offline, or CONNECTED if live bridge is running)
    const protoSender = whatsappProviderFactory.getPrototypeSender();
    const protoStatus = await protoSender.getStatus();
    assert(
      'Prototype Linked-Device sender does not fake connected status when unconfigured',
      protoStatus.status === 'NOT_CONFIGURED' ||
        protoStatus.status === 'DISCONNECTED' ||
        protoStatus.status === 'QR_READY' ||
        protoStatus.status === 'ERROR' ||
        (protoStatus.status === 'CONNECTED' && Boolean(protoStatus.phoneNumber)),
      protoStatus
    );

    // Reset settings to safe baseline (automation ON, emergency stop OFF, limit 40, provider mock)
    await whatsappSettingsService.updateSettings({
      globalAutomationEnabled: true,
      emergencyStop: false,
      dailyLimit: 40,
      providerType: 'mock',
    });
    await whatsappProviderFactory.getMockProvider().connect();

    // -------------------------------------------------------------------------
    // TEST 2: Send one predefined message -> Queue -> Processing -> Sent -> Log
    // -------------------------------------------------------------------------
    const testPhone1 = '+919421248210';
    const testBody1 = `Test message 1 [${Date.now()}]: Welcome to Apex Academy!`;

    const queueRes1 = await fetch(`${BASE_URL}/whatsapp/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        recipientPhone: testPhone1,
        messageBody: testBody1,
        eventType: 'PHASE1_TEST_1',
      }),
    });
    const queueData1 = await queueRes1.json();
    assert(
      'Test 1: Message enters queue in PENDING status (HTTP 201)',
      queueRes1.status === 201 && queueData1.success && queueData1.data?.status === 'PENDING',
      queueData1
    );
    const queueId1 = queueData1.data?.id;

    // Process the queue
    const processRes1 = await fetch(`${BASE_URL}/whatsapp/queue/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ batchSize: 5 }),
    });
    const processData1 = await processRes1.json();
    assert(
      'Test 1: Queue processing executes and transitions message to SENT/MOCK',
      processRes1.status === 200 && processData1.data?.successful >= 1,
      processData1
    );

    // Verify status in queue listing
    const listQueueRes1 = await fetch(`${BASE_URL}/whatsapp/queue?recipientPhone=${encodeURIComponent(testPhone1)}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listQueueData1 = await listQueueRes1.json();
    const processedItem1 = listQueueData1.data?.find((i: any) => i.id === queueId1);
    assert(
      'Test 1: Queue record is updated with SENT/MOCK, sent_at timestamp, and attempts count',
      processedItem1 &&
        (processedItem1.status === 'SENT' || processedItem1.status === 'MOCK') &&
        processedItem1.sent_at &&
        processedItem1.attempts >= 1,
      processedItem1
    );

    // Verify appears in message logs
    const logsRes1 = await fetch(`${BASE_URL}/whatsapp/logs?eventType=PHASE1_TEST_1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const logsData1 = await logsRes1.json();
    assert(
      'Test 1: Final message status is persistently recorded in message logs',
      logsRes1.status === 200 && Array.isArray(logsData1.data) && logsData1.data.length >= 1,
      logsData1
    );

    // -------------------------------------------------------------------------
    // TEST 3: Duplicate Protection
    // -------------------------------------------------------------------------
    // Attempting to send an identical message to the same recipient should trigger duplicate protection
    const dupRes = await fetch(`${BASE_URL}/whatsapp/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        recipientPhone: testPhone1,
        messageBody: testBody1,
        eventType: 'PHASE1_TEST_1',
      }),
    });
    assert(
      'Test 2: Duplicate protection halts duplicate send for identical message (HTTP 409 DUPLICATE_MESSAGE)',
      dupRes.status === 409,
      await dupRes.json()
    );

    // -------------------------------------------------------------------------
    // TEST 4: Global Automation OFF Protection
    // -------------------------------------------------------------------------
    await whatsappSettingsService.updateSettings({ globalAutomationEnabled: false });

    const queueRes3 = await fetch(`${BASE_URL}/whatsapp/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        recipientPhone: '+919421248211',
        messageBody: `Automation OFF test message [${Date.now()}]`,
        eventType: 'PHASE1_TEST_OFF',
      }),
    });
    const queueData3 = await queueRes3.json();
    const queueId3 = queueData3.data?.id;

    // Attempt processing
    const processRes3 = await fetch(`${BASE_URL}/whatsapp/queue/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ batchSize: 5 }),
    });
    const processData3 = await processRes3.json();
    assert(
      'Test 3: When global automation is OFF, processQueue sends 0 messages',
      processData3.data?.processed === 0 && processData3.data?.successful === 0,
      processData3
    );

    // Check item remains pending/unsent
    const listQueue3 = await queueService.listQueue({ recipientPhone: '+919421248211' });
    const item3 = listQueue3.find((i) => i.id === queueId3);
    assert('Test 3: Queued message is safely held without sending when automation is OFF', item3?.status === 'PENDING');

    // Turn automation back ON
    await whatsappSettingsService.updateSettings({ globalAutomationEnabled: true });

    // -------------------------------------------------------------------------
    // TEST 5: Emergency STOP ON Protection
    // -------------------------------------------------------------------------
    await fetch(`${BASE_URL}/whatsapp/emergency-stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ emergencyStop: true }),
    });

    const queueRes4 = await fetch(`${BASE_URL}/whatsapp/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        recipientPhone: '+919421248212',
        messageBody: `Emergency STOP test message [${Date.now()}]`,
        eventType: 'PHASE1_TEST_STOP',
      }),
    });
    const queueData4 = await queueRes4.json();

    const processRes4 = await fetch(`${BASE_URL}/whatsapp/queue/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ batchSize: 5 }),
    });
    const processData4 = await processRes4.json();
    assert(
      'Test 4: When Emergency STOP is ON, zero messages are processed or sent',
      processData4.data?.processed === 0 && processData4.data?.successful === 0,
      processData4
    );

    // Turn Emergency STOP back OFF
    await fetch(`${BASE_URL}/whatsapp/emergency-stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ emergencyStop: false }),
    });

    // -------------------------------------------------------------------------
    // TEST 6: Opt-in / Opt-out Protection
    // -------------------------------------------------------------------------
    const optOutPhone = '+919421248213';
    // Set recipient as OPTED OUT
    await fetch(`${BASE_URL}/whatsapp/opt-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ phoneNumber: optOutPhone, optIn: false }),
    });

    const queueRes5 = await fetch(`${BASE_URL}/whatsapp/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        recipientPhone: optOutPhone,
        messageBody: `Opt-out test message [${Date.now()}]`,
        eventType: 'PHASE1_OPT_OUT',
      }),
    });
    const queueData5 = await queueRes5.json();
    const queueId5 = queueData5.data?.id;

    // Process item
    const item5 = (await queueService.listQueue()).find((i) => i.id === queueId5);
    if (item5) {
      const processResult5 = await queueService.processItem(item5);
      assert(
        'Test 5: Recipient with opt-in = false is rejected with FAILED status and opt-out reason',
        Boolean(
          processResult5.success === false &&
            processResult5.status === 'FAILED' &&
            processResult5.reason?.includes('opted out')
        ),
        processResult5
      );
    }

    // -------------------------------------------------------------------------
    // TEST 7: Force Provider Failure & Retry Availability
    // -------------------------------------------------------------------------
    const failPhone = '0000000000'; // Triggers simulated failure in mock provider
    const queueRes6 = await fetch(`${BASE_URL}/whatsapp/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        recipientPhone: failPhone,
        messageBody: `Failure test message [${Date.now()}]`,
        eventType: 'PHASE1_FAILURE_TEST',
      }),
    });
    const queueData6 = await queueRes6.json();
    const queueId6 = queueData6.data?.id;

    const item6 = (await queueService.listQueue()).find((i) => i.id === queueId6);
    if (item6) {
      const processRes6 = await queueService.processItem(item6);
      assert(
        'Test 6: Provider failure sets FAILED status, stores failure reason and increments attempt count',
        processRes6.status === 'FAILED' &&
          item6.attempts >= 1 &&
          Boolean(item6.failure_reason),
        { processRes6, item6 }
      );
    }

    // -------------------------------------------------------------------------
    // TEST 8: Retry Failed Message
    // -------------------------------------------------------------------------
    // Now activate Emergency stop and attempt retry -> should fail safety check!
    await whatsappSettingsService.setEmergencyStop(true);
    const retryFailRes = await fetch(`${BASE_URL}/whatsapp/messages/${queueId6}/retry`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const retryFailData = await retryFailRes.json();
    assert(
      'Test 7: Retry re-evaluates all safety checks (halts when Emergency STOP is active)',
      retryFailData.data?.failure_reason?.includes('Emergency STOP'),
      retryFailData
    );

    // Deactivate emergency stop
    await whatsappSettingsService.setEmergencyStop(false);

    // -------------------------------------------------------------------------
    // TEST 9: Dynamic Variable Rendering
    // -------------------------------------------------------------------------
    const renderedBody = (await import('../services/whatsapp/automation.service.js')).automationService.renderTemplate(
      'Dear {{parent_name}}, fee of Rs. {{pending_amount}} for {{student_name}} is due. Pay here: {{razorpay_payment_link}}',
      {
        parent_name: 'Vikram Mehta',
        student_name: 'Ananya Mehta',
        pending_amount: '4,200',
        razorpay_payment_link: 'https://rzp.io/i/apex_mehta',
      }
    );
    assert(
      'Test 8: Dynamic variables {{student_name}}, {{pending_amount}}, {{razorpay_payment_link}} correctly render',
      renderedBody.includes('Ananya Mehta') &&
        renderedBody.includes('4,200') &&
        renderedBody.includes('https://rzp.io/i/apex_mehta'),
      renderedBody
    );

    // -------------------------------------------------------------------------
    // TEST 10: Unsaved Recipient Number
    // -------------------------------------------------------------------------
    const unsavedPhone = '+919123456789';
    const queueUnsaved = await queueService.enqueueMessage({
      recipientPhone: unsavedPhone,
      messageBody: 'Unsaved contact delivery test',
      eventType: 'UNSAVED_TEST',
    });
    const unsavedProcess = await queueService.processItem(queueUnsaved);
    assert(
      'Test 9: Outgoing messages dispatch to raw phone numbers without requiring device contact list synchronization',
      unsavedProcess.success === true,
      unsavedProcess
    );

    // -------------------------------------------------------------------------
    // TEST 11: Disconnect Sender & Prevent False Delivery
    // -------------------------------------------------------------------------
    await whatsappProviderFactory.getMockProvider().disconnect();
    const disconnectedQueue = await queueService.enqueueMessage({
      recipientPhone: '+919421248220',
      messageBody: 'Disconnected test message',
      eventType: 'DISCONNECTED_TEST',
    });
    const disconnectProcess = await queueService.processItem(disconnectedQueue);
    assert(
      'Test 10: Disconnected sender does not falsely mark messages as SENT (halts safely with reason)',
      disconnectProcess.success === false && disconnectProcess.status !== 'SENT',
      disconnectProcess
    );

    // Reconnect provider for subsequent operations
    await whatsappProviderFactory.getMockProvider().connect();

    // -------------------------------------------------------------------------
    // TEST 12: Daily Limit Enforcement
    // -------------------------------------------------------------------------
    await whatsappSettingsService.updateSettings({ dailyLimit: 1 });
    const limitQueueItem = await queueService.enqueueMessage({
      recipientPhone: '+919421248230',
      messageBody: 'Daily limit test message',
      eventType: 'DAILY_LIMIT_TEST',
    });
    const limitProcess = await queueService.processItem(limitQueueItem);
    assert(
      'Test 11: When daily limit is exceeded, message remains safely held in queue with limit warning',
      Boolean(limitProcess.success === false && limitProcess.reason?.includes('Daily sending limit reached')),
      limitProcess
    );

    // Restore daily limit to 40
    await whatsappSettingsService.updateSettings({ dailyLimit: 40 });

    console.log(`\n📊 Phase 1 WhatsApp Tests: ${passCount} PASSED, ${failCount} FAILED\n`);
  } catch (err: any) {
    console.error('Fatal test error:', err);
    failCount++;
  } finally {
    if (server) {
      server.close();
    }
  }

  if (failCount > 0) {
    process.exit(1);
  }
}

runWhatsAppPhase1Tests();
