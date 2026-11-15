import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin, supabaseDemoClient } from '../config/supabase.js';
import { AppError } from './errorHandler.js';
import { ROLES, STATUS } from '../constants/index.js';
import { AuthenticatedUser } from '../types/auth.types.js';
import { requestContext } from '../config/requestContext.js';

interface CachedAuthData {
  userContext: AuthenticatedUser;
  expiresAt: number;
}

// In-memory cache of verified tokens to eliminate redundant Supabase network roundtrips,
// prevent rate-limiting (HTTP 429) during parallel dashboard/fees/payments requests,
// and speed up endpoint latency from 400ms to <1ms.
const tokenCache = new Map<string, CachedAuthData>();

// Background cleanup of expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of tokenCache.entries()) {
    if (now > val.expiresAt) {
      tokenCache.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

function getJwtExp(jwt: string): number | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export const verifyAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    // 1. Check for Authorization header, or fallback to query parameter token (for window.open PDF views)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && typeof req.query.token === 'string' && req.query.token.trim()) {
      token = req.query.token.trim();
    }

    if (!token) {
      throw new AppError('Missing or malformed Authorization token. Expected Bearer header or token query parameter.', 401, 'UNAUTHORIZED');
    }

    // 2. Pre-validate JWT expiration locally
    const jwtExp = getJwtExp(token);
    if (jwtExp !== null && Date.now() >= jwtExp) {
      throw new AppError('Invalid, expired, or revoked authentication token.', 401, 'UNAUTHORIZED');
    }

    // 3. Fast-path: Check verified in-memory token cache
    const cached = tokenCache.get(token);
    if (cached && Date.now() < cached.expiresAt) {
      req.user = cached.userContext;
      const store = requestContext.getStore();
      if (store) {
        store.user = cached.userContext;
      }
      return next();
    }

    // 4. Ensure Supabase admin client is available
    if (!supabaseAdmin) {
      throw new AppError('Supabase is not configured on the server.', 500, 'INTERNAL_SERVER_ERROR');
    }

    // 5. Verify Supabase JWT using official Supabase Auth getUser API
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData.user) {
      throw new AppError('Invalid, expired, or revoked authentication token.', 401, 'UNAUTHORIZED');
    }

    const authUserId = authData.user.id;

    // 6. Retrieve user profile (check public schema first, demo schema fallback)
    let profile: any = null;
    const { data: pubProfile, error: pubProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, full_name, email, phone, status, is_trial, trial_started_at, trial_expires_at')
      .eq('id', authUserId)
      .maybeSingle();

    if (!pubProfileError && pubProfile) {
      profile = pubProfile;
    }

    if (!profile && supabaseDemoClient) {
      const { data: demoProfile } = await supabaseDemoClient
        .from('profiles')
        .select('id, role, full_name, email, phone, status, is_trial, trial_started_at, trial_expires_at')
        .eq('id', authUserId)
        .maybeSingle();

      if (demoProfile) {
        profile = demoProfile;
      }
    }

    if (!profile) {
      throw new AppError('User profile not found in academy records.', 401, 'UNAUTHORIZED');
    }

    // 7. Check account status
    if (profile.status !== STATUS.ACTIVE) {
      throw new AppError('User account is currently deactivated.', 403, 'FORBIDDEN');
    }

    // 8. Server-side 3-Day Trial Expiry Enforcement
    const isTrialUser = Boolean(profile.is_trial || profile.role === ROLES.DEMO_ADMIN);
    let daysRemaining: number | undefined = undefined;

    if (isTrialUser && profile.trial_expires_at) {
      const expiresAtTime = new Date(profile.trial_expires_at).getTime();
      const currentTime = Date.now();

      if (currentTime > expiresAtTime) {
        throw new AppError(
          'Your 3-day trial has ended. Please contact us to continue using Academy CRM.',
          403,
          'TRIAL_EXPIRED'
        );
      }

      const diffMs = expiresAtTime - currentTime;
      daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    // 9. If role is TEACHER, resolve teacherId from teachers table
    let teacherId: string | undefined = undefined;

    if (profile.role === ROLES.TEACHER) {
      const { data: teacher, error: teacherError } = await supabaseAdmin
        .from('teachers')
        .select('id, status')
        .eq('profile_id', authUserId)
        .single();

      if (teacherError || !teacher) {
        throw new AppError('Teacher record not found for this profile.', 403, 'FORBIDDEN');
      }

      if (teacher.status !== STATUS.ACTIVE) {
        throw new AppError('Teacher record is inactive.', 403, 'FORBIDDEN');
      }

      teacherId = teacher.id;
    }

    // 10. If role is STUDENT, resolve studentId from auth user metadata or matching student record
    let studentId: string | undefined = undefined;

    if (profile.role === ROLES.STUDENT) {
      let resolvedStudentId = authData.user.user_metadata?.student_id;
      let studentRecord: any = null;

      if (resolvedStudentId) {
        const { data: s } = await supabaseAdmin
          .from('students')
          .select('id, status')
          .eq('id', resolvedStudentId)
          .maybeSingle();
        studentRecord = s;
      }

      if (!studentRecord) {
        const digits = ((profile as any).phone || authData.user.phone || '').replace(/\D/g, '').slice(-10);
        if (digits) {
          const { data: fallbackList } = await supabaseAdmin
            .from('students')
            .select('id, status')
            .or(`student_mobile.ilike.%${digits}%,parent_whatsapp.ilike.%${digits}%`)
            .limit(1);
          studentRecord = fallbackList?.[0] || null;
        }
      }

      if (!studentRecord) {
        throw new AppError('Student record not found for this profile.', 403, 'FORBIDDEN');
      }

      if (studentRecord.status !== STATUS.ACTIVE) {
        throw new AppError('Student record is inactive.', 403, 'FORBIDDEN');
      }

      studentId = studentRecord.id;
    }

    const isDemoOrigin =
      req.headers['x-demo-mode'] === 'true' ||
      Boolean(typeof req.headers['origin'] === 'string' && (req.headers['origin'].includes('effort-career') || req.headers['origin'].includes('demo'))) ||
      Boolean(typeof req.headers['referer'] === 'string' && (req.headers['referer'].includes('effort-career') || req.headers['referer'].includes('demo')));

    // 11. Attach validated context to request (Never trust frontend-supplied values)
    const userContext: AuthenticatedUser = {
      userId: authUserId,
      profileId: profile.id,
      role: isDemoOrigin ? ROLES.DEMO_ADMIN : profile.role,
      teacherId,
      studentId,
      email: profile.email,
      fullName: isDemoOrigin && profile.role === ROLES.ADMIN ? 'Effort Admin' : profile.full_name,
      isTrial: isTrialUser || isDemoOrigin,
      trialExpiresAt: profile.trial_expires_at || undefined,
      daysRemaining,
    };

    // 12. Cache verified user context for 60 seconds (or until JWT expires)
    const cacheTtlMs = 60 * 1000;
    const maxCacheUntil = jwtExp ? Math.min(Date.now() + cacheTtlMs, jwtExp - 5000) : Date.now() + cacheTtlMs;
    if (maxCacheUntil > Date.now()) {
      tokenCache.set(token, {
        userContext,
        expiresAt: maxCacheUntil,
      });
    }

    req.user = userContext;

    const store = requestContext.getStore();
    if (store) {
      store.user = userContext;
    }

    next();
  } catch (error) {
    next(error);
  }
};
