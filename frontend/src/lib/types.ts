/* ─── Auth ───────────────────────────────────────────────────────────── */
export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  role: 'DEVELOPER' | 'ADMIN'
}

export interface UserResponse {
  id: string
  username: string
  email: string
  role: 'DEVELOPER' | 'ADMIN'
  createdAt: string
}

export interface AuthResponse {
  token: string
  tokenType: 'Bearer'
  expiresIn: number
  user: UserResponse
}

/* ─── Incidents ──────────────────────────────────────────────────────── */
export type Severity = 'P1' | 'P2' | 'P3' | 'P4'
export type Environment = 'production' | 'staging' | 'development'
export type IncidentStatus = 'PENDING' | 'ANALYZING' | 'RESOLVED' | 'FAILED'
export type AgentName = 'LOG_ANALYSIS' | 'ROOT_CAUSE' | 'RECOMMENDATION'
export type AgentStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'

export interface MetricsRequest {
  cpu_usage_percent: number
  memory_usage_percent: number
  error_rate_percent: number
  response_time_ms: number
}

export interface IncidentCreateRequest {
  incident_title: string
  description: string
  environment: Environment
  severity: Severity
  affected_services: string[]
  raw_logs: string
  metrics: MetricsRequest
}

export interface IncidentSummary {
  id: string
  title: string
  severity: Severity
  status: IncidentStatus
  environment: Environment
  affectedServices: string[]
  createdAt: string
  resolvedAt: string | null
}

export interface AgentRunSummary {
  agentName: AgentName
  status: AgentStatus
  startedAt: string | null
  finishedAt: string | null
  outputSummary: string | null
  errorMessage?: string | null
  retryCount?: number
}

export interface MetricsResponse {
  cpuUsagePercent: number
  memoryUsagePercent: number
  errorRatePercent: number
  responseTimeMs: number
}

export interface RootCauseResponse {
  primaryCause: string
  causalChain: string[]
  confidenceScore: number
  rootCauseCategory: 'Infrastructure' | 'Code Bug' | 'Configuration' | 'External' | 'Unknown'
}

export interface RecommendationResponse {
  recommendationOrder: number
  action: string
  rationale: string | null
  priority: 'Immediate' | 'Short-term' | 'Long-term'
  responsibleTeam: string | null
}

export interface IncidentDetailResponse {
  id: string
  title: string
  description: string
  environment: Environment
  severity: Severity
  status: IncidentStatus
  affectedServices: string[]
  metrics: MetricsResponse
  rawLogs: string
  agentRuns: AgentRunSummary[]
  analysis: RootCauseResponse | null
  recommendations: RecommendationResponse[]
  createdAt: string
  resolvedAt: string | null
}

export interface IncidentStatusResponse {
  status: IncidentStatus
  agentRuns: AgentRunSummary[]
}

/* ─── Dashboard ──────────────────────────────────────────────────────── */
export interface DashboardStats {
  totalIncidents: number
  activeIncidents: number
  resolvedToday: number
  failedToday: number
  avgResolutionMinutes: number
  p1Count: number
  p2Count: number
}

export interface PagedIncidents {
  content: IncidentSummary[]
  totalElements: number
  totalPages: number
  currentPage: number
}

/* ─── API Response Envelope ──────────────────────────────────────────── */
export interface ApiError {
  code: string
  message: string
  fields?: { field: string; message: string }[]
}

export interface ApiErrorResponse {
  success: false
  error: ApiError
  timestamp: string
}

/* ─── WebSocket ──────────────────────────────────────────────────────── */
export interface WsIncidentResolved {
  type: 'INCIDENT_RESOLVED'
  incidentId: string
  analysisStatus: string
  timestamp: string
}

export interface WsAgentUpdate {
  type: 'AGENT_UPDATE'
  agentName: AgentName
  status: AgentStatus
  timestamp: string
}

export type WsMessage = WsIncidentResolved | WsAgentUpdate
