# AI Incident Response & DevOps Copilot

An event-driven platform that automatically analyzes production incidents using a multi-agent AI pipeline. When an engineer submits an incident with logs and metrics, the system runs three sequential AI agents — log analysis, root cause identification, and remediation recommendations — and delivers structured findings back to the frontend in real time.

Built as a production-grade portfolio project demonstrating microservices architecture, async messaging, LangGraph agent orchestration, and full observability.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        BROWSER (Next.js)                         │
│              Tailwind CSS + ShadcnUI + TypeScript                 │
└──────────────────────────┬───────────────────────────────────────┘
                           │ REST + WebSocket
┌──────────────────────────▼───────────────────────────────────────┐
│                    SPRING BOOT BACKEND                           │
│         Auth │ REST APIs │ Business Logic │ Event Publisher       │
│                                                                  │
│   Incident creation: atomic 3-table insert (incidents +          │
│   incident_metrics + incident_logs) — publishes only after       │
│   transaction commits (TransactionSynchronization.afterCommit)   │
│                                                                  │
│   PostgreSQL (read + write)   Redis (sessions + cache)           │
└──────────────────────────┬───────────────────────────────────────┘
                           │ AMQP: {message_id, incident_id}
┌──────────────────────────▼───────────────────────────────────────┐
│                         RABBITMQ                                 │
│   incident.analysis.queue │ incident.results.queue │ incident.dlq│
└──────────┬────────────────────────────────────────┬─────────────┘
           │ consume                                │ consume results
┌──────────▼──────────────────┐      ┌─────────────▼──────────────┐
│   FASTAPI AI SERVICE        │      │  SPRING BOOT result handler │
│                             │      │                             │
│  1. Read incident from DB   │      │  Writes: agent_runs,        │
│     (read-only PG user)     │      │  incident_analysis,         │
│  2. Build LangGraph state   │◄─────│  recommendations            │
│  3. Run 3-agent pipeline    │      │                             │
│  4. Publish results         │─────►│  Pushes WebSocket to UI     │
└──────────┬──────────────────┘      └─────────────────────────────┘
           │
┌──────────▼──────────────────────────────────┐
│              LANGGRAPH PIPELINE              │
│                                             │
│   Log Analysis Agent  ──►  raw logs         │
│          │                                  │
│   Root Cause Agent    ──►  logs + metrics   │──► Gemini 2.5 Flash
│          │                                  │
│   Recommendation Agent──►  root cause       │
└─────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 14 + TypeScript | SSR, routing, polling, WebSocket |
| UI | Tailwind CSS + ShadcnUI | Component library |
| Backend | Spring Boot 3.x (Java 21) | REST APIs, auth, event publishing |
| AI Service | FastAPI (Python 3.11) | Agent orchestration, RabbitMQ consumer |
| Agent Framework | LangGraph | Stateful 3-agent sequential pipeline |
| LLM | Gemini 2.5 Flash | Log analysis, root cause, recommendations |
| Message Broker | RabbitMQ 3 | Async reference-only messaging + DLQ |
| Database | PostgreSQL 16 | 7 normalized tables, Flyway migrations |
| Cache | Redis 7 | JWT sessions, result cache, stats cache |
| Observability | Prometheus + Grafana | 3 dashboards, 4 alert rules |
| Containers | Docker + Docker Compose | 8-service orchestration |

---

## Key Engineering Decisions

**Reference-only messaging** — Spring Boot publishes only `{incident_id}` to RabbitMQ, never the full payload. FastAPI fetches data directly from PostgreSQL using a read-only connection. This keeps messages small and eliminates the risk of stale data in transit.

**Publish-after-commit** — The RabbitMQ publish is registered via `TransactionSynchronizationManager.afterCommit()` so FastAPI never queries the database before the incident row is visible. This eliminates the race condition where the message arrives before the transaction fully commits.

**Read-only database user** — FastAPI connects to PostgreSQL as `appreader`, a user with SELECT-only grants on three specific tables. It has no INSERT, UPDATE, or DELETE permissions at the database level.

**Pipeline resilience** — If one agent fails, the pipeline continues. Results are published with `analysis_status: PARTIAL` and the frontend shows whichever agents succeeded.

**At-least-once delivery** — FastAPI acks the RabbitMQ message only after successfully publishing results back. A `@Scheduled` retry job in Spring Boot republishes any incident stuck in PENDING status for more than 3 minutes.

---

## Features

**Incident Submission**
- 10-field structured form (title, severity, environment, affected services, logs, metrics)
- Client-side and server-side validation with field-level error messages
- P1 / P2 / P3 / P4 severity classification

**AI Analysis Pipeline** (~25–60 seconds end-to-end)
- Log Analysis Agent — identifies errors, exceptions, and repeating patterns
- Root Cause Agent — synthesizes logs + metrics into a causal chain with confidence score
- Recommendation Agent — generates 3–5 prioritized, team-assigned remediation actions

**Real-time Updates**
- Agent execution timeline with per-agent status, start time, and duration
- WebSocket push when analysis completes; polling fallback every 3 seconds

**Dashboard**
- Summary cards: total incidents, active, resolved today, average analysis duration
- Sortable, filterable incident table with severity badges and status indicators

**Observability**
- Grafana dashboards: Incident Overview, Agent Performance, System Health
- Prometheus metrics for per-agent execution time, LLM inference duration, pipeline status
- Alerts: high agent failure rate, DLQ backlog, database pool saturation, slow API response

---

## Prerequisites

| Tool | Version |
|---|---|
| Java (Amazon Corretto recommended) | 21 |
| Maven | 3.9+ |
| Node.js (LTS) | 20 |
| Python | 3.11 |
| Docker Desktop | Latest |

---

## Running Locally

**1. Clone and configure environment files**

```bash
git clone https://github.com/Gaurishkumar/ai-incident-response-team.git
cd ai-incident-response-team
```

Copy the example files and fill in your values:

```bash
cp infrastructure/.env.example  infrastructure/.env
cp backend/.env.example         backend/.env
cp ai-service/.env.example      ai-service/.env
cp frontend/.env.local.example  frontend/.env.local
```

Required values to set:
- `infrastructure/.env` — set passwords for PostgreSQL, RabbitMQ, and Grafana
- `backend/.env` — set `JWT_SECRET` (generate with `openssl rand -hex 32`), match the passwords from above
- `ai-service/.env` — set `GEMINI_API_KEY` (get one free at [aistudio.google.com](https://aistudio.google.com)), match passwords from above

**2. Build service images**

```bash
cd infrastructure
docker compose build
```

**3. Start infrastructure first**

```bash
docker compose up postgres redis rabbitmq -d
```

Wait until all three are healthy (check with `docker compose ps`).

**4. Start application services**

```bash
docker compose up spring-boot fastapi frontend -d
```

Wait for Spring Boot to log `Started BackendApplication` — Flyway will automatically create all 7 database tables on first startup.

**5. Start monitoring**

```bash
docker compose up prometheus grafana -d
```

**6. Open the app**

| Service | URL | Credentials |
|---|---|---|
| Frontend | http://localhost:3000 | Register a new account |
| Grafana | http://localhost:3001 | Set in `infrastructure/.env` |
| RabbitMQ Management | http://localhost:15672 | Set in `infrastructure/.env` |
| Prometheus | http://localhost:9090 | No auth |
| Spring Boot API | http://localhost:8080 | — |
| FastAPI | http://localhost:8000/health | — |

**Bootstrap super admin**

The backend seeds a local super admin on startup if no `system_admins` row exists yet.

- Email: `admin@local.test`
- Username: `admin`
- Password: `Admin123!`

---

## Project Structure

```
/
├── frontend/          Next.js 14 application (4 pages, 33 components)
├── backend/           Spring Boot 3.x (Java 21, Maven)
│   └── src/main/resources/db/migration/   Flyway SQL migrations
├── ai-service/        FastAPI + LangGraph (Python 3.11)
│   └── app/
│       ├── agents/    log_analysis, root_cause, recommendation
│       ├── pipeline/  LangGraph graph definition
│       └── services/  gemini, rabbitmq, database
└── infrastructure/
    ├── docker-compose.yml
    ├── db/init.sql              PostgreSQL user setup
    ├── prometheus/              Scrape config + alert rules
    └── grafana/                 Dashboard JSON + provisioning
```

---

## Database Schema

7 normalized tables across two responsibility domains:

| Table | Owner | Purpose |
|---|---|---|
| `users` | Spring Boot | Auth and identity |
| `incidents` | Spring Boot | Core incident metadata |
| `incident_metrics` | Spring Boot | CPU, memory, error rate, response time |
| `incident_logs` | Spring Boot | Raw log content (separated to avoid bloating incident queries) |
| `agent_runs` | Spring Boot (via result handler) | Execution history for each of the 3 agents |
| `incident_analysis` | Spring Boot (via result handler) | Root cause findings |
| `recommendations` | Spring Boot (via result handler) | Ordered remediation actions |

FastAPI has SELECT-only access on `incidents`, `incident_metrics`, and `incident_logs`. It cannot read or write to any other table.

---

## API Overview

All endpoints require `Authorization: Bearer {token}` except auth routes.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Get JWT token |
| POST | `/api/v1/auth/logout` | Invalidate session |
| POST | `/api/v1/incidents` | Submit a new incident |
| GET | `/api/v1/incidents` | List incidents (paginated, filterable) |
| GET | `/api/v1/incidents/{id}` | Full incident detail with analysis |
| GET | `/api/v1/incidents/{id}/status` | Lightweight polling endpoint (2 queries) |
| GET | `/api/v1/dashboard/stats` | Aggregate stats (Redis cached, 2-min TTL) |
| WS | `/ws/incidents/{id}` | Push notification when analysis completes |

---

## Grafana Dashboards

**Incident Overview** — total incidents over time, average analysis duration, resolution rate, HTTP request rate breakdown by endpoint

**Agent Performance** — per-agent execution time (p50/p95/p99), LLM inference duration, agent failure totals, active pipeline count

**System Health** — database connection pool (active/idle/pending), RabbitMQ queue depths, API error rate, DLQ depth

---

## What's Deferred to V2

Per the project specification, the following are intentionally out of scope for V1:

- Jira ticket generation
- Slack / PagerDuty notifications
- CloudWatch / Datadog log ingestion
- Prometheus alert ingestion
- Settings UI for LLM provider configuration
