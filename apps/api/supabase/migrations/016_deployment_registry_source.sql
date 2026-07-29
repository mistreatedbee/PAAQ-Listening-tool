-- Add source column to deployment_registry to track where deployments came from
-- (vercel, github-actions, netlify, docker, paaq-ai, manual, etc.)
ALTER TABLE deployment_registry
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
