-- Create the prompts table
CREATE TABLE IF NOT EXISTS prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,
    entity_type VARCHAR NOT NULL,
    content JSON NOT NULL,
    category VARCHAR,
    datatype VARCHAR NOT NULL,
    reference_id UUID,
    meta JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_prompts_entity ON prompts (entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts (category);
CREATE INDEX IF NOT EXISTS idx_prompts_datatype ON prompts (datatype);
CREATE INDEX IF NOT EXISTS idx_prompts_reference ON prompts (reference_id);
