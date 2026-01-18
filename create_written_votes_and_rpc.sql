-- 1. Create written_votes table
CREATE TABLE IF NOT EXISTS written_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
    meeting_id INTEGER REFERENCES agendas(id) ON DELETE CASCADE, 
    agenda_id INTEGER REFERENCES agendas(id) ON DELETE CASCADE,
    choice TEXT CHECK (choice IN ('yes', 'no', 'abstain')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_written_votes_member ON written_votes(member_id);
CREATE INDEX IF NOT EXISTS idx_written_votes_agenda ON written_votes(agenda_id);

-- 2. Create RPC function for transactional check-in
CREATE OR REPLACE FUNCTION check_in_member(
    p_member_id INTEGER,
    p_meeting_id INTEGER,
    p_type TEXT,
    p_proxy_name TEXT DEFAULT NULL,
    p_votes JSONB DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_vote JSONB;
    v_agenda_id INTEGER;
    v_choice TEXT;
BEGIN
    -- Insert Attendance
    INSERT INTO attendance (member_id, meeting_id, type, proxy_name)
    VALUES (p_member_id, p_meeting_id, p_type, p_proxy_name);

    -- Process Votes if provided
    IF p_votes IS NOT NULL THEN
        FOR v_vote IN SELECT * FROM jsonb_array_elements(p_votes)
        LOOP
            v_agenda_id := (v_vote->>'agenda_id')::INTEGER;
            v_choice := v_vote->>'choice';
            
            -- Insert Written Vote
            INSERT INTO written_votes (member_id, meeting_id, agenda_id, choice)
            VALUES (p_member_id, p_meeting_id, v_agenda_id, v_choice);
            
            -- Update Agenda Counts
            IF v_choice = 'yes' THEN
                UPDATE agendas SET votes_yes = COALESCE(votes_yes, 0) + 1 WHERE id = v_agenda_id;
            ELSIF v_choice = 'no' THEN
                UPDATE agendas SET votes_no = COALESCE(votes_no, 0) + 1 WHERE id = v_agenda_id;
            ELSIF v_choice = 'abstain' THEN
                UPDATE agendas SET votes_abstain = COALESCE(votes_abstain, 0) + 1 WHERE id = v_agenda_id;
            END IF;
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
        SELECT agenda_id, choice FROM written_votes 
        WHERE member_id = p_member_id AND meeting_id = p_meeting_id
    LOOP
        IF r_vote.choice = 'yes' THEN
            UPDATE agendas SET votes_yes = GREATEST(0, COALESCE(votes_yes, 0) - 1) WHERE id = r_vote.agenda_id;
        ELSIF r_vote.choice = 'no' THEN
            UPDATE agendas SET votes_no = GREATEST(0, COALESCE(votes_no, 0) - 1) WHERE id = r_vote.agenda_id;
        ELSIF r_vote.choice = 'abstain' THEN
            UPDATE agendas SET votes_abstain = GREATEST(0, COALESCE(votes_abstain, 0) - 1) WHERE id = r_vote.agenda_id;
        END IF;
    END LOOP;

    -- 2. Delete Written Votes
    DELETE FROM written_votes WHERE member_id = p_member_id AND meeting_id = p_meeting_id;

    -- 3. Delete Attendance
    DELETE FROM attendance WHERE member_id = p_member_id AND meeting_id = p_meeting_id;
END;
$$ LANGUAGE plpgsql;
