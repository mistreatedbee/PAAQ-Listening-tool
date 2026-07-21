-- PAAQ Listening Platform — Phase 2 Schema
-- Run in Supabase SQL Editor

-- ============================================================
-- Feature Health
-- ============================================================
CREATE TABLE IF NOT EXISTS feature_health (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  health_score FLOAT NOT NULL DEFAULT 0,
  usage_score FLOAT NOT NULL DEFAULT 0,
  error_score FLOAT NOT NULL DEFAULT 0,
  completion_rate FLOAT NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  trend TEXT CHECK (trend IN ('improving', 'stable', 'declining')) DEFAULT 'stable',
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE feature_health DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- User Journeys
-- ============================================================
CREATE TABLE IF NOT EXISTS user_journeys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  session_id UUID,
  journey_name TEXT,
  steps JSONB DEFAULT '[]',
  completed BOOLEAN DEFAULT FALSE,
  drop_off_step TEXT,
  drop_off_reason TEXT,
  ai_analysis TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_journeys DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- Anomaly Events
-- ============================================================
CREATE TABLE IF NOT EXISTS anomaly_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  detected_pattern TEXT,
  confidence FLOAT DEFAULT 0.8,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE anomaly_events DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- AI Analysis Jobs
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_analysis_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type TEXT NOT NULL DEFAULT 'full_analysis',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ai_analysis_jobs DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- Upgrade ai_insights with Phase 2 columns
-- ============================================================
ALTER TABLE ai_insights ADD COLUMN IF NOT EXISTS impact_score FLOAT DEFAULT 0.5;
ALTER TABLE ai_insights ADD COLUMN IF NOT EXISTS affected_users INTEGER DEFAULT 0;
ALTER TABLE ai_insights ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE ai_insights ADD COLUMN IF NOT EXISTS evidence JSONB DEFAULT '{}';
ALTER TABLE ai_insights ADD COLUMN IF NOT EXISTS recommended_action TEXT;
ALTER TABLE ai_insights ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
