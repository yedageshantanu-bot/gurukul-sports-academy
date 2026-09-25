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
    // 1. Insert announcement header
    const { data: announcement, error: insertErr } = await this.supabase
      .from('announcements')
      .insert({
        title: dto.title,
        message: dto.message,
        created_by: createdByUserId ?? null,
        priority: 'NORMAL',
        scope: 'ALL',
      })
      .select()
      .single();

    if (insertErr || !announcement) {
      throw new AppError(`Failed to create announcement: ${insertErr?.message}`, 500);
    }

    // 2. Link target batches
    const batchLinks = dto.batchIds.map((batchId) => ({
      announcement_id: announcement.id,
      batch_id: batchId,
    }));

    const { error: linkErr } = await this.supabase
      .from('announcement_batches')
      .insert(batchLinks);

    if (linkErr) {
      throw new AppError(`Failed to target announcement batches: ${linkErr.message}`, 500);
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

    const list = (announcements || []).map((a: any) => ({
      ...a,
      status: a.updated_at && a.created_at && a.updated_at !== a.created_at ? 'SENT' : 'DRAFT',
      sent_at: a.updated_at && a.created_at && a.updated_at !== a.created_at ? a.updated_at : null,
    }));

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

    const formatted = {
      ...announcement,
      status: (announcement as any).updated_at && (announcement as any).created_at && (announcement as any).updated_at !== (announcement as any).created_at ? 'SENT' : 'DRAFT',
      sent_at: (announcement as any).updated_at && (announcement as any).created_at && (announcement as any).updated_at !== (announcement as any).created_at ? (announcement as any).updated_at : null,
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
  // 4. SEND ANNOUNCEMENT (Admin Only)
  // ============================================================================
  async sendAnnouncement(
    id: string,
    options?: { scheduledTime?: string; includeTwoWayPrompt?: boolean }
  ) {
    // 1. Fetch announcement with batches
    const announcement = await this.getAnnouncementById(id);

    const targetedBatchIds = (announcement.batches || [])
      .map((b: any) => b.batch?.id)
      .filter(Boolean);

    if (targetedBatchIds.length === 0) {
      throw new AppError('Cannot send announcement without targeted batches', 400, 'INVALID_ANNOUNCEMENT_TARGET');
    }

    // 2. Fetch active students in target batches
    const { data: batchStudents, error: bsError } = await this.supabase
      .from('batch_students')
      .select(`
        student:students(id, name, parent_whatsapp, student_mobile, status)
      `)
      .in('batch_id', targetedBatchIds);

    if (bsError) {
      throw new AppError(`Failed to fetch students in target batches: ${bsError.message}`, 500);
    }

    // Deduplicate students by ID
    const studentMap = new Map<string, any>();
    for (const row of batchStudents || []) {
      const st = row.student as any;
      if (st && st.status === 'ACTIVE' && !studentMap.has(st.id)) {
        studentMap.set(st.id, st);
      }
    }

    const students = Array.from(studentMap.values());

    // Fetch dynamic academy name
    const { data: academy } = await supabaseAdmin
      .from('academy_settings')
      .select('academy_name')
      .limit(1)
      .maybeSingle();
    const academyName = academy?.academy_name || 'Gurukul Sports Academy';

    // 3. 2-Way Engagement Footer to shield number from spam bans
    const twoWayFooter =
      options?.includeTwoWayPrompt !== false
        ? `\n\n💬 _Kisi bhi query ya confirmation ke liye yahan reply karein._\n📌 _Kripya iss number ko *${academyName}* ke naam se save kar lijiye._`
        : '';

    // Calculate start timestamp (handles user-scheduled future broadcasts)
    let startTimestamp = Date.now();
    if (options?.scheduledTime) {
      const parsedTime = new Date(options.scheduledTime).getTime();
      if (!isNaN(parsedTime) && parsedTime > Date.now()) {
        startTimestamp = parsedTime;
      }
    }

    // 4. Dispatch to all recipient phones with randomized 16-22s anti-ban throttle
    const items = students
      .map((student) => {
        const recipientPhone = student.parent_whatsapp || student.student_mobile;
        if (!recipientPhone) return null;
        return {
          recipientPhone,
          messageBody: `📢 *${announcement.title}*\n\n${announcement.message}\n\n- *${academyName}*${twoWayFooter}`,
          studentId: student.id,
          eventType: 'ANNOUNCEMENT',
          metadata: {
            announcementId: announcement.id,
            scheduledTime: options?.scheduledTime,
          },
        };
      })
      .filter(Boolean) as any[];

    const queuedItems = await queueService.enqueueBatchStaggered(items, 16000, startTimestamp);

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

    // 5. Update announcement timestamp
    const nowIso = new Date().toISOString();
    const { data: updated, error: updateErr } = await this.supabase
      .from('announcements')
      .update({
        updated_at: nowIso,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      throw new AppError(`Failed to update announcement timestamp: ${updateErr.message}`, 500);
    }

    const isScheduledFuture = startTimestamp > Date.now() + 30000;
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
      totalRecipients: students.length,
      sentCount: queuedItems.length,
      isScheduled: isScheduledFuture,
      scheduledTime: isScheduledFuture ? new Date(startTimestamp).toISOString() : null,
      announcement: formattedUpdated,
    };
  }

  // ============================================================================
  // 5. UPDATE ANNOUNCEMENT (Admin Only)
  // ============================================================================
  async updateAnnouncement(id: string, dto: { title?: string; message?: string; batchIds?: string[] }) {
    await this.getAnnouncementById(id);

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (dto.title !== undefined) updates.title = dto.title;
    if (dto.message !== undefined) updates.message = dto.message;

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
}

export const announcementService = new AnnouncementService();
