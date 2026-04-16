UPDATE agendas
SET type = 'majority'
WHERE type = 'general';

UPDATE agendas
SET type = 'twoThirds'
WHERE type = 'special';

ALTER TABLE agendas
DROP CONSTRAINT IF EXISTS agendas_type_check;

ALTER TABLE agendas
ADD CONSTRAINT agendas_type_check
CHECK (type IN ('folder', 'majority', 'twoThirds', 'election'));
