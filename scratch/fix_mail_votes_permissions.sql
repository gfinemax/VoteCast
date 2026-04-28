
-- Ensure mail_election_votes is accessible
ALTER TABLE IF EXISTS mail_election_votes DISABLE ROW LEVEL SECURITY;
GRANT ALL ON mail_election_votes TO anon, authenticated, service_role;

-- Also ensure the columns match what we expect
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mail_election_votes' AND column_name='member_id') THEN
        ALTER TABLE mail_election_votes ADD COLUMN member_id INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mail_election_votes' AND column_name='meeting_id') THEN
        ALTER TABLE mail_election_votes ADD COLUMN meeting_id INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mail_election_votes' AND column_name='agenda_id') THEN
        ALTER TABLE mail_election_votes ADD COLUMN agenda_id INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mail_election_votes' AND column_name='choice') THEN
        ALTER TABLE mail_election_votes ADD COLUMN choice TEXT;
    END IF;
END $$;
