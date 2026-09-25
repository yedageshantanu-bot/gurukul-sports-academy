-- ==============================================================================
-- ⚠️ GURUKUL SPORTS & MARTIAL ARTS ACADEMY — CLIENT PRODUCTION DATABASE SCHEMA
-- Target Instance: litnduotmypvhnorjnwa (Supabase PostgreSQL 17)
-- STRICT NOTICE: DO NOT DROP OR ALTER THIS SCHEMA WITHOUT EXPLICIT USER AUTHORIZATION
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ACADEMY SETTINGS
CREATE TABLE IF NOT EXISTS public.academy_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_name TEXT NOT NULL,
    logo_url TEXT NULL,
    phone TEXT NULL,
    email TEXT NULL,
    address TEXT NULL,
    website TEXT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. USER PROFILES (Linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'TEACHER', 'DEMO_ADMIN')),
    full_name TEXT NOT NULL,
    phone TEXT NULL,
    email TEXT NOT NULL,
    avatar_url TEXT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    is_trial BOOLEAN NOT NULL DEFAULT false,
    trial_started_at TIMESTAMPTZ NULL,
    trial_expires_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TEACHERS / SENSEIS
CREATE TABLE IF NOT EXISTS public.teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NULL,
    subject TEXT NULL,
    username TEXT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. STUDENTS / ATHLETES
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    parent_name TEXT NULL,
    student_mobile TEXT NULL,
    parent_whatsapp TEXT NULL,
    email TEXT NULL,
    course TEXT NULL,
    admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
    monthly_fee NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    fee_due_day INTEGER NOT NULL DEFAULT 5 CHECK (fee_due_day >= 1 AND fee_due_day <= 31),
    whatsapp_opt_in BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. BATCHES / TRAINING SQUADS
CREATE TABLE IF NOT EXISTS public.batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subject TEXT NULL,
    description TEXT NULL,
    monthly_fee NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    schedule_days TEXT[] NOT NULL DEFAULT '{}',
    start_time TIME NULL,
    end_time TIME NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. BATCH STUDENTS
CREATE TABLE IF NOT EXISTS public.batch_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    UNIQUE (batch_id, student_id)
);

-- 7. BATCH TEACHERS
CREATE TABLE IF NOT EXISTS public.batch_teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (batch_id, teacher_id)
);

-- 8. ATTENDANCE (Roll Call)
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    teacher_id UUID NULL REFERENCES public.teachers(id) ON DELETE SET NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT')),
    marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, batch_id, date)
);

-- 9. STUDENT FEES
CREATE TABLE IF NOT EXISTS public.student_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    billing_period TEXT NOT NULL, -- e.g. '2026-09'
    amount_due NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PAID', 'PENDING', 'OVERDUE', 'PARTIALLY_PAID')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, billing_period)
);

-- 10. PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_fee_id UUID REFERENCES public.student_fees(id) ON DELETE SET NULL,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'UPI' CHECK (payment_method IN ('UPI', 'CASH', 'RAZORPAY', 'BANK_TRANSFER', 'CHEQUE')),
    transaction_id TEXT NULL,
    payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'PENDING', 'FAILED')),
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    scope TEXT NOT NULL DEFAULT 'ALL' CHECK (scope IN ('ALL', 'SPECIFIC_BATCHES')),
    created_by UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.announcement_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    UNIQUE (announcement_id, batch_id)
);

-- 12. WHATSAPP SETTINGS & QUEUE
CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    global_automation_enabled BOOLEAN NOT NULL DEFAULT true,
    emergency_stop BOOLEAN NOT NULL DEFAULT false,
    daily_limit INTEGER NOT NULL DEFAULT 100 CHECK (daily_limit >= 1 AND daily_limit <= 1000),
    provider_type TEXT NOT NULL DEFAULT 'prototype_linked_device',
    device_phone_number TEXT NULL,
    device_status TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    last_connected_at TIMESTAMPTZ NULL,
    last_heartbeat_at TIMESTAMPTZ NULL,
    session_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_phone TEXT NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    message_body TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    sent_at TIMESTAMPTZ NULL,
    failure_reason TEXT NULL,
    idempotency_key TEXT UNIQUE NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_phone TEXT NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    message_body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SENT',
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- INITIAL SEED DATA FOR GURUKUL SPORTS & COMBAT ACADEMY
-- ==============================================================================

-- 1. Academy Settings
INSERT INTO public.academy_settings (
    academy_name, phone, email, address, website, currency, logo_url
) VALUES (
    'Gurukul Sports & Martial Arts Academy',
    '+91 98765 43210',
    'admin@gurukulsports.in',
    'Gurukul Combat Arena & Sports Complex, Athletics Track & Dojo, Pune, Maharashtra',
    'https://gurukulsports.in',
    'INR',
    '/logo.png'
);

-- 2. Link Admin Profile to Auth User
INSERT INTO public.profiles (
    id, role, full_name, email, phone, status, is_trial
) VALUES (
    '9416a851-87f6-4959-8efb-025b4ba9a17d',
    'ADMIN',
    'Gurukul Academy Admin',
    'admin@gurukulsports.in',
    '+91 98765 43210',
    'ACTIVE',
    false
) ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- 3. Link Teacher Profile to Auth User
INSERT INTO public.profiles (
    id, role, full_name, email, phone, status, is_trial
) VALUES (
    'f55a6f62-e2da-4750-a212-2b12ced55a34',
    'TEACHER',
    'Sensei Vikram Salunkhe',
    'teacher@gurukulsports.in',
    '+91 98220 11223',
    'ACTIVE',
    false
) ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- 4. Create Teacher Record
INSERT INTO public.teachers (
    id, profile_id, name, email, phone, subject, status
) VALUES (
    'f55a6f62-e2da-4750-a212-2b12ced55a34',
    'f55a6f62-e2da-4750-a212-2b12ced55a34',
    'Sensei Vikram Salunkhe',
    'teacher@gurukulsports.in',
    '+91 98220 11223',
    'Head Martial Arts & MMA Master (4th Dan)',
    'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

-- 5. Batches (Combat & Athletics)
INSERT INTO public.batches (
    id, name, subject, schedule_days, start_time, end_time, status, monthly_fee
) VALUES
('b1111111-1111-1111-1111-111111111111', 'MMA & Combat Sparring Squad', 'Mixed Martial Arts, Grappling & Sparring', ARRAY['Mon','Wed','Fri'], '06:00:00', '08:00:00', 'ACTIVE', 3500.00),
('b2222222-2222-2222-2222-222222222222', 'Karate & Taekwondo Black Belt Division', 'Kata, Kumite & Belt Progression', ARRAY['Tue','Thu','Sat'], '16:30:00', '18:30:00', 'ACTIVE', 2800.00),
('b3333333-3333-3333-3333-333333333333', 'Track & Sprint Speed Training Camp', '100m/200m Olympic Sprint Drills & Endurance', ARRAY['Mon','Tue','Wed','Thu','Fri','Sat'], '06:30:00', '08:30:00', 'ACTIVE', 3000.00),
('b4444444-4444-4444-4444-444444444444', 'Junior Athletics & Agility Foundation', 'Motor Skills, Reflexes & Multi-Sport Conditioning', ARRAY['Mon','Wed','Fri'], '17:00:00', '18:30:00', 'ACTIVE', 2500.00),
('b5555555-5555-5555-5555-555555555555', 'Boxing & Fight Conditioning Batch', 'Footwork, Heavy Bag, Sparring & Core Power', ARRAY['Mon','Wed','Fri','Sat'], '19:00:00', '21:00:00', 'ACTIVE', 3200.00)
ON CONFLICT (id) DO NOTHING;

-- Assign Teacher to All Batches
INSERT INTO public.batch_teachers (batch_id, teacher_id)
SELECT id, 'f55a6f62-e2da-4750-a212-2b12ced55a34' FROM public.batches
ON CONFLICT DO NOTHING;

-- 6. Athletes / Students
INSERT INTO public.students (
    id, name, parent_name, parent_whatsapp, student_mobile, email, course, monthly_fee, fee_due_day, status
) VALUES
('c1111111-1111-1111-1111-111111111111', 'Aarav Patil', 'Sanjay Patil', '+919876543201', '+919876543201', 'aarav.patil@example.com', 'Mixed Martial Arts', 3500.00, 5, 'ACTIVE'),
('c2222222-2222-2222-2222-222222222222', 'Rohan Kadam', 'Dattatray Kadam', '+919876543202', '+919876543202', 'rohan.kadam@example.com', 'Track & Sprinting', 3000.00, 10, 'ACTIVE'),
('c3333333-3333-3333-3333-333333333333', 'Ananya Deshmukh', 'Mahesh Deshmukh', '+919876543203', '+919876543203', 'ananya.deshmukh@example.com', 'Karate & Taekwondo', 2800.00, 5, 'ACTIVE'),
('c4444444-4444-4444-4444-444444444444', 'Siddharth Jadhav', 'Anil Jadhav', '+919876543204', '+919876543204', 'siddharth.jadhav@example.com', 'Boxing & Combat', 3200.00, 15, 'ACTIVE'),
('c5555555-5555-5555-5555-555555555555', 'Tanvi Shinde', 'Vikas Shinde', '+919876543205', '+919876543205', 'tanvi.shinde@example.com', 'Junior Athletics Foundation', 2500.00, 5, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- Enroll Athletes into Batches
INSERT INTO public.batch_students (batch_id, student_id) VALUES
('b1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111'),
('b3333333-3333-3333-3333-333333333333', 'c2222222-2222-2222-2222-222222222222'),
('b2222222-2222-2222-2222-222222222222', 'c3333333-3333-3333-3333-333333333333'),
('b5555555-5555-5555-5555-555555555555', 'c4444444-4444-4444-4444-444444444444'),
('b4444444-4444-4444-4444-444444444444', 'c5555555-5555-5555-5555-555555555555')
ON CONFLICT DO NOTHING;

-- 7. Student Fees for Current Month (2026-09)
INSERT INTO public.student_fees (
    id, student_id, billing_period, amount_due, amount_paid, due_date, status
) VALUES
('f1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', '2026-09', 3500.00, 3500.00, '2026-09-05', 'PAID'),
('f2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', '2026-09', 3000.00, 3000.00, '2026-09-10', 'PAID'),
('f3333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', '2026-09', 2800.00, 0.00, '2026-09-05', 'OVERDUE'),
('f4444444-4444-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444444', '2026-09', 3200.00, 0.00, '2026-09-15', 'PENDING'),
('f5555555-5555-5555-5555-555555555555', 'c5555555-5555-5555-5555-555555555555', '2026-09', 2500.00, 2500.00, '2026-09-05', 'PAID')
ON CONFLICT (student_id, billing_period) DO NOTHING;

-- 8. Payments
INSERT INTO public.payments (
    student_fee_id, student_id, amount, payment_method, status
) VALUES
('f1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 3500.00, 'UPI', 'SUCCESS'),
('f2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 3000.00, 'UPI', 'SUCCESS'),
('f5555555-5555-5555-5555-555555555555', 'c5555555-5555-5555-5555-555555555555', 2500.00, 'CASH', 'SUCCESS')
ON CONFLICT DO NOTHING;

-- 9. Today's Attendance
INSERT INTO public.attendance (
    student_id, batch_id, teacher_id, date, status
) VALUES
('c1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'f55a6f62-e2da-4750-a212-2b12ced55a34', CURRENT_DATE, 'PRESENT'),
('c3333333-3333-3333-3333-333333333333', 'b2222222-2222-2222-2222-222222222222', 'f55a6f62-e2da-4750-a212-2b12ced55a34', CURRENT_DATE, 'PRESENT')
ON CONFLICT (student_id, batch_id, date) DO NOTHING;

-- 10. Default WhatsApp Setting
INSERT INTO public.whatsapp_settings (
    global_automation_enabled, emergency_stop, daily_limit, provider_type, device_status
) VALUES (
    true, false, 100, 'prototype_linked_device', 'DISCONNECTED'
) ON CONFLICT DO NOTHING;
