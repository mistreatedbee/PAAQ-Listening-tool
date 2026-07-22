export type Platform = 'web' | 'ios' | 'android' | 'flutter' | 'react-native' | 'nodejs' | 'other'
export type Criticality = 'critical' | 'high' | 'medium' | 'low'
export type FeatureStatus = 'active' | 'deprecated' | 'in-development' | 'paused'
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'GRAPHQL' | 'GRPC'
export type ServiceType = 'internal' | 'external' | 'third-party'
export type DeploymentStatus = 'success' | 'failed' | 'rolled-back' | 'in-progress'
export type NodeType = 'feature' | 'screen' | 'api' | 'service' | 'journey' | 'team' | 'deployment' | 'document'
export type EdgeRelationship = 'depends-on' | 'owns' | 'uses' | 'calls' | 'includes' | 'deployed-in' | 'part-of'
export type DocType = 'documentation' | 'api-spec' | 'architecture' | 'release-notes' | 'faq' | 'runbook' | 'adr'
export type DocFormat = 'markdown' | 'pdf' | 'openapi' | 'graphql' | 'plaintext'

export interface AppRegistry {
  id: string
  tenant_id: string
  project_id: string
  name: string
  description: string | null
  platform: Platform
  business_domain: string | null
  industry: string | null
  supported_regions: string[]
  release_channels: string[]
  primary_owner: string | null
  primary_contact: string | null
  critical_features: string[]
  tech_stack: Record<string, string>
  created_at: string
  updated_at: string
}

export interface FeatureRegistry {
  id: string
  tenant_id: string
  project_id: string
  name: string
  description: string | null
  business_purpose: string | null
  criticality: Criticality
  status: FeatureStatus
  owning_team: string | null
  dependencies: string[]
  tags: string[]
  created_at: string
  updated_at: string
}

export interface ScreenRegistry {
  id: string
  tenant_id: string
  project_id: string
  name: string
  purpose: string | null
  feature_id: string | null
  entry_points: string[]
  exit_points: string[]
  dependencies: string[]
  typical_completion_seconds: number | null
  success_criteria: string | null
  is_critical: boolean
  created_at: string
  updated_at: string
}

export interface ApiRegistry {
  id: string
  tenant_id: string
  project_id: string
  endpoint: string
  method: HttpMethod
  purpose: string | null
  owning_service: string | null
  dependencies: string[]
  requires_auth: boolean
  criticality: Criticality
  expected_latency_ms: number | null
  spec_type: string
  raw_spec: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface JourneyStep {
  step: number
  screen: string
  action: string
  required: boolean
  successCriteria?: string
}

export interface JourneyRegistry {
  id: string
  tenant_id: string
  project_id: string
  name: string
  description: string | null
  business_purpose: string | null
  criticality: Criticality
  steps: JourneyStep[]
  success_state: string | null
  failure_states: string[]
  avg_duration_seconds: number | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface ServiceRegistry {
  id: string
  tenant_id: string
  project_id: string
  name: string
  description: string | null
  service_type: ServiceType
  owner: string | null
  criticality: Criticality
  dependencies: string[]
  database: string | null
  health_endpoint: string | null
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
  tags: string[]
  created_at: string
  updated_at: string
}

export interface DeploymentRegistry {
  id: string
  tenant_id: string
  project_id: string
  version: string
  environment: string
  deployed_at: string
  deployed_by: string | null
  release_notes: string | null
  changed_features: string[]
  changed_services: string[]
  git_commit: string | null
  git_tag: string | null
  build_number: string | null
  status: DeploymentStatus
  created_at: string
}

export interface TeamRegistry {
  id: string
  tenant_id: string
  project_id: string
  name: string
  team_type: string
  description: string | null
  slack_channel: string | null
  email: string | null
  lead: string | null
  members: string[]
  owned_features: string[]
  created_at: string
  updated_at: string
}

export interface KnowledgeDocument {
  id: string
  tenant_id: string
  project_id: string
  title: string
  doc_type: DocType
  content: string
  content_format: DocFormat
  source: string | null
  tags: string[]
  ai_summary: string | null
  ai_processed: boolean
  created_at: string
  updated_at: string
}

export interface KnowledgeNode {
  id: string
  tenant_id: string
  project_id: string
  node_type: NodeType
  ref_id: string | null
  label: string
  description: string | null
  metadata: Record<string, unknown>
  x: number
  y: number
  created_at: string
}

export interface KnowledgeEdge {
  id: string
  tenant_id: string
  project_id: string
  source_id: string
  target_id: string
  relationship: EdgeRelationship
  label: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export const CRITICALITY_ORDER: Criticality[] = ['critical', 'high', 'medium', 'low']

export const CRITICALITY_COLOR: Record<Criticality, string> = {
  critical: '#f87171',
  high:     '#fbbf24',
  medium:   '#51C9D3',
  low:      '#8ba0b4',
}

export const NODE_TYPE_COLOR: Record<NodeType, string> = {
  feature:    '#51C9D3',
  screen:     '#5FDED4',
  api:        '#27A6CE',
  service:    '#4ade80',
  journey:    '#fbbf24',
  team:       '#c084fc',
  deployment: '#fb923c',
  document:   '#8ba0b4',
}
