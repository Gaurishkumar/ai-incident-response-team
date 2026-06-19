import logging
import time

from app.metrics import agent_execution_duration, agent_failures_total
from app.models.state import IncidentAnalysisState
from app.services.gemini import gemini_service

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are a principal DevOps engineer who translates incident root cause analysis into concrete, prioritized remediation steps. Each recommendation must be specific and actionable — never vague. Respond ONLY with a valid JSON array."""

_VALID_PRIORITIES = {"Immediate", "Short-term", "Long-term"}
_VALID_TEAMS = {"Database", "Infrastructure", "Application Engineering", "Monitoring"}


def _build_prompt(state: IncidentAnalysisState) -> str:
    rc = state.get("root_cause")
    if rc:
        chain_str = "\n    ".join(f"{i+1}. {s}" for i, s in enumerate(rc.get("causal_chain", [])))
        rc_block = (
            f"Root Cause Analysis:\n"
            f"  - Primary Cause: {rc.get('primary_cause', 'N/A')}\n"
            f"  - Causal Chain:\n    {chain_str}\n"
            f"  - Category: {rc.get('root_cause_category', 'Unknown')}\n"
            f"  - Confidence: {rc.get('confidence_score', 0)}%"
        )
    else:
        rc_block = (
            "Root Cause Analysis: UNAVAILABLE (agent failed) — "
            "generate general best-practice recommendations based on severity and affected services"
        )

    return f"""Generate exactly 3 to 5 remediation recommendations and return a JSON array with EXACTLY this structure:
[
  {{
    "recommendation_order": 1,
    "action": "specific concrete action — e.g. 'Increase connection pool size from 10 to 50 in application.properties'",
    "rationale": "why this directly addresses the identified root cause",
    "priority": "<exactly one of: Immediate, Short-term, Long-term>",
    "responsible_team": "<exactly one of: Database, Infrastructure, Application Engineering, Monitoring>"
  }}
]

Rules:
- MUST generate 3 to 5 items — never fewer than 3, never more than 5
- priority "Immediate" = within hours, "Short-term" = within days, "Long-term" = within weeks
- Actions must be concrete, not vague ("restart the service" is too vague; "restart auth-service pod in prod namespace" is concrete)
- Order by urgency: most urgent first (recommendation_order 1 = highest priority)

Incident Context:
  - Severity: {state["severity"]}
  - Environment: {state["environment"]}
  - Affected Services: {", ".join(state["affected_services"])}

{rc_block}"""


async def recommendation_node(state: IncidentAnalysisState) -> dict:
    agent_statuses = dict(state["agent_statuses"])
    agent_statuses["RECOMMENDATION"] = "RUNNING"

    start = time.time()
    try:
        result = await gemini_service.generate_json(
            system_prompt=_SYSTEM_PROMPT,
            user_prompt=_build_prompt(state),
            agent_name="RECOMMENDATION",
        )

        # Unwrap if model returned {"recommendations": [...]}
        if isinstance(result, dict):
            recs = result.get("recommendations", result.get("items", []))
        elif isinstance(result, list):
            recs = result
        else:
            raise ValueError(f"Unexpected response type: {type(result)}")

        if len(recs) > 5:
            logger.warning(f"[{state['incident_id']}] Got {len(recs)} recs, truncating to 5")
            recs = recs[:5]
        if len(recs) < 3:
            raise ValueError(f"Only {len(recs)} recommendations returned (minimum 3 required)")

        for i, rec in enumerate(recs):
            rec["recommendation_order"] = i + 1
            if rec.get("priority") not in _VALID_PRIORITIES:
                rec["priority"] = "Short-term"
            if rec.get("responsible_team") not in _VALID_TEAMS:
                rec["responsible_team"] = "Application Engineering"

        duration = time.time() - start
        agent_execution_duration.labels(agent_name="RECOMMENDATION").observe(duration)
        agent_statuses["RECOMMENDATION"] = "COMPLETED"
        logger.info(
            f"[{state['incident_id']}] RECOMMENDATION completed in {duration:.2f}s — "
            f"{len(recs)} recommendations generated"
        )
        return {"recommendations": recs, "agent_statuses": agent_statuses}

    except Exception as e:
        duration = time.time() - start
        agent_execution_duration.labels(agent_name="RECOMMENDATION").observe(duration)
        agent_failures_total.labels(agent_name="RECOMMENDATION").inc()
        agent_statuses["RECOMMENDATION"] = "FAILED"

        errors = list(state.get("pipeline_errors", []))
        errors.append(f"RECOMMENDATION failed: {e}")
        logger.error(f"[{state['incident_id']}] RECOMMENDATION failed: {e}")
        return {
            "recommendations": [],
            "agent_statuses": agent_statuses,
            "pipeline_errors": errors,
        }
