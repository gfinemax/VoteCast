-- Create written_votes table
CREATE TABLE IF NOT EXISTS written_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
    meeting_id INTEGER REFERENCES agendas(id) ON DELETE CASCADE, -- Assuming Folders are in agendas table
    agenda_id INTEGER REFERENCES agendas(id) ON DELETE CASCADE,
    choice TEXT CHECK (choice IN ('yes', 'no', 'abstain')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_written_votes_member ON written_votes(member_id);
CREATE INDEX IF NOT EXISTS idx_written_votes_agenda ON written_votes(agenda_id);
