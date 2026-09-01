import logging
from typing import Any, Dict, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings

logger = logging.getLogger(__name__)


def _to_async_url(url: str) -> str:
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


class DatabaseService:
    def __init__(self):
        async_url = _to_async_url(settings.POSTGRES_READ_URL)
        self._engine = create_async_engine(
            async_url,
            pool_size=5,
            max_overflow=5,
            pool_pre_ping=True,
        )
        self._session_factory = sessionmaker(
            bind=self._engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

    async def get_incident(self, incident_id: str, organization_id: str) -> Optional[Dict[str, Any]]:
        async with self._session_factory() as session:
            result = await session.execute(
                text(
                    "SELECT id, title, description, environment, severity, status, "
                    "affected_services, created_by, organization_id, created_at, analysis_started_at, resolved_at "
                    "FROM incidents WHERE id = :id AND organization_id = :organization_id"
                ),
                {"id": incident_id, "organization_id": organization_id},
            )
            row = result.mappings().first()
            return dict(row) if row else None

    async def get_incident_metrics(self, incident_id: str, organization_id: str) -> Optional[Dict[str, Any]]:
        async with self._session_factory() as session:
            result = await session.execute(
                text(
                    "SELECT m.cpu_usage_percent, m.memory_usage_percent, "
                    "m.error_rate_percent, m.response_time_ms "
                    "FROM incident_metrics m "
                    "JOIN incidents i ON i.id = m.incident_id "
                    "WHERE m.incident_id = :incident_id AND i.organization_id = :organization_id"
                ),
                {"incident_id": incident_id, "organization_id": organization_id},
            )
            row = result.mappings().first()
            return dict(row) if row else None

    async def get_incident_logs(self, incident_id: str, organization_id: str) -> Optional[str]:
        async with self._session_factory() as session:
            result = await session.execute(
                text(
                    "SELECT l.raw_log_content FROM incident_logs l "
                    "JOIN incidents i ON i.id = l.incident_id "
                    "WHERE l.incident_id = :incident_id AND i.organization_id = :organization_id"
                ),
                {"incident_id": incident_id, "organization_id": organization_id},
            )
            row = result.first()
            return row[0] if row else None

    async def check_health(self) -> bool:
        try:
            async with self._session_factory() as session:
                await session.execute(text("SELECT 1"))
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False

    async def dispose(self):
        await self._engine.dispose()


database_service = DatabaseService()
