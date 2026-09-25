import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from './errorHandler.js';
import { ROLES, STATUS } from '../constants/index.js';
import { AuthenticatedUser } from '../types/auth.types.js';
import { requestContext } from '../config/requestContext.js';

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

    // 2. Ensure Supabase admin client is available
    if (!supabaseAdmin) {
      throw new AppError('Supabase is not configured on the server.', 500, 'INTERNAL_SERVER_ERROR');
    }

    // 3. Verify Supabase JWT using official Supabase Auth getUser API
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData.user) {
      throw new AppError('Invalid, expired, or revoked authentication token.', 401, 'UNAUTHORIZED');
    }

    const authUserId = authData.user.id;

    // 4. Retrieve user profile from the database
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, full_name, email, status, is_trial, trial_started_at, trial_expires_at')
      .eq('id', authUserId)
      .single();

    if (profileError || !profile) {
      throw new AppError('User profile not found in academy records.', 401, 'UNAUTHORIZED');
    }

    // 5. Check account status
    if (profile.status !== STATUS.ACTIVE) {
      throw new AppError('User account is currently deactivated.', 403, 'FORBIDDEN');
    }

    // 6. Server-side 3-Day Trial Expiry Enforcement
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

    // 7. If role is TEACHER, resolve teacherId from teachers table
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

    const isDemoOrigin =
      req.headers['x-demo-mode'] === 'true' ||
      Boolean(typeof req.headers['origin'] === 'string' && (req.headers['origin'].includes('effort-career') || req.headers['origin'].includes('demo'))) ||
      Boolean(typeof req.headers['referer'] === 'string' && (req.headers['referer'].includes('effort-career') || req.headers['referer'].includes('demo')));

    // 8. Attach validated context to request (Never trust frontend-supplied values)
    const userContext: AuthenticatedUser = {
      userId: authUserId,
      profileId: profile.id,
      role: isDemoOrigin ? ROLES.DEMO_ADMIN : profile.role,
      teacherId,
      email: profile.email,
      fullName: isDemoOrigin && profile.role === ROLES.ADMIN ? 'Effort Admin' : profile.full_name,
      isTrial: isTrialUser || isDemoOrigin,
      trialExpiresAt: profile.trial_expires_at || undefined,
      daysRemaining,
    };

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
