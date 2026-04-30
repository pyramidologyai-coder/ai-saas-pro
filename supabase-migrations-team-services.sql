-- Migration: Add provided_services to team_members
-- This allows mapping specific services to specific team members
ALTER TABLE team_members 
ADD COLUMN IF NOT EXISTS provided_services UUID[] DEFAULT '{}';

-- Create a GIN index for fast searching if needed later (e.g. for the AI to find doctors by service)
CREATE INDEX IF NOT EXISTS idx_team_members_services ON team_members USING GIN (provided_services);
