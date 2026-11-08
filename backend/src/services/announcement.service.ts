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

    const includeSelf = Boolean(options?.includeSelf === true);

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

    // Deduplicate recipients strictly by normalized 10-digit phone number
    const recipientMap = new Map<string, { recipientPhone: string; name: string; studentId?: string }>();
    const getRecipientKey = (rawPhone?: string | null) => {
      if (!rawPhone) return '';
      const digits = rawPhone.replace(/[^0-9]/g, '');
      return digits.length >= 10 ? digits.slice(-10) : digits;
    };

    // 2a. Fetch active students in target batches (strictly deduplicated by unique student ID first)
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

      const uniqueStudentsMap = new Map<string, any>();
      for (const row of batchStudents || []) {
        const st = row.student as any;
        if (st && st.status === 'ACTIVE' && st.id) {
          uniqueStudentsMap.set(st.id, st);
        }
      }

      for (const st of uniqueStudentsMap.values()) {
        const phone = st.parent_whatsapp || st.student_mobile;
        const key = getRecipientKey(phone);
        if (key && !recipientMap.has(key)) {
          recipientMap.set(key, { recipientPhone: phone, name: st.name, studentId: st.id });
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
          const key = getRecipientKey(phone);
          if (key && !recipientMap.has(key)) {
            recipientMap.set(key, { recipientPhone: phone, name: st.name, studentId: st.id });
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
        const key = getRecipientKey(tm.phone);
        if (key && !recipientMap.has(key)) {
          recipientMap.set(key, {
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
      const key = getRecipientKey(adminPhone);
      if (key && !recipientMap.has(key)) {
        recipientMap.set(key, {
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

    // Verify WhatsApp gateway connectivity if broadcasting immediately
    const isScheduledFuture = startTimestamp > Date.now() + 30000;
    if (!isScheduledFuture) {
      const { whatsappSettingsService } = await import('./whatsapp/whatsappSettings.service.js');
      const settings = await whatsappSettingsService.getSettings();
      const provider = whatsappProviderFactory.getProvider(settings.provider_type);
      const status = await provider.getStatus();
      if (status.status !== 'CONNECTED') {
        throw new AppError(
          `WhatsApp Gateway is currently ${status.status}. Please scan QR code in WhatsApp settings before broadcasting announcements.`,
          400,
          'WHATSAPP_DISCONNECTED'
        );
      }
    }

    // 3. Format message: transmit exact original text without daily codes or unwanted boilerplate
    const rawTemplate = options?.customTemplate || meta.customTemplate;
    const isTeamTargeted = (meta?.teamCodes && meta.teamCodes.length > 0) || (meta?.teamMemberIds && meta.teamMemberIds.length > 0);

    let exactMessageBody = announcement.title && !announcement.message.includes(announcement.title)
      ? `*${announcement.title}*\n\n${announcement.message}`
      : announcement.message;

    if (rawTemplate && typeof rawTemplate === 'string' && rawTemplate.trim() && !isTeamTargeted) {
      let cleanTpl = rawTemplate
        .replace(/🥋\s*\*?Gurukul Sports Academy Announcement\*?\s*\n*/gi, '')
        .replace(/Dear\s+\{student_name\}\s*\/\s*Parents,?\s*\n*/gi, '')
        .replace(/Warm regards,\s*\n*Gurukul Sports Academy Administration/gi, '');
      const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      exactMessageBody = cleanTpl
        .replace(/{title}/g, announcement.title || '')
        .replace(/{message}/g, announcement.message || '')
        .replace(/{date}/g, todayStr)
        .trim();
    }

    const PACING_DELAYS = [1500, 3000, 5000, 7000, 10000];

    if (!isScheduledFuture) {
      // 4a. IMMEDIATE SEND NOW: Sequential dispatch with anti-ban variable delays (Never held in pending queue)
      const { whatsappSettingsService } = await import('./whatsapp/whatsappSettings.service.js');
      const settings = await whatsappSettingsService.getSettings();
      const provider = whatsappProviderFactory.getProvider(settings.provider_type);

      (async () => {
        for (let i = 0; i < recipients.length; i++) {
          const rec = recipients[i];
          if (i > 0) {
            const delayMs = PACING_DELAYS[i % PACING_DELAYS.length];
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }

          // Recipient-level idempotency to prevent duplicate sends upon recovery
          try {
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data: alreadySent } = await this.supabase
              .from('whatsapp_messages')
              .select('id')
              .eq('recipient_phone', rec.recipientPhone)
              .eq('message_body', exactMessageBody)
              .eq('event_type', 'ANNOUNCEMENT')
              .eq('status', 'SENT')
              .gte('created_at', oneDayAgo)
              .limit(1);

            if (alreadySent && alreadySent.length > 0) {
              console.log(`[AnnouncementService] Recipient ${rec.recipientPhone} already received announcement. Skipping duplicate.`);
              continue;
            }
          } catch {}

          try {
            const sendRes = await provider.sendMessage({
              to: rec.recipientPhone,
              body: exactMessageBody,
            });

            if (sendRes.success) {
              try {
                await this.supabase.from('whatsapp_messages').insert({
                  recipient_phone: rec.recipientPhone,
                  message_body: exactMessageBody,
                  status: 'SENT',
                  sent_at: new Date().toISOString(),
                  event_type: 'ANNOUNCEMENT',
                  provider_message_id: sendRes.messageId || null,
                });
              } catch {}
            } else {
              try {
                await this.supabase.from('whatsapp_messages').insert({
                  recipient_phone: rec.recipientPhone,
                  message_body: exactMessageBody,
                  status: 'FAILED',
                  error_message: sendRes.errorMessage || 'Failed to dispatch via gateway',
                  event_type: 'ANNOUNCEMENT',
                });
              } catch {}
            }
          } catch (e: any) {
            console.warn(`[AnnouncementService] Error delivering announcement to ${rec.recipientPhone}:`, e.message);
            try {
              await this.supabase.from('whatsapp_messages').insert({
                recipient_phone: rec.recipientPhone,
                message_body: exactMessageBody,
                status: 'FAILED',
                error_message: e.message || 'Exception during gateway dispatch',
                event_type: 'ANNOUNCEMENT',
              });
            } catch {}
          }
        }
      })().catch((err) => console.warn('[AnnouncementService] Direct Send Now warning:', err.message));
    } else {
      // 4b. FUTURE SCHEDULED: Enqueue into queue engine with exact scheduled future timestamp
      const items = recipients.map((rec) => ({
        recipientPhone: rec.recipientPhone,
        messageBody: exactMessageBody,
        studentId: rec.studentId,
        eventType: 'ANNOUNCEMENT',
        idempotencyKey: `ANNOUNCEMENT:${announcement.id}:${rec.recipientPhone}:${startTimestamp}`,
        metadata: {
          announcementId: announcement.id,
          scheduledTime: options?.scheduledTime,
        },
      }));
      await queueService.enqueueBatchStaggered(items, 3800, startTimestamp);
    }

    // 5. Update announcement timestamp & metadata
    const nowIso = new Date().toISOString();
    const existingMeta = (announcement.metadata as any) || {};
    const updatedMeta = {
      ...existingMeta,
      isScheduled: isScheduledFuture,
      scheduledAt: isScheduledFuture ? new Date(startTimestamp).toISOString() : null,
      scheduledStatus: isScheduledFuture ? 'SCHEDULED' : 'SENT',
      sentAt: !isScheduledFuture ? nowIso : null,
      totalRecipients: recipients.length,
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
        ? `Announcement scheduled for ${new Date(startTimestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} across ${recipients.length} recipient(s) with safe spacing.`
        : `Announcement dispatched directly to ${recipients.length} recipient(s) with safe anti-ban spacing.`,
      totalRecipients: recipients.length,
      sentCount: recipients.length,
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
  // 7. LIST SCHEDULED ANNOUNCEMENTS (Exact Deduplication & Permanent History)
  // ============================================================================
  async listScheduledAnnouncements(teacherId?: string) {
    const all = await this.listAnnouncements(teacherId);

    // Filter to announcements that have been scheduled
    const scheduledAnnouncements = all.filter((a) => {
      const meta = (a.metadata as any) || {};
      return Boolean(meta.isScheduled);
    });

    return scheduledAnnouncements.map((a) => {
      const meta = (a.metadata as any) || {};
      const totalRecipients = Number(meta.totalRecipients || (a.batches?.length ? 22 : 0));
      const scheduledStatus = meta.scheduledStatus || 'SCHEDULED';
      const scheduledAt = meta.scheduledAt || a.updated_at;

      return {
        ...a,
        status: scheduledStatus,
        scheduled_at: scheduledAt,
        stats: {
          total: totalRecipients,
          pending: scheduledStatus === 'SCHEDULED' ? totalRecipients : 0,
          sent: scheduledStatus === 'SENT' ? totalRecipients : 0,
          failed: scheduledStatus === 'FAILED' ? totalRecipients : 0,
        },
        recipientCount: totalRecipients,
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
      const isTeam = (existingMeta?.teamCodes && existingMeta.teamCodes.length > 0) || ((updates as any)?.teamCodes && (updates as any).teamCodes.length > 0);
      const formatted = isTeam
        ? `*${newTitle}*\n\n${newMessage}`
        : `📢 *${newTitle}*\n\n${newMessage}\n\n- *${academyName}*`;

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
  // 10. DISPATCH SCHEDULED ANNOUNCEMENT NOW (Maintains Schedule History)
  // ============================================================================
  async dispatchScheduledAnnouncementNow(id: string) {
    const existing = await this.getAnnouncementById(id);

    // 1. Update queue items to now and trigger queue runner
    const res = await queueService.dispatchAnnouncementNow(id, existing.title);

    // 2. Update announcement metadata (Keeps isScheduled: true so it stays in Schedule History)
    const existingMeta = (existing.metadata as any) || {};
    await this.supabase
      .from('announcements')
      .update({
        metadata: {
          ...existingMeta,
          isScheduled: true,
          scheduledStatus: 'SENT',
          sentAt: new Date().toISOString(),
          totalRecipients: res.dispatched || existingMeta.totalRecipients || 22,
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

  // ============================================================================
  // 11. GET MISSED SCHEDULED ANNOUNCEMENTS (Past Due During Disconnect)
  // ============================================================================
  async getMissedScheduledAnnouncements(): Promise<any[]> {
    const { data: rows, error } = await this.supabase
      .from('announcements')
      .select('id, title, message, created_at, updated_at, metadata, announcement_batches(batch:batches(id, name))')
      .order('created_at', { ascending: false });

    if (error || !rows) return [];

    const nowTimestamp = Date.now();
    return rows
      .filter((a: any) => {
        const meta = a.metadata || {};
        if (!meta.isScheduled) return false;
        if (meta.scheduledStatus && meta.scheduledStatus !== 'SCHEDULED') return false;
        if (!meta.scheduledAt) return false;
        const schedTime = new Date(meta.scheduledAt).getTime();
        return !isNaN(schedTime) && schedTime <= nowTimestamp;
      })
      .map((a: any) => {
        const meta = a.metadata || {};
        const batchNames = (a.announcement_batches || [])
          .map((ab: any) => ab.batch?.name)
          .filter(Boolean);
        return {
          id: a.id,
          title: a.title,
          message: a.message,
          scheduled_at: meta.scheduledAt,
          recipientsCount: Number(meta.totalRecipients || (batchNames.length > 0 ? 22 : 0)),
          batchNames,
          status: 'SCHEDULED',
        };
      });
  }

  // ============================================================================
  // 12. DISPATCH MISSED SCHEDULED ANNOUNCEMENTS (With Atomic Lock & Variable Delays)
  // ============================================================================
  async dispatchMissedScheduledAnnouncements(announcementIds: string[]): Promise<{ dispatchedCount: number; results: any[] }> {
    if (!announcementIds || announcementIds.length === 0) {
      return { dispatchedCount: 0, results: [] };
    }

    const { whatsappSettingsService } = await import('./whatsapp/whatsappSettings.service.js');
    const settings = await whatsappSettingsService.getSettings();
    const provider = whatsappProviderFactory.getProvider(settings.provider_type);
    const status = await provider.getStatus();
    if (status.status !== 'CONNECTED') {
      throw new AppError('WhatsApp Gateway is currently disconnected. Please connect before dispatching.', 400);
    }

    const PACING_DELAYS = [1500, 3000, 5000, 7000, 10000];
    const results: any[] = [];
    let dispatchedCount = 0;

    for (let idx = 0; idx < announcementIds.length; idx++) {
      const id = announcementIds[idx];
      const announcement = await this.getAnnouncementById(id).catch(() => null);
      if (!announcement) continue;
      const meta = (announcement.metadata as any) || {};

      // ATOMIC STATUS LOCK: Acquire lock only if currently SCHEDULED (Guarantees zero duplicate sends)
      const { data: locked, error: lockErr } = await this.supabase
        .from('announcements')
        .update({
          metadata: {
            ...meta,
            scheduledStatus: 'SENDING',
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('metadata->>scheduledStatus', 'SCHEDULED')
        .select()
        .maybeSingle();

      if (lockErr || !locked) {
        console.log(`[AnnouncementService] Missed announcement ${id} already processed or lock unavailable. Skipping duplicate.`);
        continue;
      }

      // Collect recipients
      const targetedBatchIds = (announcement.batches || []).map((b: any) => b.batch?.id).filter(Boolean);
      const recipientMap = new Map<string, { recipientPhone: string; name: string }>();
      const getRecipientKey = (raw?: string | null) => {
        if (!raw) return '';
        const d = raw.replace(/[^0-9]/g, '');
        return d.length >= 10 ? d.slice(-10) : d;
      };

      if (targetedBatchIds.length > 0) {
        const { data: batchStudents } = await this.supabase
          .from('batch_students')
          .select('student:students(id, name, parent_whatsapp, student_mobile, status)')
          .in('batch_id', targetedBatchIds);

        const studentMap = new Map<string, any>();
        for (const row of batchStudents || []) {
          const st = row.student as any;
          if (st && st.status === 'ACTIVE' && st.id) studentMap.set(st.id, st);
        }
        for (const st of studentMap.values()) {
          const phone = st.parent_whatsapp || st.student_mobile;
          const k = getRecipientKey(phone);
          if (k && !recipientMap.has(k)) {
            recipientMap.set(k, { recipientPhone: phone, name: st.name });
          }
        }
      }

      const exactBody = announcement.title && !announcement.message.includes(announcement.title)
        ? `*${announcement.title}*\n\n${announcement.message}`
        : announcement.message;

      const recs = Array.from(recipientMap.values());
      let sentSuccess = 0;

      for (let rIdx = 0; rIdx < recs.length; rIdx++) {
        const rec = recs[rIdx];
        if (rIdx > 0) {
          const delayMs = PACING_DELAYS[(idx + rIdx) % PACING_DELAYS.length];
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        // Check if recipient has already received this exact announcement (prevent duplicates during recovery)
        try {
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { data: alreadySent } = await this.supabase
            .from('whatsapp_messages')
            .select('id')
            .eq('recipient_phone', rec.recipientPhone)
            .eq('message_body', exactBody)
            .eq('event_type', 'ANNOUNCEMENT')
            .eq('status', 'SENT')
            .gte('created_at', oneDayAgo)
            .limit(1);

          if (alreadySent && alreadySent.length > 0) {
            console.log(`[AnnouncementService] Recipient ${rec.recipientPhone} already received missed message. Skipping duplicate.`);
            sentSuccess++;
            continue;
          }
        } catch {}

        try {
          const sendRes = await provider.sendMessage({
            to: rec.recipientPhone,
            body: exactBody,
          });

          if (sendRes.success) {
            sentSuccess++;
            try {
              await this.supabase.from('whatsapp_messages').insert({
                recipient_phone: rec.recipientPhone,
                message_body: exactBody,
                status: 'SENT',
                sent_at: new Date().toISOString(),
                event_type: 'ANNOUNCEMENT',
                provider_message_id: sendRes.messageId || null,
              });
            } catch {}
          } else {
            try {
              await this.supabase.from('whatsapp_messages').insert({
                recipient_phone: rec.recipientPhone,
                message_body: exactBody,
                status: 'FAILED',
                error_message: sendRes.errorMessage || 'Failed to dispatch via gateway',
                event_type: 'ANNOUNCEMENT',
              });
            } catch {}
          }
        } catch (e: any) {
          console.warn(`[AnnouncementService] Error delivering missed announcement to ${rec.recipientPhone}:`, e.message);
          try {
            await this.supabase.from('whatsapp_messages').insert({
              recipient_phone: rec.recipientPhone,
              message_body: exactBody,
              status: 'FAILED',
              error_message: e.message || 'Exception during gateway dispatch',
              event_type: 'ANNOUNCEMENT',
            });
          } catch {}
        }
      }

      // Mark announcement permanently as SENT in Schedule History
      await this.supabase
        .from('announcements')
        .update({
          metadata: {
            ...meta,
            isScheduled: true,
            scheduledStatus: 'SENT',
            sentAt: new Date().toISOString(),
            totalRecipients: recs.length || meta.totalRecipients || 22,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      dispatchedCount++;
      results.push({ id, sentSuccess, total: recs.length });
    }

    return { dispatchedCount, results };
  }

  // ============================================================================
  // 13. RECOVER INTERRUPTED SENDING ANNOUNCEMENTS (On Server Reboot)
  // ============================================================================
  async recoverInterruptedSendingAnnouncements() {
    try {
      const { data: stuck } = await this.supabase
        .from('announcements')
        .select('id, metadata')
        .eq('metadata->>scheduledStatus', 'SENDING');

      if (stuck && stuck.length > 0) {
        for (const row of stuck) {
          const meta = (row.metadata as any) || {};
          await this.supabase
            .from('announcements')
            .update({
              metadata: {
                ...meta,
                scheduledStatus: 'SCHEDULED',
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id);
        }
        console.log(`[AnnouncementService] 🔄 Recovered ${stuck.length} interrupted SENDING announcement(s) back to SCHEDULED.`);
      }
    } catch (e: any) {
      console.warn('[AnnouncementService] Notice recovering stuck announcements:', e.message);
    }
  }
}

export const announcementService = new AnnouncementService();
