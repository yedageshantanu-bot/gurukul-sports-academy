-- 003_whatsapp_automation_phase1.sql
-- WhatsApp Automation Phase 1: Linked-Device Prototype + Queue + Settings Schema Migration

-- 1. Extend students table with whatsapp_opt_in consent flag
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN NOT NULL DEFAULT true;

-- 2. Create whatsapp_settings table for single-academy global automation controls
CREATE TABLE IF NOT EXISTS whatsapp_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    global_automation_enabled BOOLEAN NOT NULL DEFAULT true,
    emergency_stop BOOLEAN NOT NULL DEFAULT false,
    daily_limit INTEGER NOT NULL DEFAULT 40 CHECK (daily_limit >= 1 AND daily_limit <= 1000),
    provider_type TEXT NOT NULL DEFAULT 'mock' CHECK (provider_type IN ('mock', 'prototype_linked_device', 'meta')),
    device_phone_number TEXT NULL,
    device_status TEXT NOT NULL DEFAULT 'NOT_CONFIGURED' CHECK (device_status IN ('NOT_CONFIGURED', 'DISCONNECTED', 'CONNECTING', 'CONNECTED', 'ERROR')),
    last_connected_at TIMESTAMPTZ NULL,
    last_heartbeat_at TIMESTAMPTZ NULL,
    session_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed single default row if empty
INSERT INTO whatsapp_settings (
    global_automation_enabled,
    emergency_stop,
    daily_limit,
    provider_type,
    device_status
) VALUES (
    true,
    false,
    40,
    'mock',
    'NOT_CONFIGURED'
) ON CONFLICT DO NOTHING;

-- 3. Create whatsapp_queue table for transactional message queue
CREATE TABLE IF NOT EXISTS whatsapp_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_phone TEXT NOT NULL,
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    template_id UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    message_body TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    sent_at TIMESTAMPTZ NULL,
    failure_reason TEXT NULL,
    idempotency_key TEXT UNIQUE NULL,
    provider_message_id TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient queue polling and deduplication
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_status_scheduled ON whatsapp_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_recipient_status ON whatsapp_queue(recipient_phone, status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_idempotency_key ON whatsapp_queue(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_students_whatsapp_opt_in ON students(whatsapp_opt_in);

-- Enable RLS (Service role on backend bypasses RLS)
ALTER TABLE whatsapp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_queue ENABLE ROW LEVEL SECURITY;
