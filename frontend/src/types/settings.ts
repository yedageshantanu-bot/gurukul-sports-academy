export interface AcademySettings {
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
  created_at?: string;
  updated_at?: string;
}
