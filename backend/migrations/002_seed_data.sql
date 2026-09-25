-- 002_seed_data.sql
-- Academy CRM V1 MVP Seed Data for Development & Initial Setup

-- 1. Academy Branding / Settings (Single V1 Record)
INSERT INTO academy_settings (
    academy_name,
    logo_url,
    phone,
    email,
    address,
    website,
    currency
) VALUES (
    'Apex Academy of Science & Commerce',
    NULL,
    '+91 98765 43210',
    'contact@apexacademy.in',
    '101, Knowledge Park, Education Hub, Mumbai, India',
    'https://apexacademy.in',
    'INR'
) ON CONFLICT DO NOTHING;

-- 2. Standard WhatsApp Notification Templates
INSERT INTO whatsapp_templates (name, event_type, body, active) VALUES
(
    'Student Absent Alert',
    'ATTENDANCE_ABSENT',
    'Dear {{parent_name}}, your ward {{student_name}} was marked ABSENT today ({{date}}) in batch {{batch_name}} at {{academy_name}}. Please contact us if you were unaware.',
    true
),
(
    'Upcoming Fee Reminder',
    'FEE_UPCOMING',
    'Hello {{parent_name}}, this is a gentle reminder from {{academy_name}}. Monthly fee of Rs. {{amount}} for {{student_name}} (Batch: {{batch_name}}) is due on {{due_date}}. Pay here: {{payment_link}}',
    true
),
(
    'Fee Due Today',
    'FEE_DUE',
    'Notice: Fee of Rs. {{amount}} for {{student_name}} is DUE TODAY ({{due_date}}) at {{academy_name}}. Kindly complete payment at your earliest convenience: {{payment_link}}',
    true
),
(
    'Fee Overdue Notice',
    'FEE_OVERDUE',
    'Urgent: Fee payment of Rs. {{amount}} for {{student_name}} is OVERDUE since {{due_date}} at {{academy_name}}. Please settle the dues promptly using {{payment_link}} or contact the office.',
    true
),
(
    'Payment Success & Receipt Confirmation',
    'PAYMENT_SUCCESS',
    'Thank you {{parent_name}}! Payment of Rs. {{amount}} for {{student_name}} has been received successfully on {{date}} at {{academy_name}}. Receipt has been generated.',
    true
),
(
    'Batch Announcement Broadcast',
    'ANNOUNCEMENT',
    'Announcement from {{academy_name}} for {{batch_name}}: {{message}} — Sent on {{date}}.',
    true
) ON CONFLICT DO NOTHING;

-- 3. Default Fee Plans
INSERT INTO fee_plans (name, amount, frequency, due_day, active) VALUES
('Standard Class 10 Science & Math', 3500.00, 'MONTHLY', 5, true),
('Class 12 Physics & Chemistry Crash Course', 5000.00, 'MONTHLY', 5, true),
('Annual Commerce Foundation Package', 12000.00, 'QUARTERLY', 10, true)
ON CONFLICT DO NOTHING;
