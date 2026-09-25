import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import teacherRoutes from './routes/teacher.routes.js';
import studentRoutes from './routes/student.routes.js';
import batchRoutes from './routes/batch.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import feeRoutes from './routes/fee.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import whatsappRoutes from './routes/whatsapp.routes.js';
import reportRoutes from './routes/report.routes.js';
import announcementRoutes from './routes/announcement.routes.js';
import receiptRoutes from './routes/receipt.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import publicationRoutes from './routes/publication.routes.js';
import tournamentRoutes from './routes/tournament.routes.js';
import rankRoutes from './routes/rank.routes.js';
import { verifyAuth } from './middlewares/auth.middleware.js';
import { requireRole } from './middlewares/rbac.middleware.js';
import { ROLES } from './constants/index.js';
import { requestContext } from './config/requestContext.js';

const app = express();

// AsyncLocalStorage request context wrapper for schema isolation
app.use((_req, _res, next) => {
  requestContext.run({}, () => next());
});

// CORS configuration with production origin whitelisting
const allowedOrigins = env.APP_URL
  ? env.APP_URL.split(',').map((o) => o.trim().replace(/\/+$/, ''))
  : ['http://localhost:3000'];

app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(cors({
  origin: (origin, callback) => {
    // In non-production or server-to-server / curl requests without origin header, allow
    if (env.NODE_ENV !== 'production' || !origin) {
      return callback(null, true);
    }
    const cleanOrigin = origin.replace(/\/+$/, '');
    if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    if (cleanOrigin.startsWith('http://localhost:') || cleanOrigin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
    if (/^https:\/\/.*\.onrender\.com$/.test(cleanOrigin)) {
      return callback(null, true);
    }
    if (/\.pages\.dev$/.test(cleanOrigin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy does not allow access from origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Normalize URL pathname to eliminate duplicate consecutive slashes
app.use((req: Request, _res: Response, next) => {
  if (req.url && req.url.includes('//')) {
    const [pathname, ...queryParts] = req.url.split('?');
    const cleanPath = pathname.replace(/\/{2,}/g, '/');
    req.url = queryParts.length > 0 ? `${cleanPath}?${queryParts.join('?')}` : cleanPath;
  }
  if (req.originalUrl && req.originalUrl.includes('//')) {
    const [pathname, ...queryParts] = req.originalUrl.split('?');
    const cleanPath = pathname.replace(/\/{2,}/g, '/');
    req.originalUrl = queryParts.length > 0 ? `${cleanPath}?${queryParts.join('?')}` : cleanPath;
  }
  next();
});

// Request logger
app.use((req: Request, _res: Response, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// Root discovery endpoint
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    service: 'Academy CRM Backend API',
    health: '/api/health',
  });
});

// Health check endpoints (both /health and /api/health)
app.get(['/health', '/api/health'], (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    service: 'Academy CRM Backend API',
  });
});

// Mount CRM API routes
app.use('/api/auth', authRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/publications', publicationRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/ranks', rankRoutes);

// Test RBAC endpoints (used to verify role gates in tests/acceptance)
app.get('/api/test/admin-only', verifyAuth, requireRole(ROLES.ADMIN), (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the admin protected area',
    user: req.user,
  });
});

app.get('/api/test/teacher-only', verifyAuth, requireRole(ROLES.TEACHER), (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the teacher protected area',
    user: req.user,
  });
});

// Centralized error handling
app.use(errorHandler);

export default app;
