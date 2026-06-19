-- ─────────────────────────────────────────────────────────────────────────────
-- Database Initialization Script
-- Runs automatically on first PostgreSQL startup (empty data volume)
-- Creates two application users with different permission levels
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Create appwriter (Spring Boot — full CRUD) ────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'appwriter') THEN
        CREATE USER appwriter WITH PASSWORD 'devops_write_2026';
    END IF;
END $$;

GRANT ALL PRIVILEGES ON DATABASE devops_copilot TO appwriter;
GRANT ALL PRIVILEGES ON SCHEMA public TO appwriter;

-- Allow appwriter to create tables (needed for Flyway migrations)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO appwriter;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO appwriter;

-- ── 2. Create appreader (FastAPI — SELECT only on 3 tables) ─────────────────
-- Per architecture docs: FastAPI must use a read-only user.
-- Grants on the specific tables are applied by V2 Flyway migration
-- AFTER Flyway creates the tables on first Spring Boot startup.

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'appreader') THEN
        CREATE USER appreader WITH PASSWORD 'devops_read_2026';
    END IF;
END $$;

GRANT CONNECT ON DATABASE devops_copilot TO appreader;
GRANT USAGE ON SCHEMA public TO appreader;

-- appreader gets NO default privileges — only the explicit grants in V2 migration.
-- This ensures it cannot read users, agent_runs, incident_analysis, or recommendations.
