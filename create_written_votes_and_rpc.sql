-- 1. Create written_votes table
CREATE TABLE IF NOT EXISTS written_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
    meeting_id INTEGER REFERENCES agendas(id) ON DELETE CASCADE, 
    agenda_id INTEGER REFERENCES agendas(id) ON DELETE CASCADE,
    choice TEXT CHECK (choice IN ('yes', 'no', 'abstain')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS mail_election_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    meeting_id INTEGER NOT NULL REFERENCES agendas(id) ON DELETE CASCADE,
    agenda_id INTEGER NOT NULL REFERENCES agendas(id) ON DELETE CASCADE,
    choice TEXT NOT NULL CHECK (choice IN ('yes', 'no', 'abstain')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS has_election BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_written_votes_member ON written_votes(member_id);
CREATE INDEX IF NOT EXISTS idx_written_votes_agenda ON written_votes(agenda_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_written_votes_member_meeting_agenda
ON written_votes(member_id, meeting_id, agenda_id);
CREATE INDEX IF NOT EXISTS idx_mail_election_votes_member ON mail_election_votes(member_id);
CREATE INDEX IF NOT EXISTS idx_mail_election_votes_agenda ON mail_election_votes(agenda_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mail_election_votes_member_meeting_agenda
ON mail_election_votes(member_id, meeting_id, agenda_id);

-- 1.5 Split fixed written votes and editable onsite votes
ALTER TABLE agendas
ADD COLUMN IF NOT EXISTS written_yes INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS written_no INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS written_abstain INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS onsite_yes INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS onsite_no INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS onsite_abstain INTEGER NOT NULL DEFAULT 0;

-- 2. Create RPC function for transactional check-in
CREATE OR REPLACE FUNCTION check_in_member(
    p_member_id INTEGER,
    p_meeting_id INTEGER,
    p_type TEXT DEFAULT NULL,
    p_has_election BOOLEAN DEFAULT FALSE,
    p_proxy_name TEXT DEFAULT NULL,
    p_votes JSONB DEFAULT NULL,
    p_election_votes JSONB DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_vote JSONB;
    v_agenda_id INTEGER;
    v_choice TEXT;
BEGIN
    -- Insert Attendance
    INSERT INTO attendance (member_id, meeting_id, type, has_election, proxy_name)
    VALUES (p_member_id, p_meeting_id, p_type, COALESCE(p_has_election, FALSE), p_proxy_name);

    -- Process Votes if provided
    IF p_type = 'written' AND p_votes IS NOT NULL THEN
        FOR v_vote IN SELECT * FROM jsonb_array_elements(p_votes)
        LOOP
            v_agenda_id := (v_vote->>'agenda_id')::INTEGER;
            v_choice := v_vote->>'choice';

            IF NOT EXISTS (
                SELECT 1
                FROM agendas
                WHERE id = v_agenda_id
                  AND type <> 'election'
            ) THEN
                CONTINUE;
            END IF;
            
            -- Insert Written Vote
            INSERT INTO written_votes (member_id, meeting_id, agenda_id, choice)
            VALUES (p_member_id, p_meeting_id, v_agenda_id, v_choice);
            
            -- Update Fixed Written Vote Counts
            IF v_choice = 'yes' THEN
                UPDATE agendas
                SET
                    written_yes = COALESCE(written_yes, 0) + 1,
                    votes_yes = COALESCE(votes_yes, 0) + 1
                WHERE id = v_agenda_id;
            ELSIF v_choice = 'no' THEN
                UPDATE agendas
                SET
                    written_no = COALESCE(written_no, 0) + 1,
                    votes_no = COALESCE(votes_no, 0) + 1
                WHERE id = v_agenda_id;
            ELSIF v_choice = 'abstain' THEN
                UPDATE agendas
                SET
                    written_abstain = COALESCE(written_abstain, 0) + 1,
                    votes_abstain = COALESCE(votes_abstain, 0) + 1
                WHERE id = v_agenda_id;
            END IF;
        END LOOP;
    END IF;

    IF p_election_votes IS NOT NULL THEN
        FOR v_vote IN SELECT * FROM jsonb_array_elements(p_election_votes)
        LOOP
            v_agenda_id := (v_vote->>'agenda_id')::INTEGER;
            v_choice := v_vote->>'choice';

            IF NOT EXISTS (
                SELECT 1
                FROM agendas
                WHERE id = v_agenda_id
                  AND type = 'election'
            ) THEN
                CONTINUE;
            END IF;

            INSERT INTO mail_election_votes (member_id, meeting_id, agenda_id, choice)
            VALUES (p_member_id, p_meeting_id, v_agenda_id, v_choice)
            ON CONFLICT (member_id, meeting_id, agenda_id)
            DO UPDATE SET choice = EXCLUDED.choice;
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. Create RPC function to Cancel Check-in (and reverse votes)
CREATE OR REPLACE FUNCTION cancel_check_in_member(
    p_member_id INTEGER,
    p_meeting_id INTEGER
)
RETURNS VOID AS $$
DECLARE
    r_vote RECORD;
BEGIN
    -- 1. Reverse Votes (if any)
    FOR r_vote IN 
        SELECT written_votes.agenda_id, written_votes.choice
        FROM written_votes
        JOIN agendas ON agendas.id = written_votes.agenda_id
        WHERE written_votes.member_id = p_member_id
          AND written_votes.meeting_id = p_meeting_id
          AND agendas.type <> 'election'
    LOOP
        IF r_vote.choice = 'yes' THEN
            UPDATE agendas
            SET
                written_yes = GREATEST(0, COALESCE(written_yes, 0) - 1),
                votes_yes = GREATEST(0, COALESCE(votes_yes, 0) - 1)
            WHERE id = r_vote.agenda_id;
        ELSIF r_vote.choice = 'no' THEN
            UPDATE agendas
            SET
                written_no = GREATEST(0, COALESCE(written_no, 0) - 1),
                votes_no = GREATEST(0, COALESCE(votes_no, 0) - 1)
            WHERE id = r_vote.agenda_id;
        ELSIF r_vote.choice = 'abstain' THEN
            UPDATE agendas
            SET
                written_abstain = GREATEST(0, COALESCE(written_abstain, 0) - 1),
                votes_abstain = GREATEST(0, COALESCE(votes_abstain, 0) - 1)
            WHERE id = r_vote.agenda_id;
        END IF;
    END LOOP;

    -- 2. Delete Written Votes
    DELETE FROM written_votes WHERE member_id = p_member_id AND meeting_id = p_meeting_id;
    DELETE FROM mail_election_votes WHERE member_id = p_member_id AND meeting_id = p_meeting_id;

    -- 3. Delete Attendance
    DELETE FROM attendance WHERE member_id = p_member_id AND meeting_id = p_meeting_id;
END;
$$ LANGUAGE plpgsql;
