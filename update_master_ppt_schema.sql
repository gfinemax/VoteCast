-- 1. Add Master Presentation settings to Global System Settings
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS master_presentation_type TEXT DEFAULT 'URL'; -- 'FILE' or 'URL'
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS master_presentation_source TEXT;

-- 2. Add Page Number support to Agendas (for Deep Linking)
ALTER TABLE agendas ADD COLUMN IF NOT EXISTS start_page INTEGER;

-- 3. (Optional) Cleanup if you want to prefer Master over Individual, 
-- but keeping individual columns (presentation_type, presentation_source) allows for hybrids.
