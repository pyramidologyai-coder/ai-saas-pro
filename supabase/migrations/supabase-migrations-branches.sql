-- Update team_members to support multiple branches (branch_ids array)
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS branch_ids UUID[] DEFAULT '{}';

-- Create an index for AI searching by branch
CREATE INDEX IF NOT EXISTS idx_team_members_branch_ids ON team_members USING GIN (branch_ids);
