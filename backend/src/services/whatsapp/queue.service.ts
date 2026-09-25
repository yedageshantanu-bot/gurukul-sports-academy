import crypto from 'crypto';
import { supabaseAdmin } from '../../config/supabase.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { whatsappProviderFactory } from './whatsappProvider.factory.js';
import { whatsappSettingsService } from './whatsappSettings.service.js';
import { env } from '../../config/env.js';
import { requestContext } from '../../config/requestContext.js';
import { ROLES } from '../../constants/index.js';
import {
  WhatsAppQueueItem,
  WhatsAppQueueStatus,
  QueueFilterQuery,
  TodayStats,
} from '../../types/whatsapp.types.js';

export interface EnqueueMessageParams {
  recipientPhone: string;
  messageBody: string;
  studentId?: string | null;
  templateId?: string | null;
  eventType?: string;
  scheduledAt?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

export class WhatsAppQueueService {
  private inMemoryQueue: Map<string, WhatsAppQueueItem> = new Map();
  private processingRecipients: Set<string> = new Set();
  private lastDispatchedAt: number = 0;
  public readonly MIN_DISPATCH_INTERVAL_MS = 15000; // 15-second anti-ban throttle

  private get supabase() {
    return supabaseAdmin;
  }

  // Normalize phone number to standard format (handles Indian numbers, leading zeros, +91)
  normalizePhoneNumber(phone: string): string {
    let digits = phone.replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) digits = digits.slice(1);
    if (digits.startsWith('0') && digits.length === 11) {
      digits = digits.slice(1);
    }
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    return `+${digits}`;
  }

  // Generate idempotency key for deduplication
  generateIdempotencyKey(phone: string, eventType: string, body: string): string {
    const raw = `${phone.trim()}_${eventType.trim()}_${body.trim()}`;
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
  }

  // Stagger an array of messages so they dispatch with a humanized 15-25 second gap between each recipient
  async enqueueBatchStaggered(
    items: EnqueueMessageParams[],
    baseIntervalMs: number = 16000,
    startFromTimestamp?: number
  ): Promise<WhatsAppQueueItem[]> {
    if (env.DEMO_MODE || env.APP_ENV === 'demo' || !env.WHATSAPP_ENABLED) {
      console.log('[QueueService] WhatsApp is disabled in environment. Skipping batch enqueue.');
      return [];
    }

    const results: WhatsAppQueueItem[] = [];
    let currentSchedule = startFromTimestamp || Date.now();

    for (let i = 0; i < items.length; i++) {
      if (i > 0) {
        // Add random jitter of 3-7 seconds to prevent robotic periodic patterns
        const jitter = Math.floor(Math.random() * 5000);
        currentSchedule += baseIntervalMs + jitter;
      }
      const scheduledTime = new Date(currentSchedule).toISOString();
      const queued = await this.enqueueMessage({
        ...items[i],
        scheduledAt: scheduledTime,
      });
      results.push(queued);
    }

    return results;
  }

  // ============================================================================
  // 1. ENQUEUE MESSAGE (With Duplicate Insertion Protection)
  async enqueueMessage(params: EnqueueMessageParams): Promise<WhatsAppQueueItem> {
    if (!env.WHATSAPP_ENABLED) {
      console.log('[QueueService] WhatsApp is disabled in environment. Message enqueue refused.');
      return {
        id: crypto.randomUUID(),
        recipient_phone: this.normalizePhoneNumber(params.recipientPhone),
        student_id: params.studentId || null,
        template_id: params.templateId || null,
        event_type: params.eventType || 'DEMO_DISCARDED',
        message_body: params.messageBody,
        scheduled_at: new Date().toISOString(),
        status: 'FAILED',
        attempts: 0,
        max_attempts: 0,
        sent_at: null,
        failure_reason: 'WhatsApp automation is disabled in client trial demo mode.',
        idempotency_key: 'demo-discarded',
        provider_message_id: null,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    const normalizedPhone = this.normalizePhoneNumber(params.recipientPhone);
    const eventType = params.eventType || 'CUSTOM_NOTIFICATION';
    const idempotencyKey =
      params.idempotencyKey || this.generateIdempotencyKey(normalizedPhone, eventType, params.messageBody);

    // Rapid double-click guard: only reuse if the exact same message is currently waiting in PENDING or PROCESSING
    for (const item of this.inMemoryQueue.values()) {
      if (item.idempotency_key === idempotencyKey) {
        if (item.status === 'PENDING' || item.status === 'PROCESSING') {
          console.log(`[QueueService] Message is already queued and waiting for dispatch to ${normalizedPhone}. Reusing queued item.`);
          return item;
        }
      }
    }

    const queueId = crypto.randomUUID();
    const now = new Date().toISOString();
    const scheduledAt = params.scheduledAt || now;

    const newItem: WhatsAppQueueItem = {
      id: queueId,
      recipient_phone: normalizedPhone,
      student_id: params.studentId || null,
      template_id: params.templateId || null,
      event_type: eventType,
      message_body: params.messageBody,
      scheduled_at: scheduledAt,
      status: 'PENDING',
      attempts: 0,
      max_attempts: 3,
      sent_at: null,
      failure_reason: null,
      idempotency_key: idempotencyKey,
      provider_message_id: null,
      metadata: params.metadata || {},
      created_at: now,
      updated_at: now,
    };

    // Store in-memory
    this.inMemoryQueue.set(queueId, newItem);

    // Persist to Supabase if table exists
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('whatsapp_queue')
          .insert({
            id: newItem.id,
            recipient_phone: newItem.recipient_phone,
            student_id: newItem.student_id,
            event_type: newItem.event_type,
            message_body: newItem.message_body,
            scheduled_at: newItem.scheduled_at,
            status: newItem.status,
            attempts: newItem.attempts,
            max_attempts: newItem.max_attempts,
            idempotency_key: newItem.idempotency_key,
          })
          .select()
          .single();

        if (!error && data) {
          this.inMemoryQueue.set(queueId, { ...newItem, ...data });
          return data as WhatsAppQueueItem;
        }
      } catch {
        // Ignored if table not in schema
      }
    }

    return newItem;
  }

  // ============================================================================
  // 2. PROCESS INDIVIDUAL QUEUE ITEM (WITH ALL 10 SAFETY CHECKS)
  // ============================================================================
  async processItem(item: WhatsAppQueueItem): Promise<{ success: boolean; reason?: string; status: WhatsAppQueueStatus; result?: any }> {
    const settings = await whatsappSettingsService.getSettings();
    const provider = whatsappProviderFactory.getProvider(settings.provider_type);

    // --- SAFETY CHECK 1: Is Global Automation ON? ---
    if (!settings.global_automation_enabled) {
      const reason = 'Global WhatsApp automation is currently disabled (OFF)';
      await this.markItemFailed(item.id, reason, false);
      return { success: false, reason, status: 'PENDING' };
    }

    // --- SAFETY CHECK 2: Is Emergency STOP OFF? ---
    if (settings.emergency_stop) {
      const reason = 'Emergency STOP is active. All message dispatches are halted.';
      await this.markItemFailed(item.id, reason, false);
      return { success: false, reason, status: 'PENDING' };
    }

    // --- SAFETY CHECK 3: Is Recipient Opted-in? ---
    const isOptedIn = await whatsappSettingsService.isOptedIn({
      studentId: item.student_id || undefined,
      phoneNumber: item.recipient_phone,
    });
    if (!isOptedIn) {
      const reason = 'Recipient has opted out of WhatsApp messages (whatsapp_opt_in = false)';
      await this.markItemFailed(item.id, reason, true);
      return { success: false, reason, status: 'FAILED' };
    }

    // --- SAFETY CHECK 4: Is Recipient Phone Valid? ---
    const cleanedPhone = item.recipient_phone.replace(/[^\d+]/g, '');
    if (!cleanedPhone || cleanedPhone.length < 8) {
      const reason = 'Invalid recipient phone number format';
      await this.markItemFailed(item.id, reason, true);
      return { success: false, reason, status: 'FAILED' };
    }

    // --- SAFETY CHECK 5: Is Message Still Valid? ---
    if (item.status === 'CANCELLED') {
      return { success: false, reason: 'Message was cancelled', status: 'CANCELLED' };
    }
    if (item.status === 'SENT') {
      return { success: true, reason: 'Message already sent', status: 'SENT' };
    }

    // --- SAFETY CHECK 6: Is another message for this recipient currently processing? ---
    if (this.processingRecipients.has(item.recipient_phone)) {
      const reason = 'Another message for this recipient is currently processing';
      return { success: false, reason, status: 'PENDING' };
    }

    // --- SAFETY CHECK 8: Has the Daily Sending Limit been reached? ---
    const todayStats = await this.getTodayStats();
    if (todayStats.sent >= settings.daily_limit) {
      const reason = `Daily sending limit reached (${settings.daily_limit} messages). Message queued safely.`;
      return { success: false, reason, status: 'PENDING' };
    }

    // --- SAFETY CHECK 9: Is the WhatsApp Sender Connected? ---
    const deviceStatus = await provider.getStatus();
    if ((provider.name === 'PROTOTYPE_LINKED_DEVICE' || provider.name === 'OPENWA') && deviceStatus.status !== 'CONNECTED') {
      const reason = `WhatsApp sender is not connected (Status: ${deviceStatus.status})`;
      await this.markItemFailed(item.id, reason, false);
      return { success: false, reason, status: 'PENDING' };
    }

    // --- SAFETY CHECK 10: Is the Provider Available & Healthy? ---
    const health = await provider.healthCheck();
    if (!health.healthy) {
      const reason = `WhatsApp provider healthcheck failed: ${health.details || 'Unavailable'}`;
      await this.markItemFailed(item.id, reason, false);
      return { success: false, reason, status: 'PENDING' };
    }

    // ==========================================================================
    // ALL 10 CHECKS PASSED — DISPATCH VIA PROVIDER
    // ==========================================================================
    this.processingRecipients.add(item.recipient_phone);
    await this.updateItemStatus(item.id, 'PROCESSING');

    try {
      // Anti-Ban Rate Limiting: Minimum 15-22 seconds randomized gap between consecutive WhatsApp deliveries
      if ((provider.name === 'PROTOTYPE_LINKED_DEVICE' || provider.name === 'OPENWA') && this.lastDispatchedAt > 0) {
        const elapsed = Date.now() - this.lastDispatchedAt;
        const dynamicDelay = this.MIN_DISPATCH_INTERVAL_MS + Math.floor(Math.random() * 6000); // 15s to 21s
        if (elapsed < dynamicDelay) {
          const waitMs = dynamicDelay - elapsed;
          console.log(
            `[QueueService] Anti-Ban throttle: waiting ${Math.ceil(waitMs / 1000)}s before dispatching to ${item.recipient_phone}...`
          );
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }

      const result = await provider.sendMessage({
        to: item.recipient_phone,
        body: item.message_body,
      });

      this.lastDispatchedAt = Date.now();

      if (result.success) {
        const finalStatus = result.status === 'MOCK' ? 'MOCK' : 'SENT';
        await this.markItemSent(item.id, result.messageId || `msg_${Date.now()}`, finalStatus as any);
        return { success: true, status: finalStatus as any, result };
      } else {
        await this.markItemFailed(item.id, result.errorMessage || 'Provider delivery error', true);
        return { success: false, reason: result.errorMessage, status: 'FAILED', result };
      }
    } catch (err: any) {
      await this.markItemFailed(item.id, err.message || 'Unexpected sending exception', true);
      return { success: false, reason: err.message, status: 'FAILED' };
    } finally {
      this.processingRecipients.delete(item.recipient_phone);
    }
  }

  // ============================================================================
  // 3. PROCESS QUEUE BATCH
  // ============================================================================
  async processQueue(batchSize = 5): Promise<{
    processed: number;
    successful: number;
    failed: number;
    pending: number;
  }> {
    const settings = await whatsappSettingsService.getSettings();
    if (!settings.global_automation_enabled || settings.emergency_stop) {
      return { processed: 0, successful: 0, failed: 0, pending: this.getPendingCount() };
    }

    const now = new Date().toISOString();
    const pendingItems = Array.from(this.inMemoryQueue.values())
      .filter((i) => i.status === 'PENDING' && i.scheduled_at <= now)
      .slice(0, batchSize);

    let successful = 0;
    let failed = 0;

    for (const item of pendingItems) {
      const res = await this.processItem(item);
      if (res.success) successful++;
      else if (res.status === 'FAILED') failed++;
    }

    return {
      processed: pendingItems.length,
      successful,
      failed,
      pending: this.getPendingCount(),
    };
  }

  // ============================================================================
  // 4. RETRY FAILED MESSAGE
  // ============================================================================
  async retryMessage(id: string): Promise<WhatsAppQueueItem> {
    const item = this.inMemoryQueue.get(id);
    if (!item) {
      throw new AppError('Queue message not found', 404, 'RESOURCE_NOT_FOUND');
    }

    // Reset status to PENDING and trigger processing (re-running all 10 checks)
    item.status = 'PENDING';
    item.failure_reason = null;
    item.updated_at = new Date().toISOString();

    await this.processItem(item);
    return this.inMemoryQueue.get(id) || item;
  }

  // ============================================================================
  // 5. STATUS UPDATES & AUDIT LOGGING
  // ============================================================================
  private async updateItemStatus(id: string, status: WhatsAppQueueStatus) {
    const item = this.inMemoryQueue.get(id);
    if (item) {
      item.status = status;
      item.updated_at = new Date().toISOString();
    }

    if (this.supabase) {
      try {
        await this.supabase.from('whatsapp_queue').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
      } catch {
        // Table not present
      }
    }
  }

  private async markItemSent(id: string, providerMessageId: string, finalStatus: WhatsAppQueueStatus = 'SENT') {
    const now = new Date().toISOString();
    const item = this.inMemoryQueue.get(id);
    if (item) {
      item.status = finalStatus;
      item.sent_at = now;
      item.provider_message_id = providerMessageId;
      item.attempts += 1;
      item.updated_at = now;
    }

    // Update in Supabase queue table if present
    if (this.supabase) {
      try {
        await this.supabase
          .from('whatsapp_queue')
          .update({
            status: finalStatus,
            sent_at: now,
            provider_message_id: providerMessageId,
            attempts: item ? item.attempts : 1,
            updated_at: now,
          })
          .eq('id', id);
      } catch {
        // Ignored
      }

      // Record in whatsapp_messages audit outbox log
      if (item) {
        try {
          await this.supabase.from('whatsapp_messages').insert({
            template_id: item.template_id,
            student_id: item.student_id,
            recipient_phone: item.recipient_phone,
            event_type: item.event_type,
            message_body: item.message_body,
            provider_message_id: providerMessageId,
            status: (finalStatus as string) === 'MOCK' ? 'MOCK' : 'SENT',
            sent_at: now,
          });
        } catch (e: any) {
          console.warn('[QueueService] Notice: could not insert into whatsapp_messages:', e.message);
        }
      }
    }
  }

  private async markItemFailed(id: string, reason: string, countAsAttempt: boolean) {
    const now = new Date().toISOString();
    const item = this.inMemoryQueue.get(id);
    if (item) {
      if (countAsAttempt) {
        item.attempts += 1;
        item.status = 'FAILED';
      }
      item.failure_reason = reason;
      (item as any).error_message = reason;
      item.updated_at = now;
    }

    if (this.supabase && item) {
      try {
        await this.supabase
          .from('whatsapp_queue')
          .update({
            status: item.status,
            failure_reason: reason,
            attempts: item.attempts,
            updated_at: now,
          })
          .eq('id', id);
      } catch {
        // Ignored
      }

      // Record in whatsapp_messages log on permanent failure
      if (item.status === 'FAILED') {
        try {
          await this.supabase.from('whatsapp_messages').insert({
            template_id: item.template_id,
            student_id: item.student_id,
            recipient_phone: item.recipient_phone,
            event_type: item.event_type,
            message_body: item.message_body,
            status: 'FAILED',
            error_message: reason,
          });
        } catch {
          // Ignored
        }
      }
    }
  }

  // ============================================================================
  // 6. QUERY & STATS
  // ============================================================================
  async listQueue(filters: QueueFilterQuery = {}): Promise<WhatsAppQueueItem[]> {
    let items = Array.from(this.inMemoryQueue.values());

    if (filters.status) {
      items = items.filter((i) => i.status === filters.status);
    }
    if (filters.recipientPhone) {
      items = items.filter((i) => i.recipient_phone.includes(filters.recipientPhone!));
    }
    if (filters.studentId) {
      items = items.filter((i) => i.student_id === filters.studentId);
    }
    if (filters.eventType) {
      items = items.filter((i) => i.event_type === filters.eventType);
    }

    // Sort descending by created_at
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (filters.limit) {
      items = items.slice(0, filters.limit);
    }

    return items;
  }

  getPendingCount(): number {
    return Array.from(this.inMemoryQueue.values()).filter((i) => i.status === 'PENDING').length;
  }

  async getTodayStats(): Promise<TodayStats> {
    const settings = await whatsappSettingsService.getSettings();
    const today = new Date().toISOString().split('T')[0];

    const items = Array.from(this.inMemoryQueue.values());
    const sentToday = items.filter((i) => (i.status === 'SENT' || (i.status as string) === 'MOCK') && i.sent_at?.startsWith(today)).length;
    const pending = items.filter((i) => i.status === 'PENDING').length;
    const processing = items.filter((i) => i.status === 'PROCESSING').length;
    const failedToday = items.filter((i) => i.status === 'FAILED' && i.updated_at.startsWith(today)).length;

    return {
      sent: sentToday,
      pending,
      processing,
      failed: failedToday,
      dailyLimit: settings.daily_limit,
      remainingDailyLimit: Math.max(0, settings.daily_limit - sentToday),
    };
  }
}

export const queueService = new WhatsAppQueueService();
