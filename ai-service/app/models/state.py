from typing import TypedDict, Optional, List, Dict, Any


class IncidentAnalysisState(TypedDict):
    # Initialized by FastAPI before pipeline starts — never modified by agents
    incident_id: str
    title: str
    severity: str
    environment: str
    affected_services: List[str]
    description: str
    metrics: Dict[str, Any]  # keys: cpu_usage_percent, memory_usage_percent, error_rate_percent, response_time_ms
    raw_logs: str

    # Written by agents — initially None/empty
    log_analysis: Optional[Dict[str, Any]]
    root_cause: Optional[Dict[str, Any]]
    recommendations: List[Dict[str, Any]]

    # Status tracking — all agents read and write
    agent_statuses: Dict[str, str]  # keys: LOG_ANALYSIS, ROOT_CAUSE, RECOMMENDATION
    pipeline_errors: List[str]
