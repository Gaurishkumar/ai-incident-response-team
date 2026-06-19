-- ============================================================
-- V1: Create all 7 tables for the AI Incident Response platform
-- ============================================================

-- 1. users
CREATE TABLE users (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(100) NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(50)  NOT NULL DEFAULT 'DEVELOPER'
                        CHECK (role IN ('DEVELOPER', 'ADMIN')),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE
);

-- 2. incidents
CREATE TABLE incidents (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title                VARCHAR(120) NOT NULL,
    description          TEXT         NOT NULL,
    environment          VARCHAR(50)  NOT NULL
                             CHECK (environment IN ('production', 'staging', 'development')),
    severity             VARCHAR(10)  NOT NULL
                             CHECK (severity IN ('P1', 'P2', 'P3', 'P4')),
    status               VARCHAR(50)  NOT NULL DEFAULT 'PENDING'
                             CHECK (status IN ('PENDING', 'ANALYZING', 'RESOLVED', 'FAILED')),
    affected_services    TEXT[]       NOT NULL,
    created_by           UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    analysis_started_at  TIMESTAMPTZ,
    resolved_at          TIMESTAMPTZ
);

-- 3. incident_metrics
CREATE TABLE incident_metrics (
    id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id           UUID         NOT NULL UNIQUE REFERENCES incidents(id) ON DELETE CASCADE,
    cpu_usage_percent     DECIMAL(5,2) NOT NULL,
    memory_usage_percent  DECIMAL(5,2) NOT NULL,
    error_rate_percent    DECIMAL(5,2) NOT NULL,
    response_time_ms      INTEGER      NOT NULL,
    recorded_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 4. incident_logs
CREATE TABLE incident_logs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     UUID        NOT NULL UNIQUE REFERENCES incidents(id) ON DELETE CASCADE,
    raw_log_content TEXT        NOT NULL,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. agent_runs
CREATE TABLE agent_runs (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id   UUID        NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    agent_name    VARCHAR(100) NOT NULL
                      CHECK (agent_name IN ('LOG_ANALYSIS', 'ROOT_CAUSE', 'RECOMMENDATION')),
    status        VARCHAR(50)  NOT NULL
                      CHECK (status IN ('COMPLETED', 'FAILED')),
    started_at    TIMESTAMPTZ,
    finished_at   TIMESTAMPTZ,
    retry_count   INTEGER      NOT NULL DEFAULT 0,
    output_summary TEXT,
    error_message  TEXT
);

-- 6. incident_analysis
CREATE TABLE incident_analysis (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id          UUID         NOT NULL UNIQUE REFERENCES incidents(id) ON DELETE CASCADE,
    primary_cause        TEXT,
    causal_chain         JSONB,
    confidence_score     INTEGER
                             CHECK (confidence_score BETWEEN 0 AND 100),
    root_cause_category  VARCHAR(100)
                             CHECK (root_cause_category IN
                                 ('Infrastructure', 'Code Bug', 'Configuration', 'External', 'Unknown')),
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 7. recommendations
CREATE TABLE recommendations (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id          UUID         NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    recommendation_order INTEGER      NOT NULL,
    action               TEXT         NOT NULL,
    rationale            TEXT,
    priority             VARCHAR(50)
                             CHECK (priority IN ('Immediate', 'Short-term', 'Long-term')),
    responsible_team     VARCHAR(100)
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_incidents_created_by     ON incidents(created_by);
CREATE INDEX idx_incidents_status         ON incidents(status);
CREATE INDEX idx_incidents_severity       ON incidents(severity);
CREATE INDEX idx_incidents_created_at_desc ON incidents(created_at DESC);
CREATE INDEX idx_agent_runs_incident_id   ON agent_runs(incident_id);
CREATE INDEX idx_recommendations_incident_id ON recommendations(incident_id);
