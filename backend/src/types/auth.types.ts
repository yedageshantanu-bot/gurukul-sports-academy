import { Role } from '../constants/index.js';

export interface AuthenticatedUser {
  userId: string;
  profileId: string;
  role: Role;
  teacherId?: string;
  email: string;
  fullName: string;
  isTrial?: boolean;
  trialExpiresAt?: string;
  daysRemaining?: number;
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface PasswordResetDTO {
  email: string;
}
