import { Request, Response, NextFunction } from 'express';
import { Role } from '../constants/index.js';
import { AppError } from './errorHandler.js';

/**
 * Enforces role-based access control.
 * Rejects unauthenticated requests with 401.
 * Rejects unauthorized roles with 403.
 */
export const requireRole = (...allowedRoles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required to access this resource.', 401, 'UNAUTHORIZED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied. Requires one of [${allowedRoles.join(', ')}] role privileges.`,
          403,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
};
