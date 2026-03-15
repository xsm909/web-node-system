-- Create the response table
CREATE TABLE IF NOT EXISTS response (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,
    entity_type regclass NOT NULL,
    reference_id UUID,
    reference_type regclass,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    category VARCHAR,
    context JSONB,
    context_type VARCHAR(25),
    meta JSONB,
    raw TEXT
);

-- Add indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_response_entity ON response (entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_response_reference ON response (reference_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_response_category ON response (category);
