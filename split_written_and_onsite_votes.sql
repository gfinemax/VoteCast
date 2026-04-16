ALTER TABLE agendas
ADD COLUMN IF NOT EXISTS written_yes INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS written_no INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS written_abstain INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS onsite_yes INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS onsite_no INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS onsite_abstain INTEGER NOT NULL DEFAULT 0;

ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS has_election BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS mail_election_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    meeting_id INTEGER NOT NULL REFERENCES agendas(id) ON DELETE CASCADE,
    agenda_id INTEGER NOT NULL REFERENCES agendas(id) ON DELETE CASCADE,
    choice TEXT NOT NULL CHECK (choice IN ('yes', 'no', 'abstain')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

WITH ranked_written_votes AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY member_id, meeting_id, agenda_id
            ORDER BY created_at DESC, id DESC
        ) AS duplicate_rank
    FROM written_votes
)
DELETE FROM written_votes
WHERE id IN (
    SELECT id
    FROM ranked_written_votes
    WHERE duplicate_rank > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_written_votes_member_meeting_agenda
ON written_votes(member_id, meeting_id, agenda_id);
CREATE INDEX IF NOT EXISTS idx_mail_election_votes_member ON mail_election_votes(member_id);
CREATE INDEX IF NOT EXISTS idx_mail_election_votes_agenda ON mail_election_votes(agenda_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mail_election_votes_member_meeting_agenda
ON mail_election_votes(member_id, meeting_id, agenda_id);

UPDATE agendas
SET
    written_yes = 0,
    written_no = 0,
    written_abstain = 0;

WITH written_totals AS (
    SELECT
        written_votes.agenda_id,
        COUNT(*) FILTER (WHERE choice = 'yes') AS yes_count,
        COUNT(*) FILTER (WHERE choice = 'no') AS no_count,
        COUNT(*) FILTER (WHERE choice = 'abstain') AS abstain_count
    FROM written_votes
    JOIN agendas ON agendas.id = written_votes.agenda_id
    WHERE agendas.type <> 'election'
    GROUP BY written_votes.agenda_id
)
UPDATE agendas AS agenda
SET
    written_yes = COALESCE(written_totals.yes_count, 0),
    written_no = COALESCE(written_totals.no_count, 0),
    written_abstain = COALESCE(written_totals.abstain_count, 0)
FROM written_totals
WHERE agenda.id = written_totals.agenda_id;

UPDATE agendas
SET
    onsite_yes = GREATEST(0, COALESCE(votes_yes, 0) - COALESCE(written_yes, 0)),
    onsite_no = GREATEST(0, COALESCE(votes_no, 0) - COALESCE(written_no, 0)),
    onsite_abstain = GREATEST(0, COALESCE(votes_abstain, 0) - COALESCE(written_abstain, 0));

UPDATE agendas
SET
    votes_yes = COALESCE(written_yes, 0) + COALESCE(onsite_yes, 0),
    votes_no = COALESCE(written_no, 0) + COALESCE(onsite_no, 0),
    votes_abstain = COALESCE(written_abstain, 0) + COALESCE(onsite_abstain, 0);

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
    INSERT INTO attendance (member_id, meeting_id, type, has_election, proxy_name)
    VALUES (p_member_id, p_meeting_id, p_type, COALESCE(p_has_election, FALSE), p_proxy_name);

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

            INSERT INTO written_votes (member_id, meeting_id, agenda_id, choice)
            VALUES (p_member_id, p_meeting_id, v_agenda_id, v_choice);

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

CREATE OR REPLACE FUNCTION cancel_check_in_member(
    p_member_id INTEGER,
    p_meeting_id INTEGER
)
RETURNS VOID AS $$
DECLARE
    r_vote RECORD;
BEGIN
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

    DELETE FROM written_votes WHERE member_id = p_member_id AND meeting_id = p_meeting_id;
    DELETE FROM mail_election_votes WHERE member_id = p_member_id AND meeting_id = p_meeting_id;
    DELETE FROM attendance WHERE member_id = p_member_id AND meeting_id = p_meeting_id;
END;
$$ LANGUAGE plpgsql;
