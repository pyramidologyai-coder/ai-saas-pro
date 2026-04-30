CREATE TABLE IF NOT EXISTS platform_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_base_fee INTEGER DEFAULT 100,
    agency_percentage INTEGER DEFAULT 20,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert a default row if empty
INSERT INTO platform_settings (agency_base_fee, agency_percentage)
SELECT 100, 20
WHERE NOT EXISTS (SELECT 1 FROM platform_settings);
