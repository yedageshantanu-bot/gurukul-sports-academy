export type Role = 'ADMIN' | 'TEACHER' | 'DEMO_ADMIN';

export interface UserProfile {
  userId: string;
  profileId: string;
  email: string;
  fullName: string;
  role: Role;
  teacherId?: string;
  isTrial?: boolean;
  trialExpiresAt?: string;
  daysRemaining?: number;
}

export interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  role: Role | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ role: Role }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}
