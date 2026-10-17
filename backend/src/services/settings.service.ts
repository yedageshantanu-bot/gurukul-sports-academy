import { supabaseAdmin, getDb } from '../config/supabase.js';
import { AppError } from '../middlewares/errorHandler.js';
import { UpdateAcademySettingsDTO, AcademySettingsResponse } from '../types/settings.types.js';
import { AuthenticatedUser } from '../types/auth.types.js';
import { env } from '../config/env.js';
import { requestContext } from '../config/requestContext.js';
import { ROLES } from '../constants/index.js';
import { memoryCache } from '../utils/cache.js';

export class SettingsService {
  // ============================================================================
  // 1. GET ACADEMY SETTINGS
  // ============================================================================
  async getSettings(requestingUser?: AuthenticatedUser): Promise<AcademySettingsResponse> {
    const isDemo =
      env.DEMO_MODE ||
      env.APP_ENV === 'demo' ||
      requestingUser?.role === ROLES.DEMO_ADMIN ||
      requestingUser?.isTrial ||
      requestContext.getStore()?.user?.role === ROLES.DEMO_ADMIN ||
      requestContext.getStore()?.user?.isTrial;

    const cacheKey = `settings:${isDemo ? 'demo' : 'public'}`;
    const cached = memoryCache.get<AcademySettingsResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const db = getDb(requestingUser);
    const { data, error } = await db
      .from('academy_settings')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new AppError(`Failed to fetch academy settings: ${error.message}`, 500);
    }

    if (!data) {
      // Seed default settings row if table is completely empty
      const isDemo =
        env.DEMO_MODE ||
        env.APP_ENV === 'demo' ||
        requestingUser?.role === ROLES.DEMO_ADMIN ||
        requestingUser?.isTrial ||
        requestContext.getStore()?.user?.role === ROLES.DEMO_ADMIN ||
        requestContext.getStore()?.user?.isTrial;

      const { data: seeded, error: seedError } = await db
        .from('academy_settings')
        .insert(
          isDemo
            ? {
                academy_name: 'Effort Career Classes',
                logo_url: '/effort-career-logo.png',
                phone: '+918308510975',
                email: 'effortcareer1510@gmail.com',
                address: '3rd Floor, Arihant Mall, Near S. T. Stop, Ratnagiri, Maharashtra, India',
                website: 'https://www.effortcareerclasses.com',
                currency: 'INR',
              }
            : {
                academy_name: 'Gurukul Sports Academy',
                phone: '+91 70384 23366',
                email: 'contact@amitacademy.edu',
                address: '3rd Floor, Arihant Mall, Opposite Central Bus Stand, Ratnagiri, Maharashtra 415612',
                website: 'https://amitacademy.com',
                currency: 'INR',
              }
        )
        .select()
        .single();

      if (seedError || !seeded) {
        throw new AppError(`Failed to initialize academy settings: ${seedError?.message}`, 500);
      }

      memoryCache.set(cacheKey, seeded, 5 * 60 * 1000, ['settings']);
      return seeded;
    }

    memoryCache.set(cacheKey, data, 5 * 60 * 1000, ['settings']);
    return data;
  }

  // ============================================================================
  // 2. UPDATE ACADEMY SETTINGS (Admin Only)
  // ============================================================================
  async updateSettings(dto: UpdateAcademySettingsDTO, requestingUser?: AuthenticatedUser): Promise<AcademySettingsResponse> {
    const db = getDb(requestingUser);
    const current = await this.getSettings(requestingUser);

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.academy_name !== undefined) updatePayload.academy_name = dto.academy_name;
    if (dto.logo_url !== undefined) updatePayload.logo_url = dto.logo_url;
    if (dto.phone !== undefined) updatePayload.phone = dto.phone;
    if (dto.email !== undefined) updatePayload.email = dto.email;
    if (dto.address !== undefined) updatePayload.address = dto.address;
    if (dto.website !== undefined) updatePayload.website = dto.website;
    if (dto.currency !== undefined) updatePayload.currency = dto.currency;
    if (dto.upi_id !== undefined) updatePayload.upi_id = dto.upi_id;
    if (dto.upi_payee_name !== undefined) updatePayload.upi_payee_name = dto.upi_payee_name;

    const { data: updated, error } = await db
      .from('academy_settings')
      .update(updatePayload)
      .eq('id', current.id)
      .select()
      .single();

    if (error || !updated) {
      throw new AppError(`Failed to update academy settings: ${error?.message}`, 500);
    }

    // Invalidate cached settings
    memoryCache.invalidateTag('settings');

    return updated;
  }
}

export const settingsService = new SettingsService();
