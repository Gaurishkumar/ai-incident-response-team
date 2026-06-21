import json
import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from uuid import uuid4

import aio_pika
from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from app.metrics import active_analyses, analysis_pipeline_duration
from app.models.state import IncidentAnalysisState
from app.pipeline.graph import pipeline
from app.services.database import database_service
from app.services.rabbitmq import rabbitmq_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(name)-30s  %(levelname)-8s  %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Message processing
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_death_count(message: aio_pika.abc.AbstractIncomingMessage) -> int:
    x_death = (message.headers or {}).get("x-death", [])
    if isinstance(x_death, list) and x_death:
        return int(x_death[0].get("count", 0))
    return 0


def _extract_affected_services(raw) -> list:
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        # PostgreSQL TEXT[] arrives as a string like '{"svc-a","svc-b"}'
        raw = raw.strip("{}")
        return [s.strip('"') for s in raw.split(",") if s]
    return []


def _output_summary(agent_name: str, state: dict) -> str | None:
    if agent_name == "LOG_ANALYSIS":
        la = state.get("log_analysis")
        return la.get("log_summary") if la else None
    if agent_name == "ROOT_CAUSE":
        rc = state.get("root_cause")
        return rc.get("primary_cause") if rc else None
    if agent_name == "RECOMMENDATION":
        recs = state.get("recommendations", [])
        if recs:
            top = recs[0].get("action", "")[:120]
            return f"{len(recs)} recommendations. Top action: {top}"
        return None
    return None


def _save_failed_result(result: dict) -> None:
    try:
        with open("failed_results.jsonl", "a") as fh:
            fh.write(json.dumps(result, default=str) + "\n")
        logger.warning("Saved undeliverable result to failed_results.jsonl")
    except Exception as exc:
        logger.error(f"Could not write to failed_results.jsonl: {exc}")


async def process_message(message: aio_pika.abc.AbstractIncomingMessage) -> None:
    incident_id: str | None = None
    message_id: str | None = None
    pipeline_start = time.time()

    try:
        # --- Deserialise -------------------------------------------------------
        try:
            body = json.loads(message.body)
        except json.JSONDecodeError as exc:
            logger.error(f"Malformed message body, routing to DLQ: {exc}")
            await message.nack(requeue=False)
            return

        incident_id = body.get("incident_id")
        organization_id = body.get("organization_id")
        message_id = body.get("message_id")

        if not incident_id:
            logger.error("Message has no incident_id, routing to DLQ")
            await message.nack(requeue=False)
            return

        if not organization_id:
            logger.error(f"[{incident_id}] Message has no organization_id, routing to DLQ")
            await message.nack(requeue=False)
            return

        # --- Retry guard -------------------------------------------------------
        if _get_death_count(message) >= 3:
            logger.error(f"[{incident_id}] Exceeded 3 retries, routing to DLQ")
            await message.nack(requeue=False)
            return

        logger.info(f"[{incident_id}] Received analysis request")

        # --- Fetch data from PostgreSQL ----------------------------------------
        incident = await database_service.get_incident(incident_id, organization_id)
        if not incident:
            logger.error(f"[{incident_id}] Incident not found in DB, routing to DLQ")
            await message.nack(requeue=False)
            return

        metrics = await database_service.get_incident_metrics(incident_id, organization_id)
        if not metrics:
            logger.error(f"[{incident_id}] Metrics not found, routing to DLQ")
            await message.nack(requeue=False)
            return

        raw_logs = await database_service.get_incident_logs(incident_id, organization_id)
        if not raw_logs:
            logger.error(f"[{incident_id}] Logs not found, routing to DLQ")
            await message.nack(requeue=False)
            return

        # --- Build initial LangGraph state ------------------------------------
        initial_state: IncidentAnalysisState = {
            "incident_id": incident_id,
            "organization_id": organization_id,
            "title": incident["title"],
            "severity": incident["severity"],
            "environment": incident["environment"],
            "affected_services": _extract_affected_services(incident.get("affected_services", [])),
            "description": incident["description"],
            "metrics": {
                "cpu_usage_percent": float(metrics["cpu_usage_percent"]),
                "memory_usage_percent": float(metrics["memory_usage_percent"]),
                "error_rate_percent": float(metrics["error_rate_percent"]),
                "response_time_ms": int(metrics["response_time_ms"]),
            },
            "raw_logs": raw_logs,
            "log_analysis": None,
            "root_cause": None,
            "recommendations": [],
            "agent_statuses": {
                "LOG_ANALYSIS": "PENDING",
                "ROOT_CAUSE": "PENDING",
                "RECOMMENDATION": "PENDING",
            },
            "pipeline_errors": [],
        }

        # --- Run LangGraph pipeline -------------------------------------------
        active_analyses.inc()
        try:
            final_state = await pipeline.ainvoke(initial_state)
        finally:
            active_analyses.dec()

        duration = time.time() - pipeline_start

        # --- Determine overall analysis status --------------------------------
        statuses = final_state.get("agent_statuses", {})
        failed_count = sum(1 for s in statuses.values() if s == "FAILED")

        if failed_count == 3:
            analysis_status = "FAILED"
        elif failed_count > 0:
            analysis_status = "PARTIAL"
        else:
            analysis_status = "COMPLETED"

        analysis_pipeline_duration.labels(analysis_status=analysis_status).observe(duration)

        # --- Build result message ---------------------------------------------
        completed_at = _now_iso()
        agent_runs = [
            {
                "agent_name": name,
                "status": statuses.get(name, "FAILED"),
                "started_at": completed_at,
                "finished_at": completed_at,
                "retry_count": 0,
                "output_summary": _output_summary(name, final_state),
                "error_message": None,
            }
            for name in ["LOG_ANALYSIS", "ROOT_CAUSE", "RECOMMENDATION"]
        ]

        result_message = {
            "message_id": message_id or str(uuid4()),
            "incident_id": incident_id,
            "organization_id": organization_id,
            "analysis_status": analysis_status,
            "agent_runs": agent_runs,
            "root_cause": final_state.get("root_cause"),
            "recommendations": final_state.get("recommendations", []),
            "completed_at": completed_at,
        }

        # --- Publish result ---------------------------------------------------
        published = await rabbitmq_service.publish_result(result_message)
        if not published:
            logger.critical(f"[{incident_id}] Failed to publish result after 5 attempts")
            _save_failed_result(result_message)
            await message.nack(requeue=True)
            return

        await message.ack()
        logger.info(
            f"[{incident_id}] Pipeline finished — status={analysis_status}, "
            f"duration={duration:.1f}s"
        )

    except Exception as exc:
        logger.error(
            f"[{incident_id}] Unexpected error in message processing: {exc}",
            exc_info=True,
        )
        await message.nack(requeue=True)


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Connecting to RabbitMQ…")
    await rabbitmq_service.connect()
    await rabbitmq_service.start_consuming(process_message)
    logger.info("Application startup complete — waiting for messages")
    yield
    await rabbitmq_service.close()
    await database_service.dispose()
    logger.info("Application shutdown complete")


app = FastAPI(title="AI Incident Response Service", version="1.0.0", lifespan=lifespan)


@app.get("/health")
async def health():
    db_ok = await database_service.check_health()
    mq_ok = await rabbitmq_service.check_health()
    overall = "healthy" if (db_ok and mq_ok) else "degraded"
    return {
        "status": overall,
        "dependencies": {
            "postgresql": "ok" if db_ok else "error",
            "rabbitmq": "ok" if mq_ok else "error",
        },
    }


@app.get("/metrics")
async def metrics():
    return PlainTextResponse(
        generate_latest().decode("utf-8"),
        media_type=CONTENT_TYPE_LATEST,
    )
