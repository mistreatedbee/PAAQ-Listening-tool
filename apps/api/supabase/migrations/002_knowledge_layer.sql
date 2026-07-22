-- Phase 2.5: Application Knowledge & Intelligence Layer
-- All tables tenant-scoped with RLS

-- ─── Application Registry ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  platform        TEXT NOT NULL DEFAULT 'other', -- web | ios | android | flutter | react-native | nodejs | other
  business_domain TEXT,
  industry        TEXT,
  supported_regions TEXT[] DEFAULT '{}',
  release_channels TEXT[] DEFAULT '{"production","staging"}',
  primary_owner   TEXT,
  primary_contact TEXT,
  critical_features TEXT[] DEFAULT '{}',
  tech_stack      JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Feature Registry ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  business_purpose TEXT,
  criticality     TEXT NOT NULL DEFAULT 'medium', -- critical | high | medium | low
  status          TEXT NOT NULL DEFAULT 'active', -- active | deprecated | in-development | paused
  owning_team     TEXT,
  dependencies    TEXT[] DEFAULT '{}',
  tags            TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Screen Registry ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS screen_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  purpose         TEXT,
  feature_id      UUID REFERENCES feature_registry(id) ON DELETE SET NULL,
  entry_points    TEXT[] DEFAULT '{}',
  exit_points     TEXT[] DEFAULT '{}',
  dependencies    TEXT[] DEFAULT '{}',
  typical_completion_seconds INT,
  success_criteria TEXT,
  is_critical     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── API Registry ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  endpoint        TEXT NOT NULL,
  method          TEXT NOT NULL DEFAULT 'GET', -- GET | POST | PUT | PATCH | DELETE | GRAPHQL | GRPC
  purpose         TEXT,
  owning_service  TEXT,
  dependencies    TEXT[] DEFAULT '{}',
  requires_auth   BOOLEAN NOT NULL DEFAULT TRUE,
  criticality     TEXT NOT NULL DEFAULT 'medium',
  expected_latency_ms INT,
  spec_type       TEXT DEFAULT 'rest', -- rest | graphql | grpc | openapi
  raw_spec        TEXT, -- raw OpenAPI/GraphQL spec for this endpoint
  tags            TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── User Journey Registry ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journey_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  business_purpose TEXT,
  criticality     TEXT NOT NULL DEFAULT 'high',
  steps           JSONB NOT NULL DEFAULT '[]', -- [{step, screen, action, required, successCriteria}]
  success_state   TEXT,
  failure_states  JSONB DEFAULT '[]',
  avg_duration_seconds INT,
  tags            TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Service Registry ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  service_type    TEXT DEFAULT 'internal', -- internal | external | third-party
  owner           TEXT,
  criticality     TEXT NOT NULL DEFAULT 'high',
  dependencies    TEXT[] DEFAULT '{}',
  database        TEXT,
  health_endpoint TEXT,
  status          TEXT NOT NULL DEFAULT 'healthy', -- healthy | degraded | down | unknown
  tags            TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Deployment Registry ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deployment_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  version         TEXT NOT NULL,
  environment     TEXT NOT NULL DEFAULT 'production',
  deployed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deployed_by     TEXT,
  release_notes   TEXT,
  changed_features TEXT[] DEFAULT '{}',
  changed_services TEXT[] DEFAULT '{}',
  git_commit      TEXT,
  git_tag         TEXT,
  build_number    TEXT,
  status          TEXT NOT NULL DEFAULT 'success', -- success | failed | rolled-back | in-progress
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Team Registry ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  team_type       TEXT DEFAULT 'engineering', -- engineering | product | ux | security | qa
  description     TEXT,
  slack_channel   TEXT,
  email           TEXT,
  lead            TEXT,
  members         TEXT[] DEFAULT '{}',
  owned_features  TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Knowledge Documents ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  doc_type        TEXT NOT NULL DEFAULT 'documentation', -- documentation | api-spec | architecture | release-notes | faq | runbook | adr
  content         TEXT NOT NULL,
  content_format  TEXT NOT NULL DEFAULT 'markdown', -- markdown | pdf | openapi | graphql | plaintext
  source          TEXT, -- url, github path, etc.
  tags            TEXT[] DEFAULT '{}',
  ai_summary      TEXT, -- AI-generated summary
  ai_processed    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Knowledge Graph ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  node_type       TEXT NOT NULL, -- feature | screen | api | service | journey | team | deployment | document
  ref_id          UUID, -- references the source registry table row
  label           TEXT NOT NULL,
  description     TEXT,
  metadata        JSONB DEFAULT '{}',
  x               FLOAT DEFAULT 0, -- graph layout position
  y               FLOAT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_edges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES tenant_projects(id) ON DELETE CASCADE,
  source_id       UUID NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  target_id       UUID NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  relationship    TEXT NOT NULL, -- depends-on | owns | uses | calls | includes | deployed-in | part-of
  label           TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RLS Policies ──────────────────────────────────────────────────────────────
ALTER TABLE app_registry         ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_registry     ENABLE ROW LEVEL SECURITY;
ALTER TABLE screen_registry      ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_registry         ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_registry     ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_registry     ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_registry  ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_registry        ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_nodes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_edges      ENABLE ROW LEVEL SECURITY;

-- Tenant users can only see their own tenant's knowledge
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'app_registry','feature_registry','screen_registry','api_registry',
    'journey_registry','service_registry','deployment_registry','team_registry',
    'knowledge_documents','knowledge_nodes','knowledge_edges'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (
        tenant_id IN (
          SELECT tu.tenant_id FROM tenant_users tu WHERE tu.auth_user_id = auth.uid()
        ) OR EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid())
      )', t
    );
  END LOOP;
END $$;

-- ─── Indexes ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_feature_registry_project   ON feature_registry(project_id);
CREATE INDEX IF NOT EXISTS idx_screen_registry_project    ON screen_registry(project_id);
CREATE INDEX IF NOT EXISTS idx_api_registry_project       ON api_registry(project_id);
CREATE INDEX IF NOT EXISTS idx_journey_registry_project   ON journey_registry(project_id);
CREATE INDEX IF NOT EXISTS idx_service_registry_project   ON service_registry(project_id);
CREATE INDEX IF NOT EXISTS idx_deployment_registry_project ON deployment_registry(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_project ON knowledge_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_project    ON knowledge_nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_source     ON knowledge_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_target     ON knowledge_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_deployment_registry_env    ON deployment_registry(project_id, environment, deployed_at DESC);

-- Full-text search on knowledge documents
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_fts ON knowledge_documents
  USING gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,'')));
