-- 003_demo_isolated_schema.sql
-- Dedicated isolated 'demo' PostgreSQL schema for Effort Career Classes 3-Day Trial
-- Completely partitions trial data from production 'public.*' tables

-- 1. Ensure profiles table supports trial metadata and DEMO_ADMIN role
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_trial BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ NULL;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('ADMIN', 'TEACHER', 'DEMO_ADMIN'));

-- 2. Create dedicated demo schema
CREATE SCHEMA IF NOT EXISTS demo;

-- 3. academy_settings in demo schema
CREATE TABLE IF NOT EXISTS demo.academy_settings (
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

-- 4. teachers in demo schema
CREATE TABLE IF NOT EXISTS demo.teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID UNIQUE NULL,
    name TEXT NULL,
    email TEXT NULL,
    phone TEXT NULL,
    subject TEXT NULL,
    username TEXT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. students in demo schema
CREATE TABLE IF NOT EXISTS demo.students (
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
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. batches in demo schema
CREATE TABLE IF NOT EXISTS demo.batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subject TEXT NULL,
    schedule_days TEXT[] NOT NULL DEFAULT '{}',
    start_time TIME NULL,
    end_time TIME NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. batch_students
CREATE TABLE IF NOT EXISTS demo.batch_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES demo.batches(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES demo.students(id) ON DELETE CASCADE,
    joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (batch_id, student_id)
);

-- 8. batch_teachers
CREATE TABLE IF NOT EXISTS demo.batch_teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES demo.batches(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES demo.teachers(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (batch_id, teacher_id)
);

-- 9. attendance
CREATE TABLE IF NOT EXISTS demo.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES demo.students(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES demo.batches(id) ON DELETE CASCADE,
    teacher_id UUID NULL,
    attendance_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT')),
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, batch_id, attendance_date)
);

-- 10. fee_plans
CREATE TABLE IF NOT EXISTS demo.fee_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'MONTHLY' CHECK (frequency IN ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'ONE_TIME')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. student_fees
CREATE TABLE IF NOT EXISTS demo.student_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES demo.students(id) ON DELETE CASCADE,
    fee_plan_id UUID NULL REFERENCES demo.fee_plans(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL,
    due_date DATE NOT NULL,
    month_year TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE')),
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, month_year)
);

-- 12. payments
CREATE TABLE IF NOT EXISTS demo.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES demo.students(id) ON DELETE CASCADE,
    student_fee_id UUID NULL REFERENCES demo.student_fees(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_mode TEXT NOT NULL DEFAULT 'CASH' CHECK (payment_mode IN ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE')),
    reference_number TEXT NULL,
    status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'PENDING', 'FAILED')),
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. announcements
CREATE TABLE IF NOT EXISTS demo.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    created_by UUID NULL,
    status TEXT NOT NULL DEFAULT 'SENT' CHECK (status IN ('DRAFT', 'SENT')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. announcement_batches
CREATE TABLE IF NOT EXISTS demo.announcement_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES demo.announcements(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES demo.batches(id) ON DELETE CASCADE,
    UNIQUE (announcement_id, batch_id)
);

-- 15. receipts
CREATE TABLE IF NOT EXISTS demo.receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number TEXT NOT NULL UNIQUE,
    payment_id UUID NOT NULL REFERENCES demo.payments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES demo.students(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    pdf_url TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_demo_students_status ON demo.students(status);
CREATE INDEX IF NOT EXISTS idx_demo_batches_status ON demo.batches(status);
CREATE INDEX IF NOT EXISTS idx_demo_batch_students_batch ON demo.batch_students(batch_id);
CREATE INDEX IF NOT EXISTS idx_demo_batch_students_student ON demo.batch_students(student_id);
CREATE INDEX IF NOT EXISTS idx_demo_attendance_date ON demo.attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_demo_attendance_batch_date ON demo.attendance(batch_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_demo_student_fees_status_due ON demo.student_fees(status, due_date);
CREATE INDEX IF NOT EXISTS idx_demo_payments_student_created ON demo.payments(student_id, created_at);

-- Enable RLS
ALTER TABLE demo.academy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.batch_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.batch_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.fee_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.announcement_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo.receipts ENABLE ROW LEVEL SECURITY;
