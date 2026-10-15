import { z } from 'zod';

export const updateAcademySettingsSchema = z.object({
  academy_name: z.string().min(1, 'Academy name cannot be empty').max(100, 'Academy name too long').optional(),
  logo_url: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email('Invalid email address').nullable().optional().or(z.literal('')),
  address: z.string().nullable().optional(),
  website: z.string().nullable().optional().or(z.literal('')),
  currency: z.string().max(10).optional(),
  upi_id: z.string().nullable().optional(),
  upi_payee_name: z.string().nullable().optional(),
});

export type UpdateAcademySettingsDTO = z.infer<typeof updateAcademySettingsSchema>;

export interface AcademySettingsResponse {
  id: string;
  academy_name: string;
  logo_url?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  website?: string | null;
  currency: string;
  upi_id?: string | null;
  upi_payee_name?: string | null;
  created_at: string;
  updated_at: string;
}
