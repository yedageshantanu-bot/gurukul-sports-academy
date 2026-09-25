import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin, getPublicClient, getDemoClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../middlewares/errorHandler.js';
import { ROLES, STATUS } from '../constants/index.js';
import { LoginDTO, PasswordResetDTO } from '../types/auth.types.js';

export class AuthService {
  /**
   * Authenticate user with Supabase Auth and resolve profile/role
   */
  async login({ email, password }: LoginDTO) {
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      throw new AppError('Supabase is not configured on the server.', 500, 'INTERNAL_SERVER_ERROR');
    }

    // Authenticate with dedicated client to avoid mutating the service_role client headers
    const authClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.session || !authData.user) {
      throw new AppError(authError?.message || 'Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    const authUserId = authData.user.id;

    // Retrieve corresponding profile from public schema first, then demo schema fallback
    let profile: any = null;
    const pubClient = getPublicClient();
    if (pubClient) {
      const { data } = await pubClient
        .from('profiles')
        .select('id, role, full_name, email, status, is_trial, trial_started_at, trial_expires_at')
        .eq('id', authUserId)
        .maybeSingle();
      if (data) profile = data;
    }

    const demoClient = getDemoClient();
    if (!profile && demoClient) {
      const { data } = await demoClient
        .from('profiles')
        .select('id, role, full_name, email, status, is_trial, trial_started_at, trial_expires_at')
        .eq('id', authUserId)
        .maybeSingle();
      if (data) profile = data;
    }

    if (!profile) {
      throw new AppError('Profile record not found for authenticated user.', 401, 'UNAUTHORIZED');
    }

    if (profile.status !== STATUS.ACTIVE) {
      throw new AppError('Your account has been deactivated. Please contact the administrator.', 403, 'FORBIDDEN');
    }

    // Server-side 3-Day Trial Expiry Enforcement on Login
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

    // Resolve teacher ID if Teacher role
    let teacherId: string | undefined = undefined;

    if (profile.role === ROLES.TEACHER) {
      const { data: teacher } = await supabaseAdmin
        .from('teachers')
        .select('id')
        .eq('profile_id', authUserId)
        .single();

      teacherId = teacher?.id;
    }

    return {
      token: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      user: {
        id: authUserId,
        email: profile.email,
        fullName: profile.full_name,
        role: profile.role,
        teacherId,
        isTrial: isTrialUser,
        trialExpiresAt: profile.trial_expires_at || undefined,
        daysRemaining,
      },
    };
  }

  /**
   * Trigger password reset link through Supabase Auth
   */
  async requestPasswordReset({ email }: PasswordResetDTO) {
    if (!supabaseAdmin) {
      throw new AppError('Supabase is not configured on the server.', 500, 'INTERNAL_SERVER_ERROR');
    }

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email);

    if (error) {
      // Avoid revealing whether the email exists for security, but throw internal errors
      console.warn(`Password reset attempt for ${email} error: ${error.message}`);
    }

    return {
      message: 'If the provided email is registered, a password reset link has been dispatched.',
    };
  }
}

export const authService = new AuthService();
