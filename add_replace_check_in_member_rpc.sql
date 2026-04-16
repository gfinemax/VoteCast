CREATE OR REPLACE FUNCTION replace_check_in_member(
    p_member_id INTEGER,
    p_meeting_id INTEGER,
    p_type TEXT DEFAULT NULL,
    p_has_election BOOLEAN DEFAULT FALSE,
    p_proxy_name TEXT DEFAULT NULL,
    p_votes JSONB DEFAULT NULL,
    p_election_votes JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    PERFORM cancel_check_in_member(p_member_id, p_meeting_id);
    PERFORM check_in_member(
        p_member_id,
        p_meeting_id,
        p_type,
        p_has_election,
        p_proxy_name,
        p_votes,
        p_election_votes
    );
END;
$$ LANGUAGE plpgsql;
