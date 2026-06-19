from typing import Optional, List
from pydantic import BaseModel


class IncidentAnalysisRequestMessage(BaseModel):
    message_id: str
    incident_id: str
    published_at: str


class AgentRunResult(BaseModel):
    agent_name: str
    status: str
    started_at: str
    finished_at: str
    retry_count: int = 0
    output_summary: Optional[str] = None
    error_message: Optional[str] = None


class RootCauseResult(BaseModel):
    primary_cause: str
    causal_chain: List[str]
    confidence_score: int
    root_cause_category: str


class RecommendationResult(BaseModel):
    recommendation_order: int
    action: str
    rationale: str
    priority: str
    responsible_team: str


class IncidentAnalysisResultMessage(BaseModel):
    message_id: str
    incident_id: str
    analysis_status: str  # COMPLETED | PARTIAL | FAILED
    agent_runs: List[AgentRunResult]
    root_cause: Optional[RootCauseResult] = None
    recommendations: List[RecommendationResult] = []
    completed_at: str
