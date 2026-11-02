import { supabaseAdmin } from '../config/supabase.js';
import { teamMessageController } from '../controllers/teamMessage.controller.js';
import { automationService } from '../services/whatsapp/automation.service.js';
import { templateService } from '../services/whatsapp/template.service.js';
import { queueService } from '../services/whatsapp/queue.service.js';
import { PdfReportService } from '../services/pdfReport.service.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string, detail?: any) {
  if (condition) {
    console.log(`✅ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${desc}`, detail || '');
    failed++;
  }
}

async function run() {
  console.log('🧪 Starting Sprint Verification Suite...\n');

  // ==========================================
  // TEST 1: UPI Stripping from Templates & Automation
  // ==========================================
  console.log('--- 1. UPI Stripping Verification ---');
  const rawBodyWithUpi = `Namaste {parent_name}! Fee for {student_name} is ₹{pending_amount}, due {due_date}.
📱 *Direct 1-Tap UPI (0% Fee)*: upi://pay?pa=gurukul@upi&pn=Gurukul&am=1500
Or pay to UPI ID: gurukul@icici
Please clear dues at counter.`;

  const rendered = automationService.renderTemplate(rawBodyWithUpi, {
    parent_name: 'Rajesh',
    student_name: 'Aarav',
    pending_amount: '1500',
    due_date: '10th November',
  });

  assert(!rendered.includes('upi://pay'), 'No upi://pay link in rendered message');
  assert(!rendered.includes('gurukul@upi'), 'No raw UPI ID in rendered message');
  assert(!rendered.includes('1-Tap UPI'), 'No 1-Tap UPI prompt in rendered message');
  assert(rendered.includes('Rajesh'), 'Parent name rendered');
  assert(rendered.includes('Aarav'), 'Student name rendered');
  assert(rendered.includes('1500'), 'Amount rendered');
  assert(rendered.includes('clear dues at counter'), 'Counter instruction preserved');

  // ==========================================
  // TEST 2: Active DB Fee Template Resolution
  // ==========================================
  console.log('\n--- 2. Active Fee Template DB Resolution ---');
  const tplDue = await templateService.getActiveTemplateForEvent('FEE_DUE');
  assert(!!tplDue, 'Active template resolved for FEE_DUE');
  assert(!tplDue?.body.includes('upi://pay'), 'FEE_DUE template does not contain UPI link');

  const tplOverdue = await templateService.getActiveTemplateForEvent('FEE_OVERDUE');
  assert(!!tplOverdue, 'Active template resolved for FEE_OVERDUE');
  assert(!tplOverdue?.body.includes('upi://pay'), 'FEE_OVERDUE template does not contain UPI link');

  // ==========================================
  // TEST 3: PDF Generation without UPI & without crashes
  // ==========================================
  console.log('\n--- 3. PDF Report Generation Verification ---');
  const testReportData = {
    studentName: 'Test Athlete',
    parentName: 'Parent Test',
    course: 'Karate Senior Dojo',
    batches: [], // Test empty batches safety
    attendance: {
      totalSessions: 20,
      presentCount: 18,
      absentCount: 2,
      attendanceRate: 90,
    },
    fees: {
      monthlyFee: 2000,
      feeDueDay: 5,
      currentMonthStatus: 'PENDING',
      pendingAmount: 2000,
      billingPeriod: '2026-11',
    },
    academyName: 'Gurukul Sports Academy',
    recipientPhone: '9404849500',
  };

  const pdfBuffer = await PdfReportService.generateStudentMonthlyReportPdf(testReportData);
  assert(pdfBuffer.length > 1000, 'PDF generated successfully with non-zero buffer');

  // ==========================================
  // TEST 4: Team Member Creation & Permanent Cascade Purge
  // ==========================================
  console.log('\n--- 4. Team Member Deletion & Cascade Purge ---');
  const testPhone = '9888877799';
  const teamCode1 = 'TEST_TEAM_ALPHA_' + Date.now();
  const teamCode2 = 'TEST_TEAM_BETA_' + Date.now();

  // Create two teams in Supabase
  const { data: team1 } = await supabaseAdmin!
    .from('teams')
    .insert({ name: 'Alpha Squad', code: teamCode1 })
    .select()
    .single();

  const { data: team2 } = await supabaseAdmin!
    .from('teams')
    .insert({ name: 'Beta Squad', code: teamCode2 })
    .select()
    .single();

  assert(!!team1 && !!team2, 'Test teams created in Supabase');

  // Enroll member in team1
  const { data: member1 } = await supabaseAdmin!
    .from('team_members')
    .insert({
      name: 'Rohan Deshmukh',
      phone: testPhone,
      team_code: teamCode1,
      status: 'ACTIVE',
    })
    .select()
    .single();

  // Enroll same member in team2
  const { data: member2 } = await supabaseAdmin!
    .from('team_members')
    .insert({
      name: 'Rohan Deshmukh',
      phone: testPhone,
      team_code: teamCode2,
      status: 'ACTIVE',
    })
    .select()
    .single();

  assert(!!member1 && !!member2, 'Member enrolled in both squads');

  // Test non-UUID ID deletion with phone parameter (simulating frontend synthetic ID)
  let mockResJson: any = null;
  const mockRes: any = {
    status: (code: number) => ({
      json: (data: any) => { mockResJson = data; },
    }),
  };

  await teamMessageController.deleteTeamMember(
    { params: { id: `c-${testPhone}` }, query: { allTeams: 'true', phone: testPhone } } as any,
    mockRes,
    ((err: any) => { if (err) throw err; }) as any
  );

  assert(mockResJson?.success === true, 'deleteTeamMember succeeded for non-UUID synthetic ID with phone param');

  // Verify member is wiped from ALL teams
  const { data: remainingMembers } = await supabaseAdmin!
    .from('team_members')
    .select('id')
    .eq('phone', testPhone);

  assert((remainingMembers?.length || 0) === 0, 'Member completely purged across all squads in database');

  // Clean up test teams
  await supabaseAdmin!.from('teams').delete().in('id', [team1!.id, team2!.id]);

  // ==========================================
  // TEST 5: Queue Idempotency & Retry Safety
  // ==========================================
  console.log('\n--- 5. Queue Idempotency & Failed Retry Safety ---');
  const dummyPhone = '+919404849500';
  const dummyBody = `Test retry message idempotency safety ${Date.now()}`;
  const queueItem1 = await queueService.enqueueMessage({
    recipientPhone: dummyPhone,
    messageBody: dummyBody,
    eventType: 'FEE_DUE',
  });

  assert(!!queueItem1.id, 'First queue item enqueued');

  // Process queue item so status transitions to FAILED
  await queueService.processItem(queueItem1);

  // Attempt to enqueue identical message again - should allow retry and succeed
  const queueItemRetry = await queueService.enqueueMessage({
    recipientPhone: dummyPhone,
    messageBody: dummyBody,
    eventType: 'FEE_DUE',
  });

  assert(!!queueItemRetry.id, 'Retry of failed message succeeded without 409 duplicate lock');

  // Clean up queue items
  await supabaseAdmin!.from('whatsapp_queue').delete().eq('id', queueItem1.id);

  // ==========================================
  // TEST 6: Parent Name & Greeting Sanitization
  // ==========================================
  console.log('\n--- 6. Parent Name & Greeting Sanitization ---');
  const { cleanParentName } = await import('../services/whatsapp/automation.service.js');

  assert(cleanParentName('.', 'Shantanu Yedage') === 'Shantanu Yedage Palak', 'Dot parent_name falls back to Student Palak');
  assert(cleanParentName('..', 'Shantanu Yedage') === 'Shantanu Yedage Palak', 'Double dot parent_name falls back to Student Palak');
  assert(cleanParentName('-', 'Shantanu Yedage') === 'Shantanu Yedage Palak', 'Dash parent_name falls back to Student Palak');
  assert(cleanParentName(null, 'Shantanu Yedage') === 'Shantanu Yedage Palak', 'Null parent_name falls back to Student Palak');
  assert(cleanParentName('Ramesh Yedage', 'Shantanu Yedage') === 'Ramesh Yedage', 'Valid parent_name preserved');
  assert(cleanParentName('. Ramesh Yedage .', 'Shantanu Yedage') === 'Ramesh Yedage', 'Punctuation trimmed from valid parent_name');

  // Verify renderTemplate never outputs "Namaste . ji !" or "Namaste .!"
  const renderedDotJi = automationService.renderTemplate(
    'Namaste {parent_name} ji ! 🙏 Fee dues for {student_name} is ₹{pending_amount}.',
    { parent_name: '.', student_name: 'Shantanu Yedage', pending_amount: '1500' }
  );
  assert(!renderedDotJi.includes('Namaste .'), 'renderTemplate does not contain "Namaste ."');
  assert(!renderedDotJi.includes('ji !'), 'renderTemplate removes space before exclamation in "ji !"');
  assert(renderedDotJi.includes('Namaste Shantanu Yedage Palak Ji! 🙏'), 'renderTemplate produces clean greeting');

  const renderedOnlyDot = automationService.renderTemplate(
    'Namaste {parent_name}! 🙏 Fee dues for {student_name} is ₹{pending_amount}.',
    { parent_name: '.', student_name: 'Shantanu Yedage', pending_amount: '1500' }
  );
  assert(!renderedOnlyDot.includes('Namaste .!'), 'renderTemplate does not contain "Namaste .!"');

  // Verify whitespace and gaps
  const renderedWithGaps = automationService.renderTemplate(
    'Namaste {parent_name}! 🙏\n\n\n\nFee dues for {student_name} is ₹{pending_amount}.\n   \n- Gurukul',
    { parent_name: 'Ramesh', student_name: 'Shantanu', pending_amount: '1500' }
  );
  assert(!renderedWithGaps.includes('\n\n\n'), 'Awkward gaps condensed to at most double newlines');

  // ==========================================
  // TEST 7: Background Automated Fee Cadence Paused
  // ==========================================
  console.log('\n--- 7. Automated Fee Cadence Pause Verification ---');
  const cadenceAutoResult = await automationService.triggerMultiStageFeeCadenceAutomation();
  assert(cadenceAutoResult.queuedCount === 0, 'Background cadence without forceAllUnpaid queued 0 messages');
  assert(cadenceAutoResult.message?.includes('paused'), 'Background cadence returns paused notice');

  // ==========================================
  // TEST 8: WhatsApp Stats & Cost Tracker Verification
  // ==========================================
  console.log('\n--- 8. WhatsApp Stats & Rate Calculation ---');
  const stats = await queueService.getTodayStats();
  assert(typeof stats.sent === 'number', 'sent count is a valid number');
  assert(typeof stats.totalSent === 'number', 'totalSent count is a valid number');
  assert(typeof stats.monthSent === 'number', 'monthSent count is a valid number');
  assert(stats.ratePerMessage === 0.17, 'ratePerMessage is strictly 0.17');
  assert(stats.monthBilled === Number((stats.monthSent * 0.17).toFixed(2)), 'monthBilled correctly calculated as monthSent * 0.17');
  assert(!!stats.billingPeriod, 'billingPeriod is populated');

  // ==========================================
  // TEST 9: Trigger Fee Reminder Without studentFeeId (studentId only)
  // ==========================================
  console.log('\n--- 9. Fee Reminder Trigger With studentId Fallback ---');
  const { triggerFeeReminderSchema } = await import('../types/whatsapp.types.js');
  const parsedSchema = triggerFeeReminderSchema.parse({
    studentId: '6c524a15-1fd2-4e47-b662-4e9bf815e1b4',
    studentFeeId: '',
  });
  assert(parsedSchema.studentId === '6c524a15-1fd2-4e47-b662-4e9bf815e1b4', 'studentId preserved when studentFeeId is empty string');
  assert(parsedSchema.studentFeeId === undefined, 'Empty studentFeeId transformed to undefined');

  // Verify triggerFeeReminderAutomation works with studentId only
  const feeReminderResult = await automationService.triggerFeeReminderAutomation({
    studentId: '6c524a15-1fd2-4e47-b662-4e9bf815e1b4',
  });
  assert(!!feeReminderResult.id, 'Fee reminder queued/dispatched successfully using studentId alone');
  assert(feeReminderResult.recipient_phone.includes('9404849500'), 'Dispatched to correct student phone');

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log(`\n============================================================`);
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`============================================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
