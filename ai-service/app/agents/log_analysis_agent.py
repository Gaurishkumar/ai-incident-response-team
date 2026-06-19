import logging
import time

from app.metrics import agent_execution_duration, agent_failures_total
from app.models.state import IncidentAnalysisState
from app.services.gemini import gemini_service

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are a senior SRE log analysis expert. Analyze application and system logs to extract errors, exceptions, and failure patterns. Respond ONLY with valid JSON — no markdown, no prose, no explanation."""

_REQUIRED_FIELDS = {"errors_found", "exceptions", "error_patterns", "log_summary"}
_MAX_LOG_CHARS = 3000


def _build_prompt(state: IncidentAnalysisState) -> str:
    logs = state["raw_logs"]
    truncated = ""
    if len(logs) > _MAX_LOG_CHARS:
        logs = logs[:_MAX_LOG_CHARS]
        truncated = "\n[LOG TRUNCATED — only first 3000 characters shown]"

    return f"""Analyze the logs below and return a JSON object with EXACTLY these four fields:
{{
  "errors_found": ["each distinct error message found in the logs"],
  "exceptions": ["each exception class name and its message, e.g. 'NullPointerException: user object was null'"],
  "error_patterns": ["repeating patterns with count, e.g. 'Connection refused appears 47 times'"],
  "log_summary": "2-3 sentence plain-English summary of what the logs reveal about the system failure"
}}

Incident Context:
- Severity: {state["severity"]}
- Affected Services: {", ".join(state["affected_services"])}

Logs:
{logs}{truncated}"""


async def log_analysis_node(state: IncidentAnalysisState) -> dict:
    agent_statuses = dict(state["agent_statuses"])
    agent_statuses["LOG_ANALYSIS"] = "RUNNING"

    start = time.time()
    try:
        result = await gemini_service.generate_json(
            system_prompt=_SYSTEM_PROMPT,
            user_prompt=_build_prompt(state),
            agent_name="LOG_ANALYSIS",
        )

        missing = _REQUIRED_FIELDS - result.keys()
        if missing:
            raise ValueError(f"Response missing required fields: {missing}")

        # Normalise to lists
        for key in ("errors_found", "exceptions", "error_patterns"):
            if not isinstance(result.get(key), list):
                result[key] = []

        duration = time.time() - start
        agent_execution_duration.labels(agent_name="LOG_ANALYSIS").observe(duration)
        agent_statuses["LOG_ANALYSIS"] = "COMPLETED"
        logger.info(
            f"[{state['incident_id']}] LOG_ANALYSIS completed in {duration:.2f}s — "
            f"{len(result['errors_found'])} errors, {len(result['exceptions'])} exceptions"
        )
        return {"log_analysis": result, "agent_statuses": agent_statuses}

    except Exception as e:
        duration = time.time() - start
        agent_execution_duration.labels(agent_name="LOG_ANALYSIS").observe(duration)
        agent_failures_total.labels(agent_name="LOG_ANALYSIS").inc()
        agent_statuses["LOG_ANALYSIS"] = "FAILED"

        errors = list(state.get("pipeline_errors", []))
        errors.append(f"LOG_ANALYSIS failed: {e}")
        logger.error(f"[{state['incident_id']}] LOG_ANALYSIS failed: {e}")
        return {
            "log_analysis": None,
            "agent_statuses": agent_statuses,
            "pipeline_errors": errors,
        }
