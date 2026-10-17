import webpush from 'web-push';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';

export const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  'BC2noxfQupMkGe4h2SYxU_JxRBntSyHWUrdtjukh73ajbEv91kgvb2axAhca8pzb-tjstxWO0rPJP405vjBD9pU';

export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || 'on2d8Qg7yy0V37VWSZTH4oRI-IX9vpr57XsY7qZB92c';

export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:admin@gurukulsports.in';

// Initialize VAPID configuration
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  data?: any;
}

export class WebPushService {
  /**
   * Save Web Push subscription for authenticated user
   */
  async saveSubscription(userId: string, subscription: any) {
    if (!subscription || !subscription.endpoint) {
      throw new Error('Invalid push subscription: missing endpoint');
    }

    if (!supabaseAdmin) {
      throw new Error('Supabase client unavailable');
    }

    const { data: uData, error: uErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (uErr || !uData?.user) {
      throw new Error(`User not found: ${uErr?.message}`);
    }

    const currentMeta = uData.user.user_metadata || {};
    const existingSubs: any[] = currentMeta.push_subscriptions || [];

    // Filter out duplicate or stale subscriptions by endpoint
    const filteredSubs = existingSubs.filter((s) => s.endpoint !== subscription.endpoint);
    filteredSubs.push({
      ...subscription,
      savedAt: new Date().toISOString(),
    });

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...currentMeta,
        push_subscriptions: filteredSubs,
        push_enabled: true,
      },
    });

    if (updateErr) {
      throw new Error(`Failed to save push subscription: ${updateErr.message}`);
    }

    console.log(`[WebPush] Saved subscription for user ${userId} (${filteredSubs.length} active device(s))`);
    return { success: true, deviceCount: filteredSubs.length };
  }

  /**
   * Send push notification to a specific user by Auth User ID
   */
  async sendNotificationToUser(userId: string, payload: PushPayload) {
    if (!supabaseAdmin) return { sentCount: 0, failedCount: 0 };

    const { data: uData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const subscriptions: any[] = uData?.user?.user_metadata?.push_subscriptions || [];

    if (subscriptions.length === 0) {
      console.log(`[WebPush] No push subscriptions found for user ${userId}`);
      return { sentCount: 0, failedCount: 0 };
    }

    const jsonPayload = JSON.stringify({
      title: payload.title || 'Gurukul Sports Academy 🥋',
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/icon-192.png',
      url: payload.url || '/student/dashboard',
      data: payload.data || {},
    });

    let sentCount = 0;
    let failedCount = 0;
    const validSubs: any[] = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(sub, jsonPayload);
        sentCount++;
        validSubs.push(sub);
      } catch (err: any) {
        failedCount++;
        console.warn(`[WebPush] Failed to deliver push to endpoint ${sub.endpoint?.slice(0, 30)}...:`, err.statusCode || err.message);
        // Only keep subscription if not 410 (Gone) or 404 (Not Found)
        if (err.statusCode !== 410 && err.statusCode !== 404) {
          validSubs.push(sub);
        }
      }
    }

    // If any expired subscriptions were removed, update user metadata
    if (validSubs.length !== subscriptions.length) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...uData?.user?.user_metadata,
            push_subscriptions: validSubs,
          },
        });
      } catch {}
    }

    return { sentCount, failedCount };
  }

  /**
   * Send push notification to a student by Student Record ID
   */
  async sendNotificationToStudent(studentId: string, payload: PushPayload) {
    if (!supabaseAdmin) return { sentCount: 0, failedCount: 0 };

    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
    const targetUser = (usersData?.users || []).find(
      (u) => u.user_metadata?.student_id === studentId
    );

    if (!targetUser) {
      console.warn(`[WebPush] No auth account found for student ${studentId}`);
      return { sentCount: 0, failedCount: 0 };
    }

    return this.sendNotificationToUser(targetUser.id, payload);
  }

  /**
   * Broadcast push notification to all subscribed students
   */
  async broadcastToAllStudents(payload: PushPayload) {
    if (!supabaseAdmin) return { totalSent: 0 };

    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
    let totalSent = 0;

    for (const u of usersData?.users || []) {
      if (u.user_metadata?.push_subscriptions?.length > 0) {
        const res = await this.sendNotificationToUser(u.id, payload);
        totalSent += res.sentCount;
      }
    }

    return { totalSent };
  }
}

export const webPushService = new WebPushService();
