-- 006_whatsapp_auth_state.sql
-- Baileys WhatsApp Database-Backed Multi-Device Auth State
-- Persists credentials and signal cryptographic keys to Supabase Postgres
-- Eliminates ephemeral container session wipe on Render Free Tier restarts/redeploys

CREATE TABLE IF NOT EXISTS public.whatsapp_auth_state (
    session_id TEXT NOT NULL,
    key_id TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (session_id, key_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_auth_state_session ON public.whatsapp_auth_state(session_id);

-- Enable RLS and grant service role full access
ALTER TABLE public.whatsapp_auth_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'whatsapp_auth_state' 
        AND policyname = 'Service role full access on whatsapp_auth_state'
    ) THEN
        CREATE POLICY "Service role full access on whatsapp_auth_state"
            ON public.whatsapp_auth_state
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;
