-- 004_attendance_correction_audit.sql
-- Non-destructive migration to add attendance audit tracking and correction template

-- 1. Add audit columns to attendance table if they do not already exist
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS corrected_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Add index for fast lookup of attendance dates and corrections
CREATE INDEX IF NOT EXISTS idx_attendance_corrected_at ON attendance(corrected_at);

-- 3. Ensure ATTENDANCE_CORRECTION template exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM whatsapp_templates WHERE event_type = 'ATTENDANCE_CORRECTION'
    ) THEN
        INSERT INTO whatsapp_templates (name, event_type, body, active)
        VALUES (
            'Attendance Correction Alert',
            'ATTENDANCE_CORRECTION',
            'Dear {{parent_name}}, {{student_name}} was marked absent earlier today but has now arrived and is attending the class in batch {{batch_name}}. This attendance has been updated to Present.',
            true
        );
    END IF;
END $$;
