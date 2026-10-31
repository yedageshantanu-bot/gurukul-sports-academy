import { supabaseAdmin } from '../config/supabase.js';
import { RankService } from '../services/rank.service.js';
import { StudentService } from '../services/student.service.js';
import { announcementService } from '../services/announcement.service.js';
import { automationService } from '../services/whatsapp/automation.service.js';
import { bulkAttendanceSchema } from '../types/attendance.types.js';

async function verifyAll() {
  console.log('=== STARTING DEEP SPRINT VERIFICATION ===\n');
  let passed = 0;
  let failed = 0;

  // TEST 1: Chetan Pawar Record & Null-safe update
  try {
    console.log('[TEST 1] Verifying Chetan Pawar DB record & updateStudent null safety...');
    const chetanId = '100c2eb9-efa1-4681-a1de-97295e5799e6';
    const { data: chetan, error: cErr } = await supabaseAdmin!
      .from('students')
      .select('*')
      .eq('id', chetanId)
      .single();

    if (cErr || !chetan) throw new Error(`Chetan not found: ${cErr?.message}`);
    console.log(`  Current Chetan record: Name="${chetan.name}", monthly_fee=${chetan.monthly_fee}, student_mobile=${chetan.student_mobile}`);

    if (chetan.name !== 'CHETAN PAWAR') throw new Error(`Expected name CHETAN PAWAR, got "${chetan.name}"`);
    if (Number(chetan.monthly_fee) !== 1200) throw new Error(`Expected fee 1200, got "${chetan.monthly_fee}"`);

    // Test updateStudent with null studentMobile
    const updated = await StudentService.updateStudent(chetanId, {
      name: 'CHETAN PAWAR',
      monthlyFee: 1200,
      studentMobile: null,
      parentWhatsapp: chetan.parent_whatsapp,
    });
    console.log(`  Updated student via StudentService: Name="${updated.name}", Fee=${updated.monthlyFee}`);
    console.log('  -> TEST 1 PASSED');
    passed++;
  } catch (err: any) {
    console.error('  -> TEST 1 FAILED:', err.message);
    failed++;
  }

  // TEST 2: Registration number sequential format (KL-N, KAR-N, NO GSA)
  try {
    console.log('\n[TEST 2] Verifying sequential discipline registration numbers (KL-N, KAR-N)...');
    const { data: ranks, error: rErr } = await supabaseAdmin!
      .from('student_ranks')
      .select('id, reg_number, discipline_code')
      .order('reg_number', { ascending: true });

    if (rErr) throw new Error(`Query failed: ${rErr.message}`);

    const gsaRanks = ranks?.filter((r) => r.reg_number?.startsWith('GSA-')) || [];
    if (gsaRanks.length > 0) {
      throw new Error(`Found ${gsaRanks.length} ranks still containing "GSA-": ${JSON.stringify(gsaRanks)}`);
    }

    const nextKalari = await RankService.getNextSequentialRegNumber('KALARIPPAYATTU');
    const nextKarate = await RankService.getNextSequentialRegNumber('KARATE_WUSHU');

    console.log(`  Total student_ranks in DB: ${ranks?.length}`);
    console.log(`  Next sequential Kalari reg_number: ${nextKalari}`);
    console.log(`  Next sequential Karate reg_number: ${nextKarate}`);

    if (!nextKalari.startsWith('KL-')) throw new Error(`Expected KL- prefix, got ${nextKalari}`);
    if (!nextKarate.startsWith('KAR-')) throw new Error(`Expected KAR- prefix, got ${nextKarate}`);

    console.log('  -> TEST 2 PASSED');
    passed++;
  } catch (err: any) {
    console.error('  -> TEST 2 FAILED:', err.message);
    failed++;
  }

  // TEST 3: Announcement persistence with teamCodes and includeSelf
  try {
    console.log('\n[TEST 3] Verifying Announcement creation with teamCodes and includeSelf...');
    const testTitle = `Sprint Verification Notice ${Date.now()}`;
    const ann = await announcementService.createAnnouncement({
      title: testTitle,
      message: 'Test message targeted to teams and self',
      batchIds: [],
      metadata: {
        teamCodes: ['JILAPRAMUKH', 'COACHES'],
        includeSelf: true,
      },
    } as any);

    console.log(`  Created announcement: ID=${ann.id}, title="${ann.title}"`);
    console.log(`  Persisted metadata:`, JSON.stringify(ann.metadata));

    if (!ann.metadata?.teamCodes?.includes('JILAPRAMUKH')) {
      throw new Error('Metadata did not persist teamCodes');
    }
    if (ann.metadata?.includeSelf !== true) {
      throw new Error('Metadata did not persist includeSelf: true');
    }

    // Cleanup test announcement
    await supabaseAdmin!.from('announcements').delete().eq('id', ann.id);
    console.log('  -> TEST 3 PASSED');
    passed++;
  } catch (err: any) {
    console.error('  -> TEST 3 FAILED:', err.message);
    failed++;
  }

  // TEST 4: Teacher WhatsApp auto-notifications disabled at root
  try {
    console.log('\n[TEST 4] Verifying Teacher WhatsApp auto-notifications are disabled...');
    const teacherWelcomeRes = await automationService.triggerTeacherWelcomeAutomation({
      fullName: 'Test Instructor',
      email: 'test@example.com',
      phone: '9999999999',
    });

    if (teacherWelcomeRes !== null) {
      throw new Error('Expected triggerTeacherWelcomeAutomation to return null (disabled)');
    }

    console.log('  Teacher welcome automation output:', teacherWelcomeRes);
    console.log('  -> TEST 4 PASSED');
    passed++;
  } catch (err: any) {
    console.error('  -> TEST 4 FAILED:', err.message);
    failed++;
  }

  // TEST 5: Admin Self recipient resolution fallback to Sensei Vikram (9881888061)
  try {
    console.log('\n[TEST 5] Verifying Self/Admin fallback in announcement service...');
    const testAnn = await announcementService.createAnnouncement({
      title: `Self Test ${Date.now()}`,
      message: 'Testing admin self recipient inclusion',
      batchIds: [],
      metadata: {
        includeSelf: true,
      },
    } as any);

    // Call sendAnnouncement with scheduledTime in future so it queues without immediate socket errors
    const futureTime = new Date(Date.now() + 3600000).toISOString();
    const sendResult = await announcementService.sendAnnouncement(testAnn.id, {
      scheduledTime: futureTime,
      includeSelf: true,
    });

    console.log(`  Dispatched totalRecipients: ${sendResult.totalRecipients}, sentCount: ${sendResult.sentCount}`);
    if (sendResult.totalRecipients !== 1 || sendResult.sentCount !== 1) {
      throw new Error(`Expected exactly 1 recipient dispatched for admin self, got: ${sendResult.totalRecipients}`);
    }

    if (sendResult.announcement.metadata?.includeSelf !== true) {
      throw new Error('Expected includeSelf: true in announcement metadata');
    }

    await supabaseAdmin!.from('announcements').delete().eq('id', testAnn.id);
    console.log('  -> TEST 5 PASSED');
    passed++;
  } catch (err: any) {
    console.error('  -> TEST 5 FAILED:', err.message);
    failed++;
  }

  // TEST 6: Attendance Bulk schema validation with customTemplate
  try {
    console.log('\n[TEST 6] Verifying Attendance Bulk DTO schema validation with customTemplate...');
    const validPayload = {
      batchId: '11111111-2222-3333-4444-555555555555',
      date: '2026-10-31',
      records: [
        { studentId: '22222222-3333-4444-5555-666666666666', status: 'PRESENT' as const },
        { studentId: '33333333-4444-5555-6666-777777777777', status: 'ABSENT' as const },
      ],
      sendWhatsApp: true,
      customTemplate: 'Custom alert: {student_name} was {status} on {date}.',
    };

    const parsed = bulkAttendanceSchema.safeParse(validPayload);
    if (!parsed.success) {
      throw new Error(`Schema rejected valid payload with customTemplate: ${parsed.error.message}`);
    }
    if (parsed.data.customTemplate !== validPayload.customTemplate) {
      throw new Error('customTemplate did not parse correctly');
    }

    console.log('  Validated bulkAttendanceSchema with customTemplate successfully.');
    console.log('  -> TEST 6 PASSED');
    passed++;
  } catch (err: any) {
    console.error('  -> TEST 6 FAILED:', err.message);
    failed++;
  }

  console.log(`\n=== VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

verifyAll()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Unhandled fatal error in verification:', e);
    process.exit(1);
  });
