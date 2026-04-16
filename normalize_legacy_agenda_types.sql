UPDATE agendas
SET type = 'majority'
WHERE type = 'general';

UPDATE agendas
SET type = 'twoThirds'
WHERE type = 'special';
