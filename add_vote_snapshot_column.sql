
-- Add vote_snapshot column to agendas table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agendas' AND column_name = 'vote_snapshot') THEN
        ALTER TABLE agendas ADD COLUMN vote_snapshot JSONB;
    END IF;
END $$;
