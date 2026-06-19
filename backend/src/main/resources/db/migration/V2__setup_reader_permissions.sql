-- ─────────────────────────────────────────────────────────────────────────────
-- Grant FastAPI read-only access to exactly 3 tables
-- Runs after V1 creates all tables — appreader user already exists from init.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- FastAPI reads these three tables to assemble the LangGraph state
GRANT SELECT ON incidents         TO appreader;
GRANT SELECT ON incident_metrics  TO appreader;
GRANT SELECT ON incident_logs     TO appreader;

-- Explicitly deny access to sensitive tables (belt + suspenders)
REVOKE ALL ON users              FROM appreader;
REVOKE ALL ON agent_runs         FROM appreader;
REVOKE ALL ON incident_analysis  FROM appreader;
REVOKE ALL ON recommendations    FROM appreader;
