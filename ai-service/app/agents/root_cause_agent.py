import logging
import time

from app.metrics import agent_execution_duration, agent_failures_total
from app.models.state import IncidentAnalysisState
from app.services.gemini import gemini_service

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are a principal engineer with deep expertise in distributed systems and incident management. You synthesize log analysis findings, system metrics, and incident descriptions to determine the most probable root cause of a production failure. Respond ONLY with valid JSON — no markdown, no prose."""

_REQUIRED_FIELDS = {"primary_cause", "causal_chain", "confidence_score", "root_cause_category"}
_VALID_CATEGORIES = {"Infrastructure", "Code Bug", "Configuration", "External", "Unknown"}


def _format_metric(label: str, value: float, warn: float, crit: float, unit: str = "") -> str:
    tag = " [CRITICAL]" if value >= crit else " [HIGH]" if value >= warn else ""
    return f"  - {label}: {value}{unit}{tag}"


def _build_prompt(state: IncidentAnalysisState) -> str:
    m = state["metrics"]
    metrics_block = "\n".join([
        _format_metric("CPU Usage",     float(m.get("cpu_usage_percent", 0)),    70, 90, "%"),
        _format_metric("Memory Usage",  float(m.get("memory_usage_percent", 0)), 70, 90, "%"),
        _format_metric("Error Rate",    float(m.get("error_rate_percent", 0)),   5,  20, "%"),
        _format_metric("Response Time", float(m.get("response_time_ms", 0)),     2000, 5000, "ms"),
    ])

    la = state.get("log_analysis")
    if la:
        errors_str    = "; ".join(la.get("errors_found", [])[:5]) or "None"
        exceptions_str = "; ".join(la.get("exceptions", [])[:5]) or "None"
        patterns_str  = "; ".join(la.get("error_patterns", [])[:3]) or "None"
        log_block = (
            f"Log Analysis Findings:\n"
            f"  - Errors: {errors_str}\n"
            f"  - Exceptions: {exceptions_str}\n"
            f"  - Patterns: {patterns_str}\n"
            f"  - Summary: {la.get('log_summary', 'N/A')}"
        )
    else:
        log_block = (
            "Log Analysis: UNAVAILABLE (agent failed) — "
            "reduce your confidence_score by at least 20 points"
        )

    return f"""Analyze this production incident and return a JSON object with EXACTLY these four fields:
{{
  "primary_cause": "the single most probable root cause stated in 1-2 sentences",
  "causal_chain": ["step 1 — what triggered the failure", "step 2 — how it propagated", "..."],
  "confidence_score": <integer 0-100; reduce if data was incomplete>,
  "root_cause_category": "<exactly one of: Infrastructure, Code Bug, Configuration, External, Unknown>"
}}

Incident:
  - Title: {state["title"]}
  - Severity: {state["severity"]}
  - Environment: {state["environment"]}
  - Affected Services: {", ".join(state["affected_services"])}
  - Description: {state["description"]}

System Metrics:
{metrics_block}

{log_block}"""


async def root_cause_node(state: IncidentAnalysisState) -> dict:
    agent_statuses = dict(state["agent_statuses"])
    agent_statuses["ROOT_CAUSE"] = "RUNNING"

    start = time.time()
    try:
        result = await gemini_service.generate_json(
            system_prompt=_SYSTEM_PROMPT,
            user_prompt=_build_prompt(state),
            agent_name="ROOT_CAUSE",
        )

        missing = _REQUIRED_FIELDS - result.keys()
        if missing:
            raise ValueError(f"Response missing required fields: {missing}")

        # Sanitise values
        if result.get("root_cause_category") not in _VALID_CATEGORIES:
            result["root_cause_category"] = "Unknown"
        result["confidence_score"] = max(0, min(100, int(result.get("confidence_score", 50))))
        if not isinstance(result.get("causal_chain"), list):
            result["causal_chain"] = [str(result.get("causal_chain", ""))]

        duration = time.time() - start
        agent_execution_duration.labels(agent_name="ROOT_CAUSE").observe(duration)
        agent_statuses["ROOT_CAUSE"] = "COMPLETED"
        logger.info(
            f"[{state['incident_id']}] ROOT_CAUSE completed in {duration:.2f}s — "
            f"category={result['root_cause_category']}, confidence={result['confidence_score']}"
        )
        return {"root_cause": result, "agent_statuses": agent_statuses}

    except Exception as e:
        duration = time.time() - start
        agent_execution_duration.labels(agent_name="ROOT_CAUSE").observe(duration)
        agent_failures_total.labels(agent_name="ROOT_CAUSE").inc()
        agent_statuses["ROOT_CAUSE"] = "FAILED"

        errors = list(state.get("pipeline_errors", []))
        errors.append(f"ROOT_CAUSE failed: {e}")
        logger.error(f"[{state['incident_id']}] ROOT_CAUSE failed: {e}")
        return {
            "root_cause": None,
            "agent_statuses": agent_statuses,
            "pipeline_errors": errors,
        }
