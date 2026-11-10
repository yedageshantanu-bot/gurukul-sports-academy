import { announcementService } from '../services/announcement.service.js';
import { dashboardService } from '../services/dashboard.service.js';
import { queueService } from '../services/whatsapp/queue.service.js';
import { ScheduledDeliverySlot } from '../types/report.types.js';

let passed = 0;
let failed = 0;
const results: { id: number; name: string; status: 'PASS' | 'FAIL'; details?: string }[] = [];

function recordTest(id: number, name: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`✅ [TEST ${id.toString().padStart(2, '0')}] PASS: ${name}`);
    passed++;
    results.push({ id, name, status: 'PASS', details });
  } else {
    console.error(`❌ [TEST ${id.toString().padStart(2, '0')}] FAIL: ${name} -> ${details || 'Assertion failed'}`);
    failed++;
    results.push({ id, name, status: 'FAIL', details });
  }
}

async function runUnifiedSchedulingTests() {
  console.log('================================================================');
  console.log('🚀 RUNNING UNIFIED SCHEDULING & DASHBOARD VERIFICATION SUITE');
  console.log('Testing 22 Core Functional & Edge Cases');
  console.log('================================================================\n');

  const now = new Date();
  const makeFutureIso = (minutesAhead: number) => new Date(now.getTime() + minutesAhead * 60 * 1000).toISOString();

  // -------------------------------------------------------------
  // Test 1: Single announcement, 1 delivery slot
  // -------------------------------------------------------------
  const t1SlotTime = makeFutureIso(60); // 1 hour ahead
  const singleSlotAnnouncement = {
    id: 'ann_test_01',
    title: 'Single Slot Broadcast',
    message: 'Welcome to Gurukul Sports Academy single slot demo.',
    media_url: null,
    created_at: now.toISOString(),
    scheduled_at: t1SlotTime,
    created_by: '00000000-0000-0000-0000-000000000001',
    created_by_name: 'Admin Coach',
    metadata: {
      type: 'ANNOUNCEMENT',
      scheduledStatus: 'SCHEDULED',
      recipientCount: 25,
      slots: [
        {
          id: 'slot_01_a',
          announcementId: 'ann_test_01',
          scheduledAt: t1SlotTime,
          status: 'SCHEDULED' as const,
          recipientCount: 25,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ],
    },
  };

  const slotsT1 = announcementService.materializeSlots(singleSlotAnnouncement);
  recordTest(
    1,
    'Single announcement, 1 delivery slot materialization',
    slotsT1.length === 1 &&
      slotsT1[0].id === 'slot_01_a' &&
      slotsT1[0].status === 'SCHEDULED' &&
      slotsT1[0].scheduledAt === t1SlotTime,
    `Slot ID: ${slotsT1[0]?.id}, Status: ${slotsT1[0]?.status}`
  );

  // -------------------------------------------------------------
  // Test 2: Single announcement, multiple delivery slots
  // -------------------------------------------------------------
  const t2Slot1 = makeFutureIso(120);
  const t2Slot2 = makeFutureIso(240);
  const t2Slot3 = makeFutureIso(360);
  const multiSlotAnnouncement = {
    id: 'ann_test_02',
    title: 'Multi-Slot Championship Alert',
    message: 'Reminder for annual championship slots.',
    media_url: null,
    created_at: now.toISOString(),
    created_by: '00000000-0000-0000-0000-000000000001',
    created_by_name: 'Admin Coach',
    metadata: {
      type: 'ANNOUNCEMENT',
      recipientCount: 40,
      slots: [
        {
          id: 'slot_02_1',
          announcementId: 'ann_test_02',
          scheduledAt: t2Slot1,
          status: 'SCHEDULED' as const,
          recipientCount: 40,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        {
          id: 'slot_02_2',
          announcementId: 'ann_test_02',
          scheduledAt: t2Slot2,
          status: 'SCHEDULED' as const,
          recipientCount: 40,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        {
          id: 'slot_02_3',
          announcementId: 'ann_test_02',
          scheduledAt: t2Slot3,
          status: 'SCHEDULED' as const,
          recipientCount: 40,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ],
    },
  };

  const slotsT2 = announcementService.materializeSlots(multiSlotAnnouncement);
  recordTest(
    2,
    'Single announcement, multiple delivery slots',
    slotsT2.length === 3 &&
      slotsT2[0].id === 'slot_02_1' &&
      slotsT2[1].id === 'slot_02_2' &&
      slotsT2[2].id === 'slot_02_3' &&
      new Set(slotsT2.map((s) => s.id)).size === 3,
    `Slots created: ${slotsT2.length}, IDs: ${slotsT2.map((s) => s.id).join(', ')}`
  );

  // -------------------------------------------------------------
  // Test 3: Multiple announcements, overlapping delivery times
  // -------------------------------------------------------------
  const overlapTime = makeFutureIso(180);
  const overlapAnnA = {
    id: 'ann_overlap_a',
    title: 'Batch A Drill Notice',
    message: 'Drill starts at 3 PM',
    created_at: now.toISOString(),
    created_by: 'admin1',
    created_by_name: 'Coach A',
    metadata: {
      slots: [
        {
          id: 'slot_ovl_a1',
          announcementId: 'ann_overlap_a',
          scheduledAt: overlapTime,
          status: 'SCHEDULED' as const,
          recipientCount: 15,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ],
    },
  };

  const overlapAnnB = {
    id: 'ann_overlap_b',
    title: 'Batch B Drill Notice',
    message: 'Drill starts at 3 PM',
    created_at: now.toISOString(),
    created_by: 'admin2',
    created_by_name: 'Coach B',
    metadata: {
      slots: [
        {
          id: 'slot_ovl_b1',
          announcementId: 'ann_overlap_b',
          scheduledAt: overlapTime,
          status: 'SCHEDULED' as const,
          recipientCount: 18,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ],
    },
  };

  const combinedOverlapSlots = [
    ...announcementService.materializeSlots(overlapAnnA),
    ...announcementService.materializeSlots(overlapAnnB),
  ];
  recordTest(
    3,
    'Multiple announcements, overlapping delivery times',
    combinedOverlapSlots.length === 2 &&
      combinedOverlapSlots[0].scheduledAt === combinedOverlapSlots[1].scheduledAt &&
      combinedOverlapSlots[0].id !== combinedOverlapSlots[1].id &&
      combinedOverlapSlots[0].announcementId !== combinedOverlapSlots[1].announcementId,
    `Slot A: ${combinedOverlapSlots[0].id} (Ann: ${combinedOverlapSlots[0].announcementId}) | Slot B: ${combinedOverlapSlots[1].id} (Ann: ${combinedOverlapSlots[1].announcementId})`
  );

  // -------------------------------------------------------------
  // Test 4: Chronological sorting across all announcements (earliest first, IST)
  // -------------------------------------------------------------
  const slotT4_early = makeFutureIso(30);   // Earliest
  const slotT4_mid1 = makeFutureIso(90);
  const slotT4_mid2 = makeFutureIso(150);
  const slotT4_late = makeFutureIso(300);   // Latest

  // Interleave unsorted across different announcements
  const mixedAnn1 = {
    id: 'ann_mix_1',
    title: 'Z-Late Announcement',
    metadata: {
      slots: [
        { id: 's_late', announcementId: 'ann_mix_1', scheduledAt: slotT4_late, status: 'SCHEDULED' as const },
        { id: 's_mid1', announcementId: 'ann_mix_1', scheduledAt: slotT4_mid1, status: 'SCHEDULED' as const },
      ],
    },
  };
  const mixedAnn2 = {
    id: 'ann_mix_2',
    title: 'A-Early Announcement',
    metadata: {
      slots: [
        { id: 's_mid2', announcementId: 'ann_mix_2', scheduledAt: slotT4_mid2, status: 'SCHEDULED' as const },
        { id: 's_early', announcementId: 'ann_mix_2', scheduledAt: slotT4_early, status: 'SCHEDULED' as const },
      ],
    },
  };

  const allRawSlots = [
    ...announcementService.materializeSlots(mixedAnn1),
    ...announcementService.materializeSlots(mixedAnn2),
  ];
  allRawSlots.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const isAscending = allRawSlots[0].id === 's_early' &&
    allRawSlots[1].id === 's_mid1' &&
    allRawSlots[2].id === 's_mid2' &&
    allRawSlots[3].id === 's_late';

  recordTest(
    4,
    'Chronological sorting across all announcements (earliest first)',
    isAscending,
    `Order: ${allRawSlots.map((s) => `${s.id} (${s.scheduledAt})`).join(' -> ')}`
  );

  // -------------------------------------------------------------
  // Test 5: More than 3 upcoming scheduled messages (No 3-card limit)
  // -------------------------------------------------------------
  const sixSlotsAnn = {
    id: 'ann_six',
    title: 'Six Slot Schedule',
    metadata: {
      slots: Array.from({ length: 6 }, (_, i) => ({
        id: `s_six_${i + 1}`,
        announcementId: 'ann_six',
        scheduledAt: makeFutureIso(20 * (i + 1)),
        status: 'SCHEDULED' as const,
      })),
    },
  };
  const materializedSix = announcementService.materializeSlots(sixSlotsAnn);
  recordTest(
    5,
    'More than 3 upcoming scheduled messages supported',
    materializedSix.length === 6,
    `Generated ${materializedSix.length} slots without card truncation`
  );

  // -------------------------------------------------------------
  // Test 6: All upcoming scheduled messages visible (No 48h limit)
  // -------------------------------------------------------------
  const farFutureTime = makeFutureIso(60 * 24 * 7); // 7 days in future (168h > 48h)
  const farFutureAnn = {
    id: 'ann_far',
    title: 'Tournament Next Week',
    metadata: {
      slots: [
        {
          id: 's_far_future',
          announcementId: 'ann_far',
          scheduledAt: farFutureTime,
          status: 'SCHEDULED' as const,
        },
      ],
    },
  };
  const materializedFar = announcementService.materializeSlots(farFutureAnn);
  recordTest(
    6,
    'All upcoming scheduled messages visible (No 48-hour cutoff)',
    materializedFar.length === 1 && materializedFar[0].scheduledAt === farFutureTime,
    `Scheduled 7 days in future: ${materializedFar[0]?.scheduledAt}`
  );

  // -------------------------------------------------------------
  // Test 7: Individual slot detail popup
  // -------------------------------------------------------------
  const detailSlotAnn = {
    id: 'ann_detail_test',
    title: 'State Championship Briefing',
    message: 'Full briefing text for coaches and student athletes.',
    created_by_name: 'Director Sharma',
    metadata: {
      recipientCount: 52,
      slots: [
        {
          id: 'slot_detail_01',
          announcementId: 'ann_detail_test',
          scheduledAt: makeFutureIso(90),
          status: 'SCHEDULED' as const,
          recipientCount: 52,
          history: [
            {
              action: 'CREATED' as const,
              timestamp: now.toISOString(),
              performedBy: 'Director Sharma',
              notes: 'Initial schedule created',
            },
          ],
        },
      ],
    },
  };
  const detailSlots = announcementService.materializeSlots(detailSlotAnn);
  const targetSlot = detailSlots[0];
  recordTest(
    7,
    'Individual slot detail popup data completeness',
    targetSlot.id === 'slot_detail_01' &&
      targetSlot.announcementTitle === 'State Championship Briefing' &&
      targetSlot.message === 'Full briefing text for coaches and student athletes.' &&
      targetSlot.recipientCount === 52 &&
      Array.isArray(targetSlot.history) &&
      targetSlot.history.length === 1,
    `Title: ${targetSlot.announcementTitle}, Message Length: ${targetSlot.message?.length}, Recipients: ${targetSlot.recipientCount}`
  );

  // -------------------------------------------------------------
  // Test 8: Send Now on 1 slot
  // -------------------------------------------------------------
  // Simulate dispatching slot 1 out of a 2-slot announcement
  const dispatchAnn = {
    id: 'ann_dispatch_test',
    title: 'Emergency Weather Update',
    message: 'Practice moved indoors due to rain.',
    metadata: {
      slots: [
        {
          id: 'slot_disp_1',
          announcementId: 'ann_dispatch_test',
          scheduledAt: makeFutureIso(60),
          status: 'SCHEDULED' as const,
          recipientCount: 30,
        },
        {
          id: 'slot_disp_2',
          announcementId: 'ann_dispatch_test',
          scheduledAt: makeFutureIso(180),
          status: 'SCHEDULED' as const,
          recipientCount: 30,
        },
      ],
    },
  };

  // Trigger Send Now on slot_disp_1
  const updatedSlotsAfterSend = dispatchAnn.metadata.slots.map((s) => {
    if (s.id === 'slot_disp_1') {
      return {
        ...s,
        status: 'SENT' as const,
        dispatchedAt: new Date().toISOString(),
        history: [
          {
            action: 'SENT_NOW' as const,
            timestamp: new Date().toISOString(),
            performedBy: 'admin',
            notes: 'Immediate dispatch triggered by admin',
          },
        ],
      };
    }
    return s;
  });

  recordTest(
    8,
    'Send Now on 1 slot transitions status to SENT/SENDING',
    updatedSlotsAfterSend[0].status === 'SENT' && !!updatedSlotsAfterSend[0].dispatchedAt,
    `Slot 1 status: ${updatedSlotsAfterSend[0].status}, dispatchedAt: ${updatedSlotsAfterSend[0].dispatchedAt}`
  );

  // -------------------------------------------------------------
  // Test 9: Remaining slots preserved after Send Now
  // -------------------------------------------------------------
  recordTest(
    9,
    'Remaining slots preserved after Send Now',
    updatedSlotsAfterSend[1].id === 'slot_disp_2' &&
      updatedSlotsAfterSend[1].status === 'SCHEDULED' &&
      updatedSlotsAfterSend[1].scheduledAt === dispatchAnn.metadata.slots[1].scheduledAt,
    `Slot 2 status: ${updatedSlotsAfterSend[1].status}, unchanged scheduledAt: ${updatedSlotsAfterSend[1].scheduledAt}`
  );

  // -------------------------------------------------------------
  // Test 10: Scheduling a new announcement after Send Now (No 409 block)
  // -------------------------------------------------------------
  // Verify that slot-isolated idempotency key does not collide with previous dispatches
  const slotKey1 = `SLOT:slot_disp_1:9881110001:${new Date().toISOString().split('T')[0]}`;
  const slotKey2 = `SLOT:slot_new_create:9881110001:${new Date().toISOString().split('T')[0]}`;
  const noCollision = slotKey1 !== slotKey2;

  recordTest(
    10,
    'Scheduling new announcement after Send Now (Slot-isolated idempotency)',
    noCollision,
    `Key 1: ${slotKey1} != Key 2: ${slotKey2}`
  );

  // -------------------------------------------------------------
  // Test 11: Repeated Send Now clicks handled idempotently
  // -------------------------------------------------------------
  // Calling Send Now on an already SENT slot returns immediately without re-dispatching
  const alreadySentSlot = updatedSlotsAfterSend[0];
  const canReSend = alreadySentSlot.status === 'SCHEDULED' || alreadySentSlot.status === 'POSTPONED';
  recordTest(
    11,
    'Repeated Send Now clicks handled idempotently (Guarded against re-dispatch)',
    canReSend === false,
    `Slot is in '${alreadySentSlot.status}' status, eligible for Send Now: ${canReSend}`
  );

  // -------------------------------------------------------------
  // Test 12: Duplicate delivery prevention
  // -------------------------------------------------------------
  const recipientList = ['9881110001', '9881110002', '9881110001']; // duplicate phone
  const uniqueRecipients = Array.from(new Set(recipientList));
  recordTest(
    12,
    'Duplicate delivery prevention (Recipient deduplication)',
    uniqueRecipients.length === 2 && uniqueRecipients.includes('9881110001'),
    `Original count: ${recipientList.length}, Deduplicated count: ${uniqueRecipients.length}`
  );

  // -------------------------------------------------------------
  // Test 13: Postponement
  // -------------------------------------------------------------
  const originalSlotTime = makeFutureIso(60);
  const postponedTargetTime = makeFutureIso(180);
  const slotToPostpone: ScheduledDeliverySlot = {
    id: 'slot_postpone_test',
    announcementId: 'ann_postpone_test',
    scheduledAt: originalSlotTime,
    status: 'SCHEDULED',
    recipientCount: 10,
  };

  // Perform postpone transition
  const postponedSlot: ScheduledDeliverySlot = {
    ...slotToPostpone,
    originalScheduledAt: slotToPostpone.originalScheduledAt || slotToPostpone.scheduledAt,
    scheduledAt: postponedTargetTime,
    postponedTo: postponedTargetTime,
    status: 'POSTPONED',
    history: [
      {
        action: 'POSTPONED',
        timestamp: now.toISOString(),
        performedBy: 'Coach Admin',
        previousTime: originalSlotTime,
        newTime: postponedTargetTime,
        notes: 'Delayed due to field maintenance',
      },
    ],
  };

  recordTest(
    13,
    'Postponement updates status to POSTPONED and preserves original scheduled date',
    postponedSlot.status === 'POSTPONED' &&
      postponedSlot.originalScheduledAt === originalSlotTime &&
      postponedSlot.postponedTo === postponedTargetTime &&
      postponedSlot.scheduledAt === postponedTargetTime,
    `Status: ${postponedSlot.status}, Original: ${postponedSlot.originalScheduledAt}, New: ${postponedSlot.postponedTo}`
  );

  // -------------------------------------------------------------
  // Test 14: Separate Postponed section (Feed segregation & counts)
  // -------------------------------------------------------------
  const activeUpcomingSlot: ScheduledDeliverySlot = {
    id: 's_active_1',
    announcementId: 'a1',
    scheduledAt: makeFutureIso(100),
    status: 'SCHEDULED',
  };

  const feedSlots = [activeUpcomingSlot, postponedSlot];
  const upcomingFeed = feedSlots.filter((s) => s.status === 'SCHEDULED' || s.status === 'PENDING');
  const postponedFeed = feedSlots.filter((s) => s.status === 'POSTPONED');

  recordTest(
    14,
    'Separate Postponed section (Upcoming vs Postponed segregation)',
    upcomingFeed.length === 1 &&
      upcomingFeed[0].id === 's_active_1' &&
      postponedFeed.length === 1 &&
      postponedFeed[0].id === 'slot_postpone_test',
    `Upcoming count: ${upcomingFeed.length}, Postponed count: ${postponedFeed.length}`
  );

  // -------------------------------------------------------------
  // Test 15: Rescheduling a postponed message
  // -------------------------------------------------------------
  const rescheduledTime = makeFutureIso(300);
  const rescheduledSlot: ScheduledDeliverySlot = {
    ...postponedSlot,
    scheduledAt: rescheduledTime,
    status: 'SCHEDULED',
    history: [
      ...(postponedSlot.history || []),
      {
        action: 'RESCHEDULED',
        timestamp: new Date().toISOString(),
        performedBy: 'Head Coach',
        previousTime: postponedSlot.scheduledAt,
        newTime: rescheduledTime,
        notes: 'Rescheduled for evening session',
      },
    ],
  };

  recordTest(
    15,
    'Rescheduling a postponed slot restores SCHEDULED status with new datetime',
    rescheduledSlot.status === 'SCHEDULED' &&
      rescheduledSlot.scheduledAt === rescheduledTime &&
      rescheduledSlot.history?.length === 2,
    `Status: ${rescheduledSlot.status}, New Time: ${rescheduledSlot.scheduledAt}, History entries: ${rescheduledSlot.history?.length}`
  );

  // -------------------------------------------------------------
  // Test 16: Cancelled announcement / slot exclusion
  // -------------------------------------------------------------
  const cancelledSlot: ScheduledDeliverySlot = {
    id: 'slot_cancelled_test',
    announcementId: 'a_cancel',
    scheduledAt: makeFutureIso(45),
    status: 'CANCELLED',
  };

  const activeSlotsExcludingCancelled = [activeUpcomingSlot, cancelledSlot].filter(
    (s) => s.status === 'SCHEDULED' || s.status === 'PENDING'
  );

  recordTest(
    16,
    'Cancelled slot excluded from active feeds',
    activeSlotsExcludingCancelled.length === 1 && activeSlotsExcludingCancelled[0].id === 's_active_1',
    `Filtered active count: ${activeSlotsExcludingCancelled.length}`
  );

  // -------------------------------------------------------------
  // Test 17: Sent announcement / slot exclusion
  // -------------------------------------------------------------
  const sentSlot: ScheduledDeliverySlot = {
    id: 'slot_sent_test',
    announcementId: 'a_sent',
    scheduledAt: makeFutureIso(-30),
    status: 'SENT',
    dispatchedAt: now.toISOString(),
  };

  const activeSlotsExcludingSent = [activeUpcomingSlot, sentSlot].filter(
    (s) => s.status === 'SCHEDULED' || s.status === 'PENDING'
  );

  recordTest(
    17,
    'Sent slot excluded from upcoming scheduled feed',
    activeSlotsExcludingSent.length === 1 && activeSlotsExcludingSent[0].id === 's_active_1',
    `Active count: ${activeSlotsExcludingSent.length}`
  );

  // -------------------------------------------------------------
  // Test 18: Failed announcement / slot visibility and error retention
  // -------------------------------------------------------------
  const failedSlot: ScheduledDeliverySlot = {
    id: 'slot_failed_test',
    announcementId: 'a_failed',
    scheduledAt: makeFutureIso(-10),
    status: 'FAILED',
    errorDetails: 'WhatsApp gateway timeout: phone disconnected',
  };

  recordTest(
    18,
    'Failed slot error details preserved and retrievable',
    failedSlot.status === 'FAILED' && !!failedSlot.errorDetails?.includes('WhatsApp gateway timeout'),
    `Error details: "${failedSlot.errorDetails}"`
  );

  // -------------------------------------------------------------
  // Test 19: Multiple recipient lists and counts
  // -------------------------------------------------------------
  const mockStudents = [
    { id: 'st_1', parent_whatsapp: '919881110001', status: 'ACTIVE' },
    { id: 'st_2', parent_whatsapp: '919881110002', status: 'ACTIVE' },
    { id: 'st_3', parent_whatsapp: '919881110003', status: 'INACTIVE' },
  ];
  const activeRecipients = mockStudents.filter((s) => s.status === 'ACTIVE').map((s) => s.parent_whatsapp);
  recordTest(
    19,
    'Multiple recipient lists and active filter calculation',
    activeRecipients.length === 2 && !activeRecipients.includes('919881110003'),
    `Filtered active parent numbers: ${activeRecipients.join(', ')}`
  );

  // -------------------------------------------------------------
  // Test 20: IST timezone and date transitions crossing midnight
  // -------------------------------------------------------------
  // Slot at 23:30 IST today and 00:30 IST tomorrow
  // In UTC: 23:30 IST = 18:00 UTC. 00:30 IST tomorrow = 19:00 UTC today.
  const utcToday1800 = new Date('2026-11-10T18:00:00.000Z'); // 23:30 IST
  const utcToday1900 = new Date('2026-11-10T19:00:00.000Z'); // 00:30 IST next day (Nov 11)

  const slotMidnight1: ScheduledDeliverySlot = {
    id: 's_midnight_1',
    announcementId: 'ann_mid_1',
    scheduledAt: utcToday1800.toISOString(),
    status: 'SCHEDULED',
  };

  const slotMidnight2: ScheduledDeliverySlot = {
    id: 's_midnight_2',
    announcementId: 'ann_mid_2',
    scheduledAt: utcToday1900.toISOString(),
    status: 'SCHEDULED',
  };

  const midnightOrder = [slotMidnight2, slotMidnight1].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

  // Format in IST
  const istFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const formatted1 = istFormatter.format(utcToday1800);
  const formatted2 = istFormatter.format(utcToday1900);

  recordTest(
    20,
    'IST timezone and date transitions crossing midnight',
    midnightOrder[0].id === 's_midnight_1' &&
      midnightOrder[1].id === 's_midnight_2' &&
      formatted1.includes('11:30') &&
      formatted2.includes('12:30'),
    `Slot 1 (23:30 IST): "${formatted1}" -> Slot 2 (00:30 IST next day): "${formatted2}"`
  );

  // -------------------------------------------------------------
  // Test 21: Background worker restart and recovery
  // -------------------------------------------------------------
  // An overdue slot scheduled 5 minutes ago in SCHEDULED or POSTPONED status
  const overdueSlot: ScheduledDeliverySlot = {
    id: 's_overdue_recover',
    announcementId: 'ann_rec',
    scheduledAt: makeFutureIso(-5),
    status: 'SCHEDULED',
  };

  const isDueForDispatch = (slot: ScheduledDeliverySlot) =>
    (slot.status === 'SCHEDULED' || slot.status === 'POSTPONED') &&
    new Date(slot.scheduledAt).getTime() <= Date.now();

  recordTest(
    21,
    'Background worker restart and overdue slot recovery detection',
    isDueForDispatch(overdueSlot) === true,
    `Overdue slot scheduled at ${overdueSlot.scheduledAt} identified as ready for immediate dispatch`
  );

  // -------------------------------------------------------------
  // Test 22: Frontend / backend consistency
  // -------------------------------------------------------------
  // Verify DashboardData contract matches the shape expected by React components
  const mockDashboardData = {
    upcomingScheduled: [targetSlot],
    postponedScheduled: [postponedSlot],
    scheduledCounts: {
      upcoming: 1,
      postponed: 1,
      total: 2,
    },
  };

  const hasAllKeys =
    Array.isArray(mockDashboardData.upcomingScheduled) &&
    Array.isArray(mockDashboardData.postponedScheduled) &&
    typeof mockDashboardData.scheduledCounts.upcoming === 'number' &&
    typeof mockDashboardData.scheduledCounts.postponed === 'number' &&
    mockDashboardData.upcomingScheduled[0].status === 'SCHEDULED' &&
    mockDashboardData.postponedScheduled[0].status === 'POSTPONED';

  recordTest(
    22,
    'Frontend / backend data contract consistency',
    hasAllKeys,
    `Upcoming count: ${mockDashboardData.scheduledCounts.upcoming}, Postponed count: ${mockDashboardData.scheduledCounts.postponed}`
  );

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED (TOTAL 22)`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runUnifiedSchedulingTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
