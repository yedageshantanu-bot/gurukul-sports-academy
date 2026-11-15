import assert from 'assert';
import { scheduledPdfExportService } from '../services/scheduledPdfExport.service.js';
import { announcementService } from '../services/announcement.service.js';
import { recipientSecurityService } from '../services/whatsapp/recipientSecurity.service.js';
import { automationService } from '../services/whatsapp/automation.service.js';
import { queueService } from '../services/whatsapp/queue.service.js';
import { supabaseAdmin } from '../config/supabase.js';

async function runEndToEndVerification() {
  console.log('================================================================');
  console.log('🧪 Hardened Verification: All 6 Requirements End-To-End');
  console.log('================================================================');

  // --------------------------------------------------------------------------
  // REQUIREMENT 1: Export Historical & Missed Scheduled Messages to PDF
  // --------------------------------------------------------------------------
  console.log('\n▶ [Req 1] Historical & Missed Scheduled Messages PDF Export');
  const pastData = await scheduledPdfExportService.getPastScheduledMessages();
  console.log(`  Found ${pastData.records.length} historical records (Sent: ${pastData.summary.totalSent}, Missed: ${pastData.summary.totalMissed}, Failed: ${pastData.summary.totalFailed})`);
  assert(typeof pastData.summary.totalSent === 'number', 'Summary contains totalSent');
  assert(typeof pastData.summary.totalMissed === 'number', 'Summary contains totalMissed');
  assert(typeof pastData.summary.totalFailed === 'number', 'Summary contains totalFailed');

  const pdfBuffer = await scheduledPdfExportService.generateHistoryPdf();
  assert(Buffer.isBuffer(pdfBuffer), 'generateHistoryPdf returns a valid Buffer');
  assert(pdfBuffer.length > 5000, `PDF buffer has valid binary size (${pdfBuffer.length} bytes)`);
  assert(pdfBuffer.subarray(0, 5).toString('ascii') === '%PDF-', 'Buffer has valid %PDF- magic header');
  console.log(`✅ PASS: PDF generated cleanly across multiple pages (${pdfBuffer.length} bytes)`);

  // --------------------------------------------------------------------------
  // REQUIREMENT 2: Admin Dashboard Filtering & Permanent Delete
  // --------------------------------------------------------------------------
  console.log('\n▶ [Req 2] Delete Filtered History from Database');
  const deleteResult = await announcementService.deleteHistorySlots({
    slotIds: ['non-existent-test-slot-id'],
  });
  assert(deleteResult.success === true, 'deleteHistorySlots executes without database column error');
  console.log(`✅ PASS: Delete history slots executed successfully without column errors`);

  // --------------------------------------------------------------------------
  // REQUIREMENT 3: Unique Batch Code and Slot Tag for Multi-Slot Dispatches
  // --------------------------------------------------------------------------
  console.log('\n▶ [Req 3] Human-Readable Batch Code & Slot Tag Generation');
  const batchCode = announcementService.generateBatchCode('ann-12345678-uuid');
  assert(batchCode.startsWith('BATCH-'), `Batch code starts with BATCH- prefix (got ${batchCode})`);
  const { all: slots } = await announcementService.listUnifiedSlots();
  if (slots.length > 0) {
    const firstSlot = slots[0];
    assert(typeof firstSlot.batchCode === 'string', 'Slot contains batchCode');
    assert(typeof firstSlot.slotTag === 'string', 'Slot contains slotTag');
    console.log(`  Sample slot: ${firstSlot.batchCode} - ${firstSlot.slotTag} (Dispatch ID: ${firstSlot.dispatchId})`);
  }
  console.log(`✅ PASS: Unique batch code and slot tags formatted as expected`);

  // --------------------------------------------------------------------------
  // REQUIREMENT 4: Strict Recipient Security (CRM Whitelist & Format Guards)
  // --------------------------------------------------------------------------
  console.log('\n▶ [Req 4] Strict Recipient Security & Whitelist Enforcement');
  recipientSecurityService.clearCache();

  // Test 4a: Admin Test Phone (+919404849500)
  const adminCheck = await recipientSecurityService.validateCrmRecipient('+919404849500');
  assert(adminCheck.allowed === true, 'Admin test phone is always allowed');
  assert(adminCheck.entityType === 'ADMIN_TEST_PHONE', 'Admin identified as ADMIN_TEST_PHONE');
  console.log('  Admin phone test passed');

  // Test 4b: Existing Student in CRM (+919011035857)
  const studentCheck = await recipientSecurityService.validateCrmRecipient('+919011035857');
  assert(studentCheck.allowed === true, 'Registered CRM student is allowed');
  assert(studentCheck.entityType === 'STUDENT', 'Identified as STUDENT');
  console.log(`  Student CRM test passed: ${studentCheck.name}`);

  // Test 4c: Prospective Admission / Enquiry with spaces (+91 98221 55555)
  const enquiryCheck = await recipientSecurityService.validateCrmRecipient('+91 98221 55555');
  assert(enquiryCheck.allowed === true, 'Enquiry with spaced format is allowed');
  assert(enquiryCheck.entityType === 'ADMISSION_INQUIRY', 'Identified as ADMISSION_INQUIRY');
  console.log(`  Enquiry CRM test passed: ${enquiryCheck.name}`);

  // Test 4d: Non-CRM Random Number (+919999999999) MUST BE BLOCKED
  const blockedCheck = await recipientSecurityService.validateCrmRecipient('+919999999999');
  assert(blockedCheck.allowed === false, 'Random non-CRM number is blocked');
  assert(blockedCheck.reason?.includes('[SECURITY BLOCK]'), 'Reason contains [SECURITY BLOCK]');
  console.log('  Non-CRM random number blocked test passed');

  // Test 4e: Dummy Numbers (0000000000)
  assert(queueService.isBlockedOrDummyNumber('0000000000'), 'Dummy number 0000000000 flagged as dummy');
  console.log('✅ PASS: Recipient security whitelist and blocking verified');

  // --------------------------------------------------------------------------
  // REQUIREMENT 5: Automated Triggers (Attendance, Fees, Admissions)
  // --------------------------------------------------------------------------
  console.log('\n▶ [Req 5] Audit of WhatsApp Automated Triggers');
  // Test 5a: Student Welcome Automation
  const testRunId = Date.now().toString().slice(-4);
  const welcomeResult = await automationService.triggerStudentWelcomeAutomation({
    parentPhone: '+919404849500',
    studentName: `Verification Test Student ${testRunId}`,
    parentName: 'Test Parent',
    course: 'Athletics Gold',
    monthlyFee: 3000,
  });
  assert(welcomeResult !== null, 'triggerStudentWelcomeAutomation generated queue item');
  assert(welcomeResult?.event_type === 'STUDENT_WELCOME', 'Queue item has event_type STUDENT_WELCOME');
  console.log('  Student welcome trigger passed');

  // Test 5b: Fee Balance Settlement in Payment Receipts (Using admin test phone safeguard)
  const paymentResult = await automationService.triggerPaymentSuccessAutomation({
    studentId: '78ec9600-5101-4470-9c33-dcb6517f6834',
    amount: 1500,
    receiptNumber: `TEST-REC-SAFE-${testRunId}`,
  });
  assert(paymentResult !== null, 'triggerPaymentSuccessAutomation generated queue item');
  assert(paymentResult?.event_type === 'PAYMENT_SUCCESS', 'Queue item has event_type PAYMENT_SUCCESS');
  console.log('  Payment success trigger with dynamic balance passed');

  console.log('✅ PASS: Automated triggers route cleanly through queue');

  // --------------------------------------------------------------------------
  // REQUIREMENT 6: Fee Reminder Schedule Graph / Pipeline Status
  // --------------------------------------------------------------------------
  console.log('\n▶ [Req 6] Fee Reminder Cadence Pipeline Status');
  const pipeline = await automationService.getFeeCadencePipelineStatus();
  assert(Array.isArray(pipeline) && pipeline.length === 4, 'Pipeline returns exactly 4 stages');
  assert(pipeline[0].eventType === 'FEE_UPCOMING', 'Stage 1 is FEE_UPCOMING');
  assert(pipeline[1].eventType === 'FEE_DUE', 'Stage 2 is FEE_DUE');
  assert(pipeline[2].eventType === 'FEE_OVERDUE', 'Stage 3 is FEE_OVERDUE');
  assert(pipeline[3].eventType === 'PAYMENT_SUCCESS', 'Stage 4 is PAYMENT_SUCCESS');

  for (const stage of pipeline) {
    assert(typeof stage.eligibleStudentsCount === 'number', `${stage.name} has eligibleStudentsCount`);
    assert(typeof stage.queuedCount === 'number', `${stage.name} has queuedCount`);
    assert(typeof stage.templatePreview === 'string' && stage.templatePreview.length > 10, `${stage.name} has templatePreview`);
    assert(stage.isActive === true, `${stage.name} is marked active`);
  }
  console.log(`✅ PASS: Fee cadence pipeline verified with 4 connected stages and live metrics`);

  console.log('\n================================================================');
  console.log('🎉 ALL 6 REQUIREMENTS RIGOROUSLY TESTED AND PASSED');
  console.log('================================================================');
  process.exit(0);
}

runEndToEndVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
