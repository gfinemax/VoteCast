ALTER TABLE agendas
ADD COLUMN IF NOT EXISTS election_method TEXT;

ALTER TABLE agendas
DROP CONSTRAINT IF EXISTS agendas_election_method_check;

ALTER TABLE agendas
ADD CONSTRAINT agendas_election_method_check
CHECK (
    election_method IS NULL
    OR election_method IN (
        'approval_majority',
        'chair_runoff',
        'plurality'
    )
);
