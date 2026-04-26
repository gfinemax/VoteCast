-- Add Withdrawal Support to Agendas table
ALTER TABLE agendas ADD COLUMN IF NOT EXISTS is_withdrawn BOOLEAN DEFAULT FALSE;
ALTER TABLE agendas ADD COLUMN IF NOT EXISTS withdrawal_reason TEXT;
