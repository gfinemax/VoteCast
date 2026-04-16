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

            INSERT INTO mail_election_votes (member_id, meeting_id, agenda_id, choice)
            VALUES (p_member_id, p_meeting_id, v_agenda_id, v_choice)
            ON CONFLICT (member_id, meeting_id, agenda_id)
            DO UPDATE SET choice = EXCLUDED.choice;
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql;
