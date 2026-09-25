import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

// Resolve .env from backend directory or project root reliably
const currentEnvPath = path.resolve(process.cwd(), '.env');
const parentEnvPath = path.resolve(process.cwd(), '..', '.env');

if (fs.existsSync(currentEnvPath)) {
  dotenv.config({ path: currentEnvPath });
} else if (fs.existsSync(parentEnvPath)) {
  dotenv.config({ path: parentEnvPath });
} else {
  dotenv.config(); // fallback to default dotenv behavior
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_ENV: z.enum(['development', 'production', 'test', 'demo']).default('development'),
  DEMO_MODE: z.string().transform((v) => v === 'true').default('false'),
  WHATSAPP_ENABLED: z.string().transform((v) => v !== 'false').default('true'),
  DB_SCHEMA: z.string().default('public'),
  PORT: z.string().transform(Number).default('10000'),
  HOST: z.string().default('0.0.0.0'),
  APP_URL: z.string().default('http://localhost:3000'),
  SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  SUPABASE_ANON_KEY: z.string().optional().or(z.literal('')),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal('')),
  RAZORPAY_KEY_ID: z.string().optional().or(z.literal('')),
  RAZORPAY_KEY_SECRET: z.string().optional().or(z.literal('')),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().or(z.literal('')),
  WHATSAPP_PROVIDER: z.string().default('mock'),
  WHATSAPP_ACCESS_TOKEN: z.string().optional().or(z.literal('')),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().or(z.literal('')),
  WHATSAPP_VERIFY_TOKEN: z.string().optional().or(z.literal('')),
  WHATSAPP_LINKED_DEVICE_TOKEN: z.string().optional().or(z.literal('')),
  WHATSAPP_LINKED_DEVICE_URL: z.string().optional().or(z.literal('')),
  OPENWA_API_URL: z.string().optional().or(z.literal('')),
  OPENWA_API_KEY: z.string().optional().or(z.literal('')),
  WHATSAPP_DAILY_LIMIT: z.string().transform(Number).default('40'),
  // Development auth user seed credentials (optional, dev-only)
  DEV_ADMIN_EMAIL: z.string().email().optional().or(z.literal('')),
  DEV_ADMIN_PASSWORD: z.string().min(6).optional().or(z.literal('')),
  DEV_TEACHER_EMAIL: z.string().email().optional().or(z.literal('')),
  DEV_TEACHER_PASSWORD: z.string().min(6).optional().or(z.literal('')),
  // Demo client credentials
  DEMO_ADMIN_EMAIL: z.string().email().optional().or(z.literal('')),
  DEMO_ADMIN_PASSWORD: z.string().min(6).optional().or(z.literal('')),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Environment configuration validation failed');
}

export const env = parsed.data;
