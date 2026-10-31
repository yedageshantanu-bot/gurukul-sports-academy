import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/errorHandler.js';
import { CreateAnnouncementDTO } from '../types/report.types.js';
import { whatsappProviderFactory } from './whatsapp/whatsappProvider.factory.js';
import { queueService } from './whatsapp/queue.service.js';

export class AnnouncementService {
  private get supabase() {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }
    return supabaseAdmin;
  }

  // ============================================================================
  // 1. CREATE ANNOUNCEMENT (Admin Only)
  // ============================================================================
  async createAnnouncement(dto: CreateAnnouncementDTO, createdByUserId?: string) {
    const metadata = {
      ...(dto.metadata || {}),
      tournamentIds: (dto as any).tournamentIds || dto.metadata?.tournamentIds || [],
      teamCodes: (dto as any).teamCodes || dto.metadata?.teamCodes || [],
      teamIds: (dto as any).teamIds || dto.metadata?.teamIds || [],
      teamMemberIds: (dto as any).teamMemberIds || dto.metadata?.teamMemberIds || [],
      includeSelf: (dto as any).includeSelf ?? dto.metadata?.includeSelf ?? false,
    };

    // 1. Insert announcement header
    const { data: announcement, error: insertErr } = await this.supabase
      .from('announcements')
      .insert({
        title: dto.title,
        message: dto.message,
        created_by: createdByUserId ?? null,
        priority: 'NORMAL',
        scope: 'ALL',
        metadata,
      })
      .select()
      .single();

    if (insertErr || !announcement) {
      throw new AppError(`Failed to create announcement: ${insertErr?.message}`, 500);
    }

    // 2. Link target batches if provided
    const batchIds = dto.batchIds || [];
    if (batchIds.length > 0) {
      const batchLinks = batchIds.map((batchId) => ({
        announcement_id: announcement.id,
        batch_id: batchId,
      }));

      const { error: linkErr } = await this.supabase
        .from('announcement_batches')
        .insert(batchLinks);

      if (linkErr) {
        throw new AppError(`Failed to target announcement batches: ${linkErr.message}`, 500);
      }
    }

    return this.getAnnouncementById(announcement.id);
  }

  // ============================================================================
  // 2. LIST ANNOUNCEMENTS
  // ============================================================================
  async listAnnouncements(teacherId?: string) {
    let allowedBatchIds: string[] | null = null;

    if (teacherId) {
      const { data: assignments, error: assignErr } = await this.supabase
        .from('batch_teachers')
        .select('batch_id')
        .eq('teacher_id', teacherId);

      if (assignErr) {
        throw new AppError(`Failed to verify teacher assignments: ${assignErr.message}`, 500);
      }
      allowedBatchIds = (assignments || []).map((a) => a.batch_id);
    }

    const { data: announcements, error } = await this.supabase
      .from('announcements')
      .select(`
        id,
        title,
        message,
        priority,
        scope,
        metadata,
        created_at,
        updated_at,
        created_by,
        batches:announcement_batches(
          batch:batches(id, name, subject)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError(`Failed to list announcements: ${error.message}`, 500);
    }

    const list = (announcements || []).map((a: any) => {
      const meta = (a.metadata as any) || {};
      const isScheduled = meta.isScheduled === true && meta.scheduledStatus === 'SCHEDULED';
      let status: 'DRAFT' | 'SENT' | 'SCHEDULED' = 'DRAFT';
      if (isScheduled) {
        status = 'SCHEDULED';
      } else if (a.updated_at && a.created_at && a.updated_at !== a.created_at) {
        status = 'SENT';
      }
      return {
        ...a,
        status,
        sent_at: status === 'SENT' ? a.updated_at : null,
        scheduled_at: isScheduled ? meta.scheduledAt : null,
      };
    });

    // If teacher, only include announcements targeting at least one assigned batch
    if (allowedBatchIds !== null) {
      return list.filter((a) => {
        const targeted = (a.batches || []).map((b: any) => b.batch?.id);
        return targeted.some((bId: string) => allowedBatchIds!.includes(bId));
      });
    }

    return list;
  }

  // ============================================================================
  // 3. GET ANNOUNCEMENT BY ID
  // ============================================================================
  async getAnnouncementById(id: string, teacherId?: string) {
    const { data: announcement, error } = await this.supabase
      .from('announcements')
      .select(`
        id,
        title,
        message,
        priority,
        scope,
        metadata,
        created_at,
        updated_at,
        created_by,
        batches:announcement_batches(
          batch:batches(id, name, subject)
        )
      `)
      .eq('id', id)
      .single();

    if (error || !announcement) {
      throw new AppError('Announcement not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const meta = (announcement.metadata as any) || {};
    const isScheduled = meta.isScheduled === true && meta.scheduledStatus === 'SCHEDULED';
    let status: 'DRAFT' | 'SENT' | 'SCHEDULED' = 'DRAFT';
    if (isScheduled) {
      status = 'SCHEDULED';
    } else if ((announcement as any).updated_at && (announcement as any).created_at && (announcement as any).updated_at !== (announcement as any).created_at) {
      status = 'SENT';
    }

    const formatted = {
      ...announcement,
      status,
      sent_at: status === 'SENT' ? (announcement as any).updated_at : null,
      scheduled_at: isScheduled ? meta.scheduledAt : null,
    };

    if (teacherId) {
      const { data: assignments } = await this.supabase
        .from('batch_teachers')
        .select('batch_id')
        .eq('teacher_id', teacherId);

      const allowedBatchIds = (assignments || []).map((a) => a.batch_id);
      const targeted = (formatted.batches || []).map((b: any) => b.batch?.id);
      const hasAccess = targeted.some((bId: string) => allowedBatchIds.includes(bId));

      if (!hasAccess) {
        throw new AppError('Forbidden: Announcement not targeted to your batches', 403, 'FORBIDDEN_ANNOUNCEMENT_ACCESS');
      }
    }

    return formatted;
  }

  // ============================================================================
  // 4. SEND ANNOUNCEMENT (Admin Only)
  // ============================================================================
  async sendAnnouncement(
    id: string,
    options?: {
      scheduledTime?: string;
      includeTwoWayPrompt?: boolean;
      customTemplate?: string;
      tournamentIds?: string[];
      teamCodes?: string[];
      teamMemberIds?: string[];
      includeSelf?: boolean;
    }
  ) {
    // 1. Fetch announcement with batches and metadata
    const announcement = await this.getAnnouncementById(id);
    const meta = (announcement.metadata as any) || {};

    const targetedBatchIds = (announcement.batches || [])
      .map((b: any) => b.batch?.id)
      .filter(Boolean);

    const targetedTournamentIds = (
      meta.tournamentIds ||
      options?.tournamentIds ||
      []
    ).filter(Boolean);

    const targetedTeamCodes = (
      meta.teamCodes ||
      options?.teamCodes ||
      []
    ).filter(Boolean);

    const targetedTeamMemberIds = (
      meta.teamMemberIds ||
      options?.teamMemberIds ||
      []
    ).filter(Boolean);

    const includeSelf = Boolean(
      meta.includeSelf ||
      options?.includeSelf
    );

    if (
      targetedBatchIds.length === 0 &&
      targetedTournamentIds.length === 0 &&
      targetedTeamCodes.length === 0 &&
      targetedTeamMemberIds.length === 0 &&
      !includeSelf
    ) {
      throw new AppError(
        'Cannot send announcement without targeted batches, tournaments, or teams',
        400,
        'INVALID_ANNOUNCEMENT_TARGET'
      );
    }

    // Deduplicate recipients by phone number
    const recipientMap = new Map<string, { recipientPhone: string; name: string; studentId?: string }>();

    // 2a. Fetch active students in target batches
    if (targetedBatchIds.length > 0) {
      const { data: batchStudents, error: bsError } = await this.supabase
        .from('batch_students')
        .select(`
          student:students(id, name, parent_whatsapp, student_mobile, status)
        `)
        .in('batch_id', targetedBatchIds);

      if (bsError) {
        throw new AppError(`Failed to fetch students in target batches: ${bsError.message}`, 500);
      }

      for (const row of batchStudents || []) {
        const st = row.student as any;
        if (st && st.status === 'ACTIVE') {
          const phone = st.parent_whatsapp || st.student_mobile;
          if (phone && !recipientMap.has(phone)) {
            recipientMap.set(phone, { recipientPhone: phone, name: st.name, studentId: st.id });
          }
        }
      }
    }

    // 2b. Fetch active students registered in targeted tournaments
    if (targetedTournamentIds.length > 0) {
      const { data: tourRegs, error: trError } = await this.supabase
        .from('tournament_registrations')
        .select(`
          student:students(id, name, parent_whatsapp, student_mobile, status)
        `)
        .in('tournament_id', targetedTournamentIds);

      if (trError) {
        console.warn('[AnnouncementService] Failed to fetch tournament students:', trError.message);
      }

      for (const row of tourRegs || []) {
        const st = row.student as any;
        if (st && st.status === 'ACTIVE') {
          const phone = st.parent_whatsapp || st.student_mobile;
          if (phone && !recipientMap.has(phone)) {
            recipientMap.set(phone, { recipientPhone: phone, name: st.name, studentId: st.id });
          }
        }
      }
    }

    // 2c. Fetch active team members in targeted teams
    if (targetedTeamCodes.length > 0 || targetedTeamMemberIds.length > 0) {
      let query = this.supabase.from('team_members').select('*').eq('status', 'ACTIVE');
      if (targetedTeamCodes.length > 0 && targetedTeamMemberIds.length > 0) {
        query = query.or(`team_code.in.(${targetedTeamCodes.join(',')}),id.in.(${targetedTeamMemberIds.join(',')})`);
      } else if (targetedTeamCodes.length > 0) {
        query = query.in('team_code', targetedTeamCodes);
      } else {
        query = query.in('id', targetedTeamMemberIds);
      }

      const { data: teamMembers, error: tmError } = await query;
      if (tmError) {
        console.warn('[AnnouncementService] Failed to fetch team members:', tmError.message);
      }

      for (const tm of teamMembers || []) {
        if (tm.phone && !recipientMap.has(tm.phone)) {
          recipientMap.set(tm.phone, {
            recipientPhone: tm.phone,
            name: tm.name || 'Team Member',
          });
        }
      }
    }

    // 2d. Self / Admin
    if (includeSelf) {
      const { data: ws } = await this.supabase
        .from('whatsapp_settings')
        .select('device_phone_number')
        .limit(1)
        .maybeSingle();
      const adminPhone = ws?.device_phone_number || '9881888061';
      if (adminPhone && !recipientMap.has(adminPhone)) {
        recipientMap.set(adminPhone, {
          recipientPhone: adminPhone,
          name: 'Sensei Vikram Salunkhe (Admin Self)',
        });
      }
    }

    const recipients = Array.from(recipientMap.values());
    if (recipients.length === 0) {
      throw new AppError('No active recipients found in the selected target batches, tournaments, or teams', 400);
    }

    // Fetch dynamic academy name
    const { data: academy } = await supabaseAdmin
      .from('academy_settings')
      .select('academy_name')
      .limit(1)
      .maybeSingle();
    const academyName = academy?.academy_name || 'Gurukul Sports Academy';

    // Calculate start timestamp (handles user-scheduled future broadcasts)
    let startTimestamp = Date.now();
    if (options?.scheduledTime) {
      const parsedTime = new Date(options.scheduledTime).getTime();
      if (!isNaN(parsedTime) && parsedTime > Date.now()) {
        startTimestamp = parsedTime;
      }
    }

    // 3. Dispatch to all recipient phones with randomized anti-ban throttle
    const rawTemplate = options?.customTemplate || meta.customTemplate;
    const defaultBody = `📢 *${announcement.title}*\n\n${announcement.message}\n\n- *${academyName}*`;
    const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const items = recipients
      .map((rec) => {
        let body = defaultBody;
        if (rawTemplate && typeof rawTemplate === 'string' && rawTemplate.trim()) {
          const parentName = rec.name && rec.name.split(' ')[0] ? `${rec.name.split(' ')[0]}'s Parent` : 'Parent';
          body = rawTemplate
            .replace(/{title}/g, announcement.title || '')
            .replace(/{message}/g, announcement.message || '')
            .replace(/{student_name}/g, rec.name || 'Athlete')
            .replace(/{parent_name}/g, parentName)
            .replace(/{academy_name}/g, academyName)
            .replace(/{date}/g, todayStr);
        }

        return {
          recipientPhone: rec.recipientPhone,
          messageBody: body,
          studentId: rec.studentId,
          eventType: 'ANNOUNCEMENT',
          idempotencyKey: `ANNOUNCEMENT:${announcement.id}:${rec.recipientPhone}:${Date.now()}`,
          metadata: {
            announcementId: announcement.id,
            scheduledTime: options?.scheduledTime,
          },
        };
      })
      .filter(Boolean) as any[];

    const queuedItems = await queueService.enqueueBatchStaggered(items, 2800, startTimestamp);

    // If scheduled for immediately (now), trigger queue processor in background
    if (startTimestamp <= Date.now() + 30000) {
      (async () => {
        for (const item of queuedItems) {
          try {
            await queueService.processItem(item);
          } catch (e: any) {
            console.warn(`[AnnouncementService] Error delivering announcement to ${item.recipient_phone}:`, e.message);
          }
        }
      })().catch((err) => console.warn('[AnnouncementService] Background dispatch warning:', err.message));
    }

    // 5. Update announcement timestamp & metadata
    const isScheduledFuture = startTimestamp > Date.now() + 30000;
    const nowIso = new Date().toISOString();
    const existingMeta = (announcement.metadata as any) || {};
    const updatedMeta = {
      ...existingMeta,
      isScheduled: isScheduledFuture,
      scheduledAt: isScheduledFuture ? new Date(startTimestamp).toISOString() : null,
      scheduledStatus: isScheduledFuture ? 'SCHEDULED' : 'SENT',
      totalRecipients: queuedItems.length,
      targetBatchIds: targetedBatchIds,
      targetTournamentIds: targetedTournamentIds,
      teamCodes: targetedTeamCodes,
      teamMemberIds: targetedTeamMemberIds,
      includeSelf,
      customTemplate: rawTemplate || existingMeta.customTemplate,
    };

    const { data: updated, error: updateErr } = await this.supabase
      .from('announcements')
      .update({
        updated_at: nowIso,
        metadata: updatedMeta,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      throw new AppError(`Failed to update announcement timestamp: ${updateErr.message}`, 500);
    }

    const formattedUpdated = {
      ...updated,
      status: isScheduledFuture ? 'SCHEDULED' : 'SENT',
      sent_at: isScheduledFuture ? null : nowIso,
      scheduled_at: isScheduledFuture ? new Date(startTimestamp).toISOString() : null,
    };

    return {
      success: true,
      message: isScheduledFuture
        ? `Announcement scheduled for ${new Date(startTimestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} across ${queuedItems.length} recipient(s) with safe spacing.`
        : `Announcement queued for ${queuedItems.length} recipient(s) with safe anti-ban spacing.`,
      totalRecipients: recipients.length,
      sentCount: queuedItems.length,
      isScheduled: isScheduledFuture,
      scheduledTime: isScheduledFuture ? new Date(startTimestamp).toISOString() : null,
      announcement: formattedUpdated,
    };
  }

  // ============================================================================
  // 5. UPDATE ANNOUNCEMENT (Admin Only)
  // ============================================================================
  async updateAnnouncement(
    id: string,
    dto: {
      title?: string;
      message?: string;
      batchIds?: string[];
      tournamentIds?: string[];
      teamCodes?: string[];
      teamIds?: string[];
      teamMemberIds?: string[];
      includeSelf?: boolean;
      metadata?: Record<string, any>;
    }
  ) {
    const existing = await this.getAnnouncementById(id);

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (dto.title !== undefined) updates.title = dto.title;
    if (dto.message !== undefined) updates.message = dto.message;
    if (
      dto.metadata !== undefined ||
      dto.tournamentIds !== undefined ||
      dto.teamCodes !== undefined ||
      dto.teamIds !== undefined ||
      dto.teamMemberIds !== undefined ||
      dto.includeSelf !== undefined
    ) {
      const existingMeta = (existing as any)?.metadata || {};
      updates.metadata = {
        ...existingMeta,
        ...(dto.metadata || {}),
        tournamentIds: dto.tournamentIds !== undefined ? dto.tournamentIds : (dto.metadata?.tournamentIds ?? existingMeta.tournamentIds ?? []),
        teamCodes: dto.teamCodes !== undefined ? dto.teamCodes : (dto.metadata?.teamCodes ?? existingMeta.teamCodes ?? []),
        teamIds: dto.teamIds !== undefined ? dto.teamIds : (dto.metadata?.teamIds ?? existingMeta.teamIds ?? []),
        teamMemberIds: dto.teamMemberIds !== undefined ? dto.teamMemberIds : (dto.metadata?.teamMemberIds ?? existingMeta.teamMemberIds ?? []),
        includeSelf: dto.includeSelf !== undefined ? dto.includeSelf : (dto.metadata?.includeSelf ?? existingMeta.includeSelf ?? false),
      };
    }

    const { error: updateErr } = await this.supabase
      .from('announcements')
      .update(updates)
      .eq('id', id);

    if (updateErr) {
      throw new AppError(`Failed to update announcement: ${updateErr.message}`, 500);
    }

    if (Array.isArray(dto.batchIds)) {
      await this.supabase
        .from('announcement_batches')
        .delete()
        .eq('announcement_id', id);

      if (dto.batchIds.length > 0) {
        const batchLinks = dto.batchIds.map((batchId) => ({
          announcement_id: id,
          batch_id: batchId,
        }));
        const { error: linkErr } = await this.supabase
          .from('announcement_batches')
          .insert(batchLinks);

        if (linkErr) {
          throw new AppError(`Failed to update announcement batches: ${linkErr.message}`, 500);
        }
      }
    }

    return this.getAnnouncementById(id);
  }

  // ============================================================================
  // 6. DELETE ANNOUNCEMENT (Admin Only)
  // ============================================================================
  async deleteAnnouncement(id: string) {
    // 0. Cancel any pending queue items associated with this announcement
    try {
      const existing = await this.getAnnouncementById(id).catch(() => null);
      if (existing) {
        await queueService.cancelPendingItemsForAnnouncement(id, existing.title);
      }
    } catch (e: any) {
      console.warn(`[AnnouncementService] Notice cancelling queue items for ${id}:`, e.message);
    }

    const { error: linkErr } = await this.supabase
      .from('announcement_batches')
      .delete()
      .eq('announcement_id', id);

    if (linkErr) {
      console.warn(`[AnnouncementService] Error unlinking batches: ${linkErr.message}`);
    }

    const { error: delErr } = await this.supabase
      .from('announcements')
      .delete()
      .eq('id', id);

    if (delErr) {
      throw new AppError(`Failed to delete announcement: ${delErr.message}`, 500);
    }

    return {
      success: true,
      message: 'Announcement deleted successfully',
      id,
    };
  }

  // ============================================================================
  // 7. LIST SCHEDULED ANNOUNCEMENTS
  // ============================================================================
  async listScheduledAnnouncements(teacherId?: string) {
    const all = await this.listAnnouncements(teacherId);

    // Also get queue items from whatsapp_queue for announcements
    const { data: queueItems } = await this.supabase
      .from('whatsapp_queue')
      .select('id, idempotency_key, message_body, scheduled_at, status, event_type')
      .eq('event_type', 'ANNOUNCEMENT');

    const matchesQueue = (a: any, q: any) => {
      const matchesId = q.idempotency_key && q.idempotency_key.includes(a.id);
      const matchesTitle = a.title && (q.message_body?.startsWith(`📢 *${a.title}*`) || q.message_body?.includes(`📢 *${a.title}*\n`));
      return Boolean(matchesId || matchesTitle);
    };

    const scheduledAnnouncements = all.filter((a) => {
      const meta = (a.metadata as any) || {};
      const hasPendingQueue = (queueItems || []).some(
        (q: any) => q.status === 'PENDING' && matchesQueue(a, q)
      );
      return (meta.isScheduled && meta.scheduledStatus === 'SCHEDULED') || hasPendingQueue;
    });

    return scheduledAnnouncements.map((a) => {
      const meta = (a.metadata as any) || {};
      const relatedQueue = (queueItems || []).filter((q: any) => matchesQueue(a, q));
      const pendingCount = relatedQueue.filter((q: any) => q.status === 'PENDING').length;
      const sentCount = relatedQueue.filter((q: any) => q.status === 'SENT' || (q.status as string) === 'MOCK').length;
      const failedCount = relatedQueue.filter((q: any) => q.status === 'FAILED').length;
      const earliestScheduled = relatedQueue
        .filter((q: any) => q.status === 'PENDING')
        .sort((x: any, y: any) => new Date(x.scheduled_at).getTime() - new Date(y.scheduled_at).getTime())[0]?.scheduled_at;

      return {
        ...a,
        status: pendingCount > 0 ? 'SCHEDULED' : (sentCount > 0 ? 'SENT' : (meta.scheduledStatus || 'SCHEDULED')),
        scheduled_at: earliestScheduled || meta.scheduledAt || a.updated_at,
        stats: {
          total: relatedQueue.length || meta.totalRecipients || 0,
          pending: pendingCount,
          sent: sentCount,
          failed: failedCount,
        },
      };
    });
  }

  // ============================================================================
  // 8. UPDATE SCHEDULED ANNOUNCEMENT
  // ============================================================================
  async updateScheduledAnnouncement(
    id: string,
    updates: {
      title?: string;
      message?: string;
      scheduledTime?: string;
      batchIds?: string[];
      tournamentIds?: string[];
    }
  ) {
    const existing = await this.getAnnouncementById(id);
    const existingMeta = (existing.metadata as any) || {};

    const updatedMeta = {
      ...existingMeta,
      ...(updates.scheduledTime ? { scheduledAt: new Date(updates.scheduledTime).toISOString(), isScheduled: true, scheduledStatus: 'SCHEDULED' } : {}),
    };

    // 1. Update announcement in DB
    await this.updateAnnouncement(id, {
      title: updates.title,
      message: updates.message,
      batchIds: updates.batchIds,
      tournamentIds: updates.tournamentIds,
      metadata: updatedMeta,
    });

    // 2. If scheduledTime or message changed, update pending items in queue
    if (updates.scheduledTime || updates.title || updates.message) {
      const newTime = updates.scheduledTime ? new Date(updates.scheduledTime).toISOString() : existingMeta.scheduledAt || new Date().toISOString();
      const newTitle = updates.title || existing.title;
      const newMessage = updates.message || existing.message;
      const academyName = 'Gurukul Sports Academy';
      const formatted = `📢 *${newTitle}*\n\n${newMessage}\n\n- *${academyName}*`;

      await queueService.updateScheduledAnnouncementItems(
        id,
        newTime,
        formatted,
        existing.title
      );
    }

    return this.getAnnouncementById(id);
  }

  // ============================================================================
  // 9. DELETE / CANCEL SCHEDULED ANNOUNCEMENT
  // ============================================================================
  async deleteScheduledAnnouncement(id: string, permanent: boolean = false) {
    const existing = await this.getAnnouncementById(id);

    // 1. Cancel pending queue items
    const cancelledCount = await queueService.cancelPendingItemsForAnnouncement(id, existing.title);

    // If permanent deletion requested, delete the announcement record entirely
    if (permanent) {
      await this.deleteAnnouncement(id);
      return {
        success: true,
        message: `Scheduled broadcast deleted permanently (${cancelledCount} queued messages cancelled).`,
        cancelledCount,
      };
    }

    // 2. Mark announcement metadata scheduledStatus as CANCELLED
    const existingMeta = (existing.metadata as any) || {};
    await this.supabase
      .from('announcements')
      .update({
        metadata: {
          ...existingMeta,
          isScheduled: false,
          scheduledStatus: 'CANCELLED',
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return {
      success: true,
      message: `Scheduled broadcast cancelled successfully (${cancelledCount} queued messages cancelled).`,
      cancelledCount,
    };
  }

  // ============================================================================
  // 10. DISPATCH SCHEDULED ANNOUNCEMENT NOW
  // ============================================================================
  async dispatchScheduledAnnouncementNow(id: string) {
    const existing = await this.getAnnouncementById(id);

    // 1. Update queue items to now and trigger queue runner
    const res = await queueService.dispatchAnnouncementNow(id, existing.title);

    // 2. Update announcement metadata
    const existingMeta = (existing.metadata as any) || {};
    await this.supabase
      .from('announcements')
      .update({
        metadata: {
          ...existingMeta,
          isScheduled: false,
          scheduledStatus: 'SENT',
          sentAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return {
      success: true,
      message: `Scheduled announcement dispatched immediately to ${res.dispatched} recipient(s).`,
      dispatchedCount: res.dispatched,
    };
  }
}

export const announcementService = new AnnouncementService();
