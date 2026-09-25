export interface AcademySettings {
  id: string;
  academy_name: string;
  logo_url?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  website?: string | null;
  currency: string;
  created_at?: string;
  updated_at?: string;
}
