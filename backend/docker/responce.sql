-- Create the responce table
CREATE TABLE IF NOT EXISTS responce (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,
    entity_type regclass NOT NULL,
    reference_id UUID,
    reference_type regclass,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    category VARCHAR,
    context JSONB,
    context_type VARCHAR(25),
    meta JSONB
);

-- Add indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_responce_entity ON responce (entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_responce_reference ON responce (reference_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_responce_category ON responce (category);
