AI Incident Response & DevOps Copilot Platform
Technical Documentation — Version 2.0
---
1. Feasibility Report
Overall Assessment: Feasible — V2 Scope Is Well-Calibrated for Student Execution
The V2 scope is meaningfully more feasible than V1 while retaining all the impressive engineering concepts that matter for placement interviews. The reduction from 6 to 3 agents, the removal of external integrations, and the simplification of the RabbitMQ contract collectively reduce estimated development time from 8–10 weeks to 5–7 weeks for a team of 3–4 developers.
---
Risk Analysis
Risk 2: LangGraph Learning Curve (Severity: MEDIUM, reduced from V1)
With only 3 agents in a strictly linear flow, the LangGraph graph is now a straightforward sequential pipeline. The risk of accidental cycles or state corruption is significantly lower than a 6-agent design.
Mitigation: The LangGraph state schema defined in the Frozen Contracts section must not be modified after development begins. Any agent that fails should update `agent_statuses` and `pipeline_errors` in state, then pass control to the next agent — never halt the pipeline.
Risk 3: FastAPI PostgreSQL Read Access (Severity: LOW — New in V2)
FastAPI now reads from PostgreSQL after receiving a reference-only RabbitMQ message. This is a new connection that does not exist in V1. Both Spring Boot and FastAPI hold simultaneous connections to the same database.
Mitigation: FastAPI uses a separate, read-only PostgreSQL user with SELECT-only permissions on the `incidents`, `incident_metrics`, and `incident_logs` tables. It has no INSERT, UPDATE, or DELETE permissions. This prevents accidental writes from the AI service. Document this database user setup explicitly in the infrastructure setup steps.
Risk 4: Docker Compose Startup Ordering (Severity: LOW-MEDIUM, unchanged)
Eight services with health-check dependencies require careful startup ordering.
Mitigation: Build and test services incrementally. Start with PostgreSQL alone, then add Redis, then RabbitMQ, then Spring Boot, then FastAPI. Never attempt to start all 8 services simultaneously during first setup. Add services one at a time, verifying each before proceeding.
Risk 5: Database Transaction Scope for Incident Creation (Severity: LOW — New in V2)
Spring Boot must insert into three tables (incidents, incident_metrics, incident_logs) in a single atomic transaction. If any of the three inserts fail, all three must roll back. If RabbitMQ publish fails after the transaction commits, the incident exists in the database but no analysis is triggered.
Mitigation: Use Spring's `@Transactional` annotation on the incident creation service method. For RabbitMQ publish failures, a scheduled retry job checks for incidents with status `PENDING` that are older than 2 minutes and republishes their reference. This handles the case where the transaction committed but the RabbitMQ publish failed.
---
Free Tier Cost Assessment
Service	Approach	Cost
PostgreSQL	Docker container	Free
Redis	Docker container	Free
RabbitMQ	Docker container	Free
Spring Boot	Self-hosted	Free
FastAPI	Self-hosted	Free
LangGraph	Open source Python library	Free
Prometheus + Grafana	Docker containers	Free
Docker + Docker Compose	Free tier	Free
AWS EC2 t3.micro (staging)	Free tier, 12 months	Free
Gemini API student tier	15 RPM limit on free tier	Free but risky for multi-agent concurrent use
Total build and demo cost: $0, 
---
V2 Recommendations Summary
Freeze all five contracts defined in Section B before writing any service code.
FastAPI's PostgreSQL user must be read-only — never use the same credentials as Spring Boot.
Build the 3-agent pipeline linearly; do not introduce conditional branching until all three agents produce correct outputs end-to-end.
The frontend Incident Detail page should have exactly 3 result tabs for V1: Root Cause, Recommendations, and Raw Data. No ticket tab.
All external integrations (Jira, Slack, CloudWatch, Datadog, Prometheus alert ingestion) are deferred to V2.
---
---
2. Complete Technical Documentation
---
A. Project Overview
V1 System Diagram
```
┌──────────────────────────────────────────────────────────────────────┐
│                          USER (Browser)                              │
│                  Next.js + Tailwind + ShadcnUI                       │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ HTTPS REST + Polling / WebSocket
┌───────────────────────────────▼──────────────────────────────────────┐
│                     SPRING BOOT BACKEND                              │
│        Auth │ REST APIs │ Business Logic │ RabbitMQ Publisher        │
│                                                                      │
│   On incident creation, writes to THREE tables atomically:           │
│   incidents + incident_metrics + incident_logs                        │
│                                                                      │
│   Connected to: PostgreSQL (read + write) + Redis (cache/sessions)   │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ AMQP Publish: {messageId, incidentId}
                                │ (Reference only — NOT full payload)
┌───────────────────────────────▼──────────────────────────────────────┐
│                           RABBITMQ                                   │
│     incident.analysis.queue  │  incident.results.queue               │
│     incident.dlq  (Dead Letter Queue)                                │
└──────────────┬─────────────────────────────────────┬────────────────┘
               │ Consume {incidentId}                 │ Consume Results
┌──────────────▼──────────────────┐     ┌────────────▼────────────────┐
│    FASTAPI AI SERVICE           │     │  SPRING BOOT Result Handler  │
│                                 │     │                              │
│  Step 1: Receive {incidentId}   │     │  Writes to PostgreSQL:       │
│  Step 2: Fetch from PostgreSQL  │◄────│  - agent_runs                │
│          (incidents, metrics,   │     │  - incident_analysis         │
│           logs tables)          │     │  - recommendations           │
│  Step 3: Build LangGraph State  │     │                              │
│  Step 4: Run 3-Agent Pipeline   │     │  Notifies frontend via WS    │
│  Step 5: Publish Results        │─────►                              │
└──────────────│──────────────────┘     └─────────────────────────────┘
               │
    ┌──────────▼──────────────────────────────┐
    │          LANGGRAPH PIPELINE             │
    │                                         │
    │   ┌───────────────────────────────┐     │         ┌───────────────────┐
    │   │    Log Analysis Agent         │─LLM─┼────────►│  Gemini student pro tier │
    │   └───────────────────────────────┘     │         │                   │
    │                    ↓                    │         │                   │
    │   ┌───────────────────────────────┐     │         │  chances of  rate limits    │
    │   │    Root Cause Agent           │─LLM─┼────────►└───────────────────┘
    │   └───────────────────────────────┘     │
    │                    ↓                    │
    │   ┌───────────────────────────────┐     │
    │   │    Recommendation Agent       │─LLM─┼────────►(gemini tier)
    │   └───────────────────────────────┘     │
    └─────────────────────────────────────────┘

┌──────────────────────────────┐    ┌───────────────────────────────┐
│         POSTGRESQL           │    │          REDIS CACHE           │
│  7 normalized tables         │    │  Sessions │ Incident Cache     │
│  Spring Boot: read + write   │    │  Dashboard Stats               │
│  FastAPI: read-only          │    │                               │
└──────────────────────────────┘    └───────────────────────────────┘

┌──────────────────────────────┐    ┌───────────────────────────────┐
│          PROMETHEUS          │    │            GRAFANA             │
│  Scrapes metrics endpoints   │    │  Dashboards & Alerting         │
└──────────────────────────────┘    └───────────────────────────────┘
```
---
High-Level Architecture Description
The V1 system follows a hybrid microservices event-driven architecture with two backend services that communicate exclusively through RabbitMQ.
Spring Boot owns all synchronous user-facing operations: authentication, incident creation, data persistence, result storage, and frontend communication. It is the sole writer to PostgreSQL. When an incident is submitted, it saves data to three tables in one atomic transaction, then publishes a lightweight reference message to RabbitMQ containing only the incident ID.
FastAPI owns all asynchronous AI processing. It receives the reference message from RabbitMQ, fetches the full incident data directly from PostgreSQL using a read-only connection, runs the three-agent LangGraph pipeline, and publishes the structured results back to RabbitMQ. It never directly notifies the frontend and never writes to the database.
This design means each service has a single, clear responsibility. Spring Boot manages data and users. FastAPI manages intelligence. RabbitMQ coordinates the handoff between them using the smallest possible message.
---
Technology Stack Summary
Layer	Technology	Purpose	Cost
Frontend	Next.js 14 + TypeScript	SSR, SPA routing, API communication	Free
UI Components	Tailwind CSS + ShadcnUI	Styling, accessible component library	Free
Backend API	Spring Boot 3.x (Java 21)	REST APIs, authentication, data persistence, event publishing	Free
AI Orchestration	FastAPI (Python 3.11)	Async agent execution, PostgreSQL reads, RabbitMQ consumer	Free
Agent Framework	LangGraph (Python)	Stateful 3-agent sequential pipeline	Free
LLM (Secondary)	Gemini student pro (2.5 flash)	default	Student pro tier ,  risky
Message Broker	RabbitMQ 3.12	Reference-only job signaling, result delivery	Free
Primary Database	PostgreSQL 16	7 normalized tables — all persistent data	Free
Cache + Sessions	Redis 7	Session management, incident result caching, stats caching	Free
Monitoring	Prometheus + Grafana	Metrics collection and dashboard visualization	Free
Containerization	Docker + Docker Compose	Service orchestration for all 8 services	Free
---
Website Design & User Requirements (V1 Scope)
The V1 frontend consists of four pages.
---
Page 1 — Authentication Pages (Login and Register)
Standard login and register screens. Login accepts email and password and issues a JWT token stored in an HTTP-only cookie. The register page accepts username, email, password, and role (Developer or Admin). All fields have inline validation. These pages contain no application-specific logic.
---
Page 2 — Dashboard (Primary Landing Page)
The landing page after login. Contains:
Four summary metric cards: Total Incidents, Active Incidents (status is ANALYZING or PENDING), Resolved Today, and Average Analysis Duration in minutes.
A sortable, filterable incident table showing the 20 most recent incidents. Columns: Title, Severity Badge (P1–P4 color-coded), Status (Pending / Analyzing / Resolved / Failed), Affected Services (displayed as compact tags), Submitted By, and Time Elapsed.
A "Submit New Incident" button in the page header that navigates to Page 3.
Clicking any incident row navigates to Page 4 (Incident Detail).
---
Page 3 — Incident Submission Page
The incident intake form. This is the primary user entry point for V1. The form has exactly 10 required fields with no optional fields in V1.
V1 Input Fields:
#	Field	UI Control	Constraint
1	Incident Title	Text input	Min 10, Max 120 characters
2	Description	Text area	Min 50, Max 2000 characters
3	Environment	Dropdown	One of: Production, Staging, Development
4	Severity Level	Segmented radio	One of: P1 Critical, P2 High, P3 Medium, P4 Low
5	Affected Services	Multi-tag input	Min 1 tag, Max 20 tags, each tag max 50 characters
6	Log Content	Monospace text area	Min 50, Max 5000 characters
7	CPU Usage (%)	Number input	0 to 100
8	Memory Usage (%)	Number input	0 to 100
9	Error Rate (%)	Number input	0 to 100
10	Response Time (ms)	Number input	Positive integer, max 60000
All 10 fields are required. No optional fields exist in V1. Throughput (requests per second) has been deferred to V2 as it is not needed for log-based root cause analysis.
The submit button is disabled until all fields pass client-side validation. On successful submission, the user is redirected to the Incident Detail page for the newly created incident.
Industry Context for Input Design:
Companies like PagerDuty and Datadog accept incident inputs through structured JSON webhook payloads. Our form mirrors the same logical fields a developer would fill when manually creating an incident in PagerDuty: title, environment, severity, affected service list, and contextual data (logs + metrics). The key difference is that V1 accepts logs as pasted text rather than as a live stream connection. This is intentional for simplicity and can be upgraded in V2 with direct log aggregator integration.
---
Page 4 — Incident Detail Page
The central analysis display page. Contains:
Incident Header: Title, Severity Badge, Status indicator (animated pulse while Analyzing), Environment tag, Submitted By, and Created timestamp.
Agent Execution Timeline: A vertical 3-card timeline showing each agent's execution state in sequence. Each card displays: Agent Name, Status icon (Pending / Running / Completed / Failed), Start Time, End Time, Duration, and a collapsible output summary with 2–3 lines of findings.
Tabbed Results Section with exactly 3 tabs in V1:
Root Cause Tab: Primary cause statement, causal chain as a numbered step-by-step cascade, confidence score as a percentage badge, and root cause category label (Infrastructure / Code Bug / Configuration / External / Unknown).
Recommendations Tab: A numbered list of recommended actions, each showing the action text, rationale, priority badge (Immediate / Short-term / Long-term), and responsible team.
Raw Data Tab: Split view — submitted log content on the left, metrics values on the right.
Action buttons: Mark Resolved, Re-Run Analysis.
There is no Generated Ticket tab in V1. This is deferred to V2 once the core analysis pipeline is stable.
There is no Settings page in V1. LLM provider configuration is managed through environment variables, not a UI panel.
---
---
B. ⚠️ Frozen Contracts — Must Be Agreed Before Development Begins
This section defines the five contracts that every team member and every service depends on. These contracts must be reviewed, agreed upon, and considered immutable before any implementation code is written. Any change to a frozen contract after development has begun requires a team meeting and explicit version increment of the affected contract.
The seniors are correct: integration failures between student-built services are almost always caused by one developer's output not matching another developer's expected input. Freezing these contracts eliminates that class of problem entirely.
---
Contract 1: Incident Creation Input Schema
This defines exactly what the frontend sends to Spring Boot when a user submits a new incident. Both the frontend developer and the backend developer must build against this schema.
Field: `incident_title`
Type: String
Required: Yes
Constraint: Minimum 10 characters, maximum 120 characters
Field: `description`
Type: String
Required: Yes
Constraint: Minimum 50 characters, maximum 2000 characters
Field: `environment`
Type: String (enumerated)
Required: Yes
Allowed values: `production`, `staging`, `development`
Field: `severity`
Type: String (enumerated)
Required: Yes
Allowed values: `P1`, `P2`, `P3`, `P4`
Field: `affected_services`
Type: Array of Strings
Required: Yes
Constraint: Minimum 1 item, maximum 20 items, each item maximum 50 characters, alphanumeric characters and hyphens only
Field: `raw_logs`
Type: String
Required: Yes
Constraint: Minimum 50 characters, maximum 5000 characters
Field: `metrics`
Type: Nested object
Required: Yes
Sub-fields:
Sub-field	Type	Required	Constraint
cpu_usage_percent	Decimal	Yes	0.0 to 100.0 inclusive
memory_usage_percent	Decimal	Yes	0.0 to 100.0 inclusive
error_rate_percent	Decimal	Yes	0.0 to 100.0 inclusive
response_time_ms	Integer	Yes	Positive integer, maximum 60000
Total: 10 required input fields (6 top-level + 4 metric sub-fields). No optional fields in V1. This schema is frozen.
---
Contract 2: Database Table Schemas
Seven tables. Organized by responsibility. No table stores data outside its domain.
---
Table 1: `users`
Purpose: User authentication, identity, and role management.
Column	Type	Constraints
id	UUID	PRIMARY KEY, DEFAULT gen_random_uuid()
username	VARCHAR(100)	NOT NULL, UNIQUE
email	VARCHAR(255)	NOT NULL, UNIQUE
password_hash	VARCHAR(255)	NOT NULL
role	VARCHAR(50)	NOT NULL, DEFAULT 'DEVELOPER' — allowed: DEVELOPER, ADMIN
created_at	TIMESTAMPTZ	NOT NULL, DEFAULT NOW()
last_login_at	TIMESTAMPTZ	NULLABLE
is_active	BOOLEAN	NOT NULL, DEFAULT TRUE
---
Table 2: `incidents`
Purpose: The central entity of the platform. Core incident metadata only. No logs. No metrics.
Column	Type	Constraints
id	UUID	PRIMARY KEY, DEFAULT gen_random_uuid()
title	VARCHAR(120)	NOT NULL
description	TEXT	NOT NULL
environment	VARCHAR(50)	NOT NULL — allowed: production, staging, development
severity	VARCHAR(10)	NOT NULL — allowed: P1, P2, P3, P4
status	VARCHAR(50)	NOT NULL, DEFAULT 'PENDING' — allowed: PENDING, ANALYZING, RESOLVED, FAILED
affected_services	TEXT[]	NOT NULL
created_by	UUID	NOT NULL, FK → users.id ON DELETE RESTRICT
created_at	TIMESTAMPTZ	NOT NULL, DEFAULT NOW()
analysis_started_at	TIMESTAMPTZ	NULLABLE — set when FastAPI begins processing
resolved_at	TIMESTAMPTZ	NULLABLE — set when pipeline completes
Why no logs or metrics here: Logs can exceed 5000 characters and would significantly bloat this table over time, making queries that only need incident metadata unnecessarily expensive. Metrics are operational measurements that conceptually belong in their own domain. Separating them follows proper normalization and makes the schema extensible (V2 could allow multiple metric snapshots or multiple log uploads per incident without changing this table).
---
Table 3: `incident_metrics`
Purpose: Stores the operational metric snapshot submitted with each incident. Separate from incidents because metrics represent system state data, not incident metadata.
Column	Type	Constraints
id	UUID	PRIMARY KEY, DEFAULT gen_random_uuid()
incident_id	UUID	NOT NULL, UNIQUE, FK → incidents.id ON DELETE CASCADE
cpu_usage_percent	DECIMAL(5,2)	NOT NULL
memory_usage_percent	DECIMAL(5,2)	NOT NULL
error_rate_percent	DECIMAL(5,2)	NOT NULL
response_time_ms	INTEGER	NOT NULL
recorded_at	TIMESTAMPTZ	NOT NULL, DEFAULT NOW()
The UNIQUE constraint on `incident_id` enforces exactly one metrics record per incident in V1. In V2, this constraint can be relaxed to allow historical metric series.
---
Table 4: `incident_logs`
Purpose: Stores the raw log content submitted with each incident. Separate from incidents to prevent large text from bloating the central incidents table and slowing down list queries.
Column	Type	Constraints
id	UUID	PRIMARY KEY, DEFAULT gen_random_uuid()
incident_id	UUID	NOT NULL, UNIQUE, FK → incidents.id ON DELETE CASCADE
raw_log_content	TEXT	NOT NULL
submitted_at	TIMESTAMPTZ	NOT NULL, DEFAULT NOW()
The UNIQUE constraint on `incident_id` enforces exactly one log record per incident in V1. In V2, this could allow multiple log uploads (e.g., application logs + infrastructure logs as separate records).
---
Table 5: `agent_runs`
Purpose: Records the execution history of each agent for each incident. This is what powers the Agent Execution Timeline in the frontend.
Column	Type	Constraints
id	UUID	PRIMARY KEY, DEFAULT gen_random_uuid()
incident_id	UUID	NOT NULL, FK → incidents.id ON DELETE CASCADE
agent_name	VARCHAR(100)	NOT NULL — allowed: LOG_ANALYSIS, ROOT_CAUSE, RECOMMENDATION
status	VARCHAR(50)	NOT NULL — allowed: COMPLETED, FAILED
started_at	TIMESTAMPTZ	NULLABLE
finished_at	TIMESTAMPTZ	NULLABLE
retry_count	INTEGER	NOT NULL, DEFAULT 0
output_summary	TEXT	NULLABLE — 2–3 line plain-English summary of agent findings
error_message	TEXT	NULLABLE — populated only when status is FAILED
Each analysis run produces exactly 3 rows in this table (one per agent). In V2, an Orchestrator row could be added.
---
Table 6: `incident_analysis`
Purpose: Stores the root cause assessment produced by the Root Cause Agent. This is the primary analytical output of the system.
Column	Type	Constraints
id	UUID	PRIMARY KEY, DEFAULT gen_random_uuid()
incident_id	UUID	NOT NULL, UNIQUE, FK → incidents.id ON DELETE CASCADE
primary_cause	TEXT	NULLABLE — the root cause in 1–2 sentences
causal_chain	JSONB	NULLABLE — ordered array of causation step strings
confidence_score	INTEGER	NULLABLE — 0 to 100
root_cause_category	VARCHAR(100)	NULLABLE — Infrastructure, Code Bug, Configuration, External, Unknown
created_at	TIMESTAMPTZ	NOT NULL, DEFAULT NOW()
---
Table 7: `recommendations`
Purpose: Stores the recommended remediation actions produced by the Recommendation Agent.
Column	Type	Constraints
id	UUID	PRIMARY KEY, DEFAULT gen_random_uuid()
incident_id	UUID	NOT NULL, FK → incidents.id ON DELETE CASCADE
recommendation_order	INTEGER	NOT NULL — display order, starting at 1
action	TEXT	NOT NULL — the specific recommended action
rationale	TEXT	NULLABLE — why this action addresses the root cause
priority	VARCHAR(50)	NULLABLE — Immediate, Short-term, or Long-term
responsible_team	VARCHAR(100)	NULLABLE — which team should execute this
---
Table Relationships:
Relationship	Type	On Delete
incidents → users	Many incidents per user	RESTRICT (cannot delete user who has incidents)
incident_metrics → incidents	One metrics record per incident (1:1)	CASCADE
incident_logs → incidents	One log record per incident (1:1)	CASCADE
agent_runs → incidents	Three agent run records per incident (1:many)	CASCADE
incident_analysis → incidents	One analysis record per incident (1:1)	CASCADE
recommendations → incidents	Multiple recommendation records per incident (1:many)	CASCADE
---
Database Indexes:
Index	Table	Column	Purpose
idx_incidents_created_by	incidents	created_by	Filter by submitting user
idx_incidents_status	incidents	status	Filter active vs. resolved
idx_incidents_severity	incidents	severity	Priority-based filtering
idx_incidents_created_at_desc	incidents	created_at DESC	Time-ordered dashboard listing
idx_agent_runs_incident_id	agent_runs	incident_id	Fetch all agent runs per incident
idx_recommendations_incident_id	recommendations	incident_id	Fetch recommendations per incident
---
Contract 3: RabbitMQ Message Schemas
Two message types exist. Both are small and contain no large data fields.
---
Message Type A: IncidentAnalysisRequestMessage
Published by: Spring Boot
Consumed by: FastAPI
Exchange: `incident.analysis.exchange`
Routing Key: `incident.analysis`
Queue: `incident.analysis.queue`
Field	Type	Description
message_id	UUID String	Unique identifier for this message — used for idempotency
incident_id	UUID String	The incident to be analyzed — this is the only reference FastAPI needs
published_at	ISO 8601 String	When Spring Boot published this message
This message contains no log content, no metrics data, no description, no title. It is a pure reference signal: "Please analyze incident with this ID." FastAPI retrieves all data it needs directly from PostgreSQL.
---
Message Type B: IncidentAnalysisResultMessage
Published by: FastAPI
Consumed by: Spring Boot
Exchange: `incident.results.exchange`
Routing Key: `incident.results`
Queue: `incident.results.queue`
Field	Type	Description
message_id	UUID String	Echo of the original request message_id
incident_id	UUID String	The incident that was analyzed
analysis_status	String	One of: COMPLETED, PARTIAL, FAILED
agent_runs	Array of AgentRunResult	Execution details for each of the 3 agents
root_cause	RootCauseResult Object or null	Root cause findings (null if Root Cause Agent failed)
recommendations	Array of RecommendationResult	Recommended actions (empty array if Recommendation Agent failed)
completed_at	ISO 8601 String	When the pipeline finished
AgentRunResult object fields:
Field	Type	Description
agent_name	String	LOG_ANALYSIS, ROOT_CAUSE, or RECOMMENDATION
status	String	COMPLETED or FAILED
started_at	ISO 8601 String	When this agent started
finished_at	ISO 8601 String	When this agent finished
retry_count	Integer	How many retries were attempted
output_summary	String or null	2–3 line plain-English summary of findings
error_message	String or null	Error details if status is FAILED
RootCauseResult object fields:
Field	Type	Description
primary_cause	String	Root cause in 1–2 sentences
causal_chain	Array of Strings	Ordered causation steps
confidence_score	Integer	0–100
root_cause_category	String	Infrastructure, Code Bug, Configuration, External, or Unknown
RecommendationResult object fields:
Field	Type	Description
recommendation_order	Integer	Display order starting at 1
action	String	The specific recommended action
rationale	String	Why this addresses the root cause
priority	String	Immediate, Short-term, or Long-term
responsible_team	String	Which team should execute this
---
Contract 4: LangGraph State Schema
The `IncidentAnalysisState` is the shared object that all three agents read from and write to. It is initialized by FastAPI before the pipeline starts. This schema must not be altered after development begins. If a field needs to be added, it must be approved by the full team since it affects all agents.
Field	Type	Set By	Description
incident_id	UUID String	FastAPI (initializer)	Reference to the incident
title	String	FastAPI (initializer)	Incident title
severity	String	FastAPI (initializer)	P1 through P4
environment	String	FastAPI (initializer)	production, staging, or development
affected_services	List of Strings	FastAPI (initializer)	Service names from user input
description	String	FastAPI (initializer)	User-written incident context
metrics	Dictionary	FastAPI (initializer)	Keys: cpu_usage_percent, memory_usage_percent, error_rate_percent, response_time_ms
raw_logs	String	FastAPI (initializer)	Raw log content from incident_logs table
log_analysis	Dictionary or None	Log Analysis Agent	Structured findings from log analysis
root_cause	Dictionary or None	Root Cause Agent	Root cause assessment
recommendations	List of Dictionaries	Recommendation Agent	List of recommended actions
agent_statuses	Dictionary (String to String)	All agents	Maps each agent name to its current status
pipeline_errors	List of Strings	All agents	Accumulated error messages from any failed agents
The `agent_statuses` dictionary contains exactly three keys at all times: `LOG_ANALYSIS`, `ROOT_CAUSE`, and `RECOMMENDATION`. Each maps to one of: `PENDING`, `RUNNING`, `COMPLETED`, or `FAILED`.
---
Contract 5: Agent Output Schemas
These define exactly what each agent writes to the LangGraph state. Agents must produce outputs that conform to these schemas exactly. If an agent cannot produce output (due to LLM failure), it must write `None` for its output field and `FAILED` for its entry in `agent_statuses`.
---
Log Analysis Agent Output — written to `log_analysis` field:
Sub-field	Type	Description
errors_found	List of Strings	Each distinct error message identified in the logs
exceptions	List of Strings	Each exception class name and message string
error_patterns	List of Strings	Repeating error patterns (e.g., "Connection refused appears 47 times")
log_summary	String	2–3 sentence plain-English summary of what the logs reveal
---
Root Cause Agent Output — written to `root_cause` field:
Sub-field	Type	Description
primary_cause	String	The root cause stated in 1–2 sentences
causal_chain	List of Strings	Ordered causation steps describing the failure cascade
confidence_score	Integer	0–100 reflecting how confidently the cause was identified
root_cause_category	String	One of: Infrastructure, Code Bug, Configuration, External, Unknown
---
Recommendation Agent Output — written to `recommendations` field:
Each item in the list:
Sub-field	Type	Description
recommendation_order	Integer	Priority rank, starting at 1
action	String	The specific action to take — must be concrete, not vague
rationale	String	Why this action addresses the identified root cause
priority	String	One of: Immediate, Short-term, Long-term
responsible_team	String	Which team executes this: Database, Infrastructure, Application Engineering, or Monitoring
The Recommendation Agent must produce between 3 and 5 recommendations. Never fewer than 3, never more than 5.
---
---
C. Component Documentation
---
Component 1: Frontend (Next.js 14 + TypeScript + Tailwind CSS + ShadcnUI)
Role in the Project: The frontend is the sole interface through which users interact with the platform. It submits incidents, displays real-time agent execution progress via polling, and renders analysis results. It communicates exclusively with the Spring Boot backend. It has no knowledge of FastAPI, RabbitMQ, PostgreSQL, Redis, LLM, or any other internal service.
---
Input Specification:
The frontend accepts user input through the 10-field incident submission form defined in Frozen Contract 1. Validation rules are identical to those in Contract 1. Validation runs on field blur (per-field, as the user tabs away) and on form submit (all fields simultaneously). The submit button is disabled until there are no validation errors.
---
Processing Logic:
User fills all 10 required form fields.
Client-side validation runs. If any field fails, inline errors appear adjacent to the failing field and no network request is made.
On all fields valid, the frontend assembles the `IncidentCreateRequest` JSON object from the form values and sends it via `POST /api/v1/incidents` with the `Authorization: Bearer {jwt}` header.
A loading state replaces the submit button while awaiting the server response.
On `201 Created` response: the frontend reads the `incidentId` from the response body and navigates to `/incidents/{incidentId}`.
On the Incident Detail page, the frontend immediately begins polling `GET /api/v1/incidents/{incidentId}/status` every 3 seconds. Each poll response refreshes the Agent Execution Timeline cards and the tab content areas.
Polling stops when the incident status becomes `RESOLVED` or `FAILED`.
---
Output Specification:
The frontend produces no persistent output. It renders data returned by the Spring Boot API. All state is transient (React component state and Next.js page props). The frontend's output is the structured HTTP request body it sends to Spring Boot.
---
Integration Points:
Sends to: Spring Boot Backend via HTTPS REST
Receives from: Spring Boot Backend (REST JSON responses, polling results)
Receives push from: Spring Boot WebSocket at `ws://{host}/ws/incidents/{id}` when analysis completes or fails
Contract: All requests include `Authorization: Bearer {jwt}`. All bodies use `Content-Type: application/json`.
---
Error Handling:
HTTP 400: Display field-level error messages returned in the response body. Each error object has `field` and `message`. Display the message adjacent to the named field.
HTTP 401: Clear the JWT cookie, redirect to `/login` with toast: "Your session has expired."
HTTP 429: Display banner: "Too many requests — please wait a moment before submitting again."
HTTP 500: Display banner: "Something went wrong on our end. Please try again." Never display internal error details.
Network timeout after 15 seconds: Show "Connection lost" banner with a manual Retry button. Do not auto-retry silently.
---
Dependencies & Configuration:
Environment Variable	Description	Example
NEXT_PUBLIC_API_BASE_URL	Base URL of the Spring Boot backend	http://localhost:8080
NEXT_PUBLIC_WS_URL	WebSocket endpoint base URL	ws://localhost:8080/ws
---
---
Component 2: Spring Boot Backend API
Role in the Project: Spring Boot owns all synchronous operations: authentication, incident creation (with atomic writes to three tables), data retrieval, result persistence, and frontend communication. It is the sole writer to PostgreSQL. It publishes lightweight reference messages to RabbitMQ and consumes result messages from RabbitMQ. It never calls FastAPI directly.
---
Input Specification:
Accepts HTTPS requests from the frontend. All request bodies are JSON. JWT authentication is enforced on all endpoints except login and register.
The `IncidentCreateRequest` object matches Frozen Contract 1 exactly. Spring Boot applies Bean Validation on receipt. Any field that violates Contract 1's constraints causes an immediate 400 response with field-level error details.
---
Processing Logic — Incident Creation:
JWT validation via Spring Security filter (signature, expiry, Redis session presence).
Request body deserialization and Bean Validation. On failure: 400 with field-level errors.
A single `@Transactional` service method executes the following three inserts in one atomic transaction:
INSERT into `incidents` with all metadata fields (title, description, environment, severity, status=PENDING, affected_services, created_by, created_at)
INSERT into `incident_metrics` with the 4 metric values and a reference to the new incident ID
INSERT into `incident_logs` with the raw log content and a reference to the new incident ID
If any of the three inserts fails, the entire transaction rolls back. A 500 response is returned. No RabbitMQ message is published.
After the transaction commits successfully, Spring Boot constructs an `IncidentAnalysisRequestMessage` containing only `{message_id, incident_id, published_at}` and publishes it to `incident.analysis.exchange`.
A 201 response is returned to the frontend with the incident ID and status PENDING.
Note on RabbitMQ publish failure: If the transaction commits but the RabbitMQ publish fails, the incident exists in the database with status PENDING but no analysis is triggered. A `@Scheduled` task runs every 2 minutes, queries for incidents in PENDING status older than 3 minutes, and republishes their reference messages. This ensures no incident is permanently stuck.
---
Processing Logic — Result Handling:
When FastAPI completes analysis, it publishes an `IncidentAnalysisResultMessage` to `incident.results.queue`. Spring Boot's `@RabbitListener` on this queue processes it:
Deserialize the result message.
In a single `@Transactional` operation:
UPDATE `incidents` SET status = (RESOLVED or FAILED), resolved_at = NOW()
INSERT 3 rows into `agent_runs` (one per agent)
INSERT 1 row into `incident_analysis` (root cause findings)
INSERT N rows into `recommendations`
Delete the Redis cache key for this incident.
Push a WebSocket notification to all frontend sessions subscribed to this incident ID.
---
Output Specification:
All Spring Boot responses use a uniform JSON envelope:
Field	Type	Present When
success	Boolean	Always
data	Object	On 2xx responses only
error	Object (code + message + optional fields array)	On 4xx/5xx responses only
timestamp	ISO 8601 String	Always
---
Integration Points:
Receives from: Frontend (HTTPS REST)
Writes to: PostgreSQL — incidents, incident_metrics, incident_logs (on creation); agent_runs, incident_analysis, recommendations (on result receipt)
Reads from: PostgreSQL — all tables (for GET endpoints)
Reads/writes: Redis (sessions, result cache, stats cache)
Publishes to: RabbitMQ `incident.analysis.exchange` (reference-only message)
Consumes from: RabbitMQ `incident.results.queue` (result message)
Pushes to: Frontend via WebSocket
---
Error Handling:
RabbitMQ unavailable at publish time: Incident is saved with status PENDING. The scheduled retry job republishes after 2 minutes.
PostgreSQL write fails on incident creation: Full transaction rollback. 500 returned to frontend. No RabbitMQ message published.
PostgreSQL write fails on result handling: Transaction rolls back. The result message is nacked and re-queued. Spring Boot will retry on the next delivery.
All unhandled exceptions: Global `@ControllerAdvice` catches and logs the full stack trace. Returns a sanitized 500 to the client.
---
Dependencies & Configuration:
Variable	Description	Example
SPRING_DATASOURCE_URL	PostgreSQL JDBC URL	jdbc:postgresql://postgres:5432/devops_copilot
SPRING_DATASOURCE_USERNAME	DB write user credentials	appwriter
SPRING_DATASOURCE_PASSWORD	DB write user password	(secret)
SPRING_RABBITMQ_HOST	RabbitMQ hostname	rabbitmq
SPRING_RABBITMQ_PORT	RabbitMQ AMQP port	5672
SPRING_RABBITMQ_USERNAME	RabbitMQ credentials	(configured in RabbitMQ setup)
SPRING_RABBITMQ_PASSWORD	RabbitMQ credentials	(secret)
SPRING_REDIS_HOST	Redis hostname	redis
SPRING_REDIS_PORT	Redis port	6379
JWT_SECRET	HMAC-SHA256 signing key (min 256 bits)	Generate with: openssl rand -hex 32
JWT_EXPIRATION_MS	Token validity in milliseconds	86400000 (24 hours)
FRONTEND_URL	Allowed CORS origin	http://localhost:3000
---
---
Component 3: RabbitMQ Message Broker
Role in the Project: RabbitMQ is the decoupling layer between Spring Boot and FastAPI. It enables asynchronous communication where Spring Boot and FastAPI operate completely independently. The message types are defined in Frozen Contract 3 and carry only references — no large data.
---
Exchange and Queue Architecture:
Exchange 1: `incident.analysis.exchange` (type: direct)
Binding: routing key `incident.analysis` → queue `incident.analysis.queue`
Publisher: Spring Boot
Consumer: FastAPI
Exchange 2: `incident.results.exchange` (type: direct)
Binding: routing key `incident.results` → queue `incident.results.queue`
Publisher: FastAPI
Consumer: Spring Boot
Dead Letter Exchange: `incident.dlq.exchange`
Queue: `incident.dlq`
Messages are routed here after 3 failed delivery attempts from `incident.analysis.queue`. DLQ messages are never auto-deleted and can be inspected via the RabbitMQ management UI and re-queued manually.
---
Message Schemas:
Both message schemas are fully defined in Frozen Contract 3. The `IncidentAnalysisRequestMessage` contains only three fields. The `IncidentAnalysisResultMessage` contains the complete analysis output.
---
Integration Points:
Receives publications from: Spring Boot (via `incident.analysis.exchange`)
Delivers to: FastAPI (from `incident.analysis.queue`)
Receives publications from: FastAPI (via `incident.results.exchange`)
Delivers to: Spring Boot (from `incident.results.queue`)
---
Error Handling:
Consumer errors in FastAPI cause a nack (negative acknowledgment). The message is re-queued up to 3 times with a 5-second delay between attempts.
After 3 failures, the message routes to `incident.dlq` automatically via the Dead Letter Exchange configuration.
A Grafana panel monitors DLQ depth. An alert fires if it exceeds 5 messages.
The message TTL on `incident.analysis.queue` is 1800 seconds (30 minutes). Unconsumed messages after 30 minutes route to the DLQ.
---
Dependencies & Configuration:
RabbitMQ 3.12 with the management plugin enabled.
All queues and exchanges declared with `durable: true`.
Queues and exchanges are declared at startup by both Spring Boot (via Spring AMQP) and FastAPI (via aio-pika). Declaring a durable queue that already exists is idempotent and causes no errors.
---
---
Component 4: FastAPI AI Orchestration Service
Role in the Project: FastAPI is the AI intelligence layer. It consumes incident reference messages from RabbitMQ, fetches the full incident data from PostgreSQL using a read-only connection, initializes the LangGraph state, runs the three-agent pipeline, and publishes the structured analysis results back to RabbitMQ. FastAPI is never exposed to the internet.
---
Input Specification:
FastAPI receives `IncidentAnalysisRequestMessage` objects from RabbitMQ. The message contains only `message_id`, `incident_id`, and `published_at`. After receiving this message, FastAPI performs three database reads:
SELECT all columns FROM `incidents` WHERE `id` = `incident_id`
SELECT all columns FROM `incident_metrics` WHERE `incident_id` = `incident_id`
SELECT `raw_log_content` FROM `incident_logs` WHERE `incident_id` = `incident_id`
If any of these reads returns no result (the incident does not exist in the database), FastAPI nacks the message and routes it to the DLQ. This protects against race conditions where the message was published before the transaction fully committed.
---
Processing Logic:
Asyncio background worker continuously listens to `incident.analysis.queue`.
Message arrives. Deserialized into a Pydantic model. If deserialization fails (malformed JSON), nack immediately and route to DLQ.
Fetch incident data from PostgreSQL using read-only SQLAlchemy connection (three queries).
If any required data is missing, nack and route to DLQ.
Assemble the `IncidentAnalysisState` from all fetched data. All agent statuses set to PENDING. Pipeline errors set to empty list.
LangGraph pipeline is compiled and invoked:
Log Analysis Agent executes.
Root Cause Agent executes (reads from state including log_analysis output).
Recommendation Agent executes (reads from state including root_cause output).
After all nodes complete, FastAPI constructs the `IncidentAnalysisResultMessage` from the final state.
Result message published to `incident.results.exchange`.
Original RabbitMQ message is acknowledged (acked) only after successful result publish. This guarantees at-least-once delivery.
---
Output Specification:
FastAPI produces `IncidentAnalysisResultMessage` objects (schema defined in Frozen Contract 3) published to `incident.results.queue`.
FastAPI also exposes two HTTP endpoints for operational monitoring:
`GET /health` — Returns service health status including LLM connectivity, RabbitMQ connectivity, and PostgreSQL read connectivity. Used by Docker health checks.
`GET /metrics` — Prometheus-formatted metrics text. Exposes pipeline duration, per-agent execution times, agent failure counts, and active pipeline count.
---
Integration Points:
Receives from: RabbitMQ `incident.analysis.queue` (AMQP consumer)
Reads from: PostgreSQL — incidents, incident_metrics, incident_logs tables (read-only connection, dedicated read-only user)
Calls: gemini API (HTTP POST to `/api/chat`)
Publishes to: RabbitMQ `incident.results.exchange` (AMQP publisher)
Exposes to: Prometheus (GET `/metrics`)
FastAPI does NOT write to PostgreSQL. FastAPI does NOT call Spring Boot directly. FastAPI does NOT interact with Redis.
---
Error Handling:
Database query returns no result: Nack message, route to DLQ, log structured error.
Rate limit error , might change to or got lower model option(in student pro tier)
Result message still published so Spring Boot can update incident status.
Individual agent failure (1 or 2 agents fail): Pipeline continues. Result published with `analysis_status` PARTIAL. Completed agents' outputs are still valuable and displayed in the frontend.
RabbitMQ result publish failure: Retry 5 times. If all fail, append result to a local `failed_results.jsonl` file for manual recovery. Log a critical error.
---
Dependencies & Configuration:
Variable	Description	Example
RABBITMQ_URL	Full AMQP connection string	amqp://guest:guest@rabbitmq:5672/
POSTGRES_READ_URL	PostgreSQL connection string (read-only user)	postgresql://reader:pass@postgres:5432/devops_copilot
GEMINI_API_KEY	Optional — only used if LLM_PROVIDER is gemini	go for higher models and then lower models

MAX_AGENT_RETRIES	Per-agent retry attempts before marking FAILED	3
AGENT_RETRY_BASE_DELAY	Base delay in seconds for exponential backoff	1
PostgreSQL Read-Only User Setup (must be done before FastAPI starts):
A separate PostgreSQL user with read-only permissions must be created and granted SELECT on the three tables FastAPI reads. This is a one-time setup step performed during database initialization. The read-only user credentials are stored in `POSTGRES_READ_URL`. This user has no INSERT, UPDATE, or DELETE permissions — enforced at the database level.
---
---
Component 5: LangGraph Agent Pipeline (3 Agents)
Role in the Project: LangGraph manages the sequential, stateful execution of the three AI agents. The shared `IncidentAnalysisState` (defined in Frozen Contract 4) accumulates findings as each agent runs. The pipeline is strictly linear in V1: Log Analysis always runs first, Root Cause second, Recommendation third.
---
Sub-Component 5a: Log Analysis Agent
Role: The first agent in the pipeline. Reads the `raw_logs` field from state and identifies all meaningful signals — errors, exceptions, failure patterns — through LLM analysis. Provides the factual log-based evidence that the Root Cause Agent reasons from.
What it reads from state: `raw_logs`, `severity`, `affected_services`
LLM Prompt Construction:
The agent sends the raw log content (truncated to 3000 characters if it exceeds this, with a note that it was truncated) to LLM with:
A system message establishing the agent's role as a log analysis expert focused on identifying failures.
A user message containing the log text and explicit instructions to identify: each distinct error message, exception class names with their messages, repeating error patterns, and any apparent service call failures.
An explicit instruction to respond only in the JSON structure matching the log_analysis output schema (Contract 5). No prose before or after the JSON.
The `format: "json"` flag set in the LLM/gemini request to enforce JSON-only output.
Output written to state (`log_analysis`): Defined in Frozen Contract 5.
Status update: Sets `agent_statuses["LOG_ANALYSIS"]` to COMPLETED or FAILED.
Error handling: If all retries are exhausted, `log_analysis` is set to None. `agent_statuses["LOG_ANALYSIS"]` is set to FAILED. Error message appended to `pipeline_errors`. Root Cause Agent proceeds with None for `log_analysis` and notes the unavailability in its analysis.
---
Sub-Component 5b: Root Cause Agent
Role: The most analytically important agent. Synthesizes the log findings from the Log Analysis Agent, the metrics values from state, and the incident description and affected services from state to determine the most probable root cause and causal chain. This agent reasons across multiple data sources.
What it reads from state: `log_analysis` (may be None if Log Analysis failed), `metrics`, `description`, `severity`, `affected_services`, `environment`
LLM Prompt Construction:
The agent builds a prompt that provides:
The log analysis findings summary (or explicitly notes that log analysis was unavailable, with a confidence penalty).
The four metric values with labels and context (e.g., "CPU at 94% is critically high").
The user's written description of the incident.
The severity level and affected service list.
Instructions to identify the single most probable root cause, describe the causal chain as ordered steps, assign a confidence score (lower if data was incomplete), and categorize the failure type.
The JSON output format matching Contract 5.
Output written to state (`root_cause`): Defined in Frozen Contract 5.
Status update: Sets `agent_statuses["ROOT_CAUSE"]` to COMPLETED or FAILED.
Error handling: If failed, `root_cause` is None. Recommendation Agent proceeds but produces generic recommendations without root cause context. This is considered a PARTIAL result.
---
Sub-Component 5c: Recommendation Agent
Role: The final agent. Reads the root cause assessment and generates 3–5 concrete, prioritized remediation actions. This agent translates analytical findings into engineer-actionable steps.
What it reads from state: `root_cause` (may be None if Root Cause Agent failed), `severity`, `environment`, `affected_services`
LLM Prompt Construction:
The agent provides:
The root cause `primary_cause` and `causal_chain` (or notes that root cause was unavailable, asking for general recommendations based on severity and affected services instead).
The severity level to calibrate urgency.
Instructions to generate exactly 3–5 specific, actionable recommendations — not vague advice. Each recommendation must include the action, its rationale tied to the root cause, a priority level, and the team responsible.
The JSON array output format matching Contract 5.
Output written to state (`recommendations`): Defined in Frozen Contract 5. Always a list (empty list if agent failed, not None).
Status update: Sets `agent_statuses["RECOMMENDATION"]` to COMPLETED or FAILED.
Error handling: If failed, `recommendations` remains an empty list. Result is still published with whatever was produced by the first two agents.
---
---
Component 6: Gemini LLM Service
Role in the Project

Gemini provides the reasoning engine used by the three AI agents.

The Log Analysis Agent, Root Cause Agent, and Recommendation Agent all send structured prompts to Gemini and receive structured JSON responses.

Using Gemini significantly reduces local hardware requirements because model inference runs in Google's infrastructure rather than on the developer's machine.

Benefits:

No local model setup
No model downloads
Faster development
Better reasoning quality
Better structured JSON generation
Lower memory consumption on developer laptops
Input Specification

Each agent sends a request to Gemini containing:

Model

A Gemini model configured through environment variables.

Recommended:

Gemini 2.5 Flash

during development.

Can later switch to:

Gemini 2.5 Pro

for higher-quality reasoning.

Prompt Structure

Each request contains:

System instructions
Agent-specific instructions
Incident context
Structured output requirements

All agents request JSON-only responses.

The prompts explicitly define:

Expected fields
Allowed values
Required structure

to improve consistency.

Processing Logic

Gemini receives:

Incident data
Log information
Metrics
Outputs from previous agents

and generates structured reasoning outputs.

The response is validated against the agent's output schema before being written into the LangGraph state.

If validation fails:

Retry
Re-prompt with stricter instructions
Mark agent as failed if retries are exhausted
Output Specification

Each agent receives a JSON response matching its predefined schema.

The response is validated before use.

Validation failures never crash the pipeline.

Instead:

Error is logged
Agent marked as FAILED
Pipeline continues

This allows partial results even when one agent encounters issues.

Gemini Recommendations
Development

Use:

Gemini 2.5 Flash

Reason:

Fast responses
Lower usage costs
Sufficient quality for testing
Demo / Final Presentation

Use:

Gemini 2.5 Pro

Reason:

Better root cause reasoning
Better recommendations
Better handling of large logs
Integration Points

Receives from:

FastAPI

Returns to:

FastAPI

No direct interaction with:

PostgreSQL
RabbitMQ
Spring Boot
Redis

Gemini remains isolated behind the FastAPI service.

Error Handling
Rate Limits

If Gemini rate limits requests:

Retry with exponential backoff
Queue remains intact
Incident status remains ANALYZING
API Failure

If Gemini is unavailable:

Agent retries
Agent marked FAILED after retry exhaustion
Pipeline continues where possible
Invalid JSON

If Gemini returns malformed JSON:

Validate response
Retry with stricter JSON instructions
Mark FAILED after maximum retry attempts
Dependencies & Configuration

Required:

GEMINI_API_KEY

Optional:

GEMINI_MODEL

Recommended default:

gemini-2.5-flash

Development machines do not require:

LLM installation
Model downloads
Additional RAM
Local inference setup

Only an internet connection and valid API key are required.---
Component 7: PostgreSQL Database
Role in the Project: PostgreSQL is the single source of truth for all persistent data. Seven normalized tables organized by responsibility. Spring Boot is the primary reader and the sole writer. FastAPI has read-only access to three specific tables. No other service interacts with PostgreSQL.
The full table schemas, constraints, relationships, and indexes are defined in Frozen Contract 2. This section documents the query patterns each service uses.
---
Query Patterns — Spring Boot:
Incident creation (one transaction, three inserts):
INSERT into incidents with all core metadata fields
INSERT into incident_metrics with the four metric values
INSERT into incident_logs with the raw log content
Incident list (dashboard table):
SELECT from incidents with filters on status, severity, and ordering by created_at DESC
Paginated: 20 incidents per page by default
Incident detail (single incident full view):
SELECT from incidents WHERE id = ?
SELECT from incident_metrics WHERE incident_id = ?
SELECT from incident_logs WHERE incident_id = ?
SELECT from agent_runs WHERE incident_id = ? ORDER BY started_at ASC
SELECT from incident_analysis WHERE incident_id = ?
SELECT from recommendations WHERE incident_id = ? ORDER BY recommendation_order ASC
These are executed as separate queries (not a single massive join) to keep each query simple and cache-friendly
Status polling (frequent endpoint — every 3 seconds from frontend):
SELECT status from incidents WHERE id = ?
SELECT agent_name, status, started_at, finished_at, output_summary from agent_runs WHERE incident_id = ?
This query must be lightweight — only two small tables with indexed lookups
Result persistence (one transaction after FastAPI publishes result):
UPDATE incidents SET status, resolved_at WHERE id = ?
INSERT into agent_runs (3 rows)
INSERT into incident_analysis (1 row)
INSERT into recommendations (N rows)
---
Query Patterns — FastAPI (read-only):
SELECT all columns FROM incidents WHERE id = ?
SELECT all columns FROM incident_metrics WHERE incident_id = ?
SELECT raw_log_content FROM incident_logs WHERE incident_id = ?
These three queries run sequentially after FastAPI receives a reference message. They access only the three tables FastAPI is granted SELECT permission on.
---
Integration Points:
Read and written by: Spring Boot (using Spring Data JPA with Hibernate)
Read only by: FastAPI (using SQLAlchemy with asyncpg driver)
---
Dependencies & Configuration:
PostgreSQL 16.
Two database users must be configured:
`appwriter` (or similar): Used by Spring Boot. Full CRUD access to all tables.
`appreader` (or similar): Used by FastAPI. SELECT-only access on `incidents`, `incident_metrics`, and `incident_logs`. No access to any other table.
Flyway (integrated with Spring Boot) manages all schema migrations. On first Spring Boot startup, Flyway creates all 7 tables automatically.
All migrations are stored as versioned SQL files in `backend/src/main/resources/db/migration/`.
---
---
Component 8: Redis Cache
Role in the Project: Redis serves three caching concerns: JWT session management, incident analysis result caching, and dashboard statistics caching.
---
Cache 1 — JWT Session Store
Enables true logout by storing issued tokens in Redis. On logout, the Redis key is deleted and the token is immediately invalid even before its natural expiry.
Key Pattern	Value	TTL
`session:{userId}:{sha256(token)}`	`{userId}:{role}:{issuedAt}`	Matches JWT expiry (86400 seconds)
Invalidation triggers: User logout; admin sets `is_active = false` for a user.
---
Cache 2 — Incident Analysis Result
After Spring Boot persists analysis results to PostgreSQL, it serializes the full `IncidentDetailResponse` to JSON and stores it in Redis. Subsequent GET requests for the same incident within 10 minutes are served from Redis without database queries. This is particularly useful since the Incident Detail page may be refreshed many times by users watching the analysis complete.
Key Pattern	Value	TTL
`incident:result:{incidentId}`	JSON string of IncidentDetailResponse	600 seconds (10 minutes)
Invalidation triggers: Any incident status update causes immediate key deletion. The next GET request rebuilds from a fresh database query and repopulates the cache.
---
Cache 3 — Dashboard Statistics
Dashboard aggregate statistics (total counts, average resolution time, incidents by severity) require aggregate SQL queries. Cached per-user for 2 minutes.
Key Pattern	Value	TTL
`dashboard:stats:{userId}`	JSON string of DashboardStats	120 seconds (2 minutes)
Invalidation triggers: Time-based expiry only. 2-minute TTL keeps statistics near-real-time.
---
Integration Points:
Read and written by: Spring Boot only. FastAPI has no Redis access.
---
---
Component 9: Prometheus + Grafana
Role in the Project: Prometheus scrapes metrics from Spring Boot and FastAPI on a scheduled interval. Grafana reads from Prometheus and renders operational dashboards. Together they demonstrate production-level observability awareness — a significant differentiator for a student portfolio.
---
Prometheus Scrape Targets:
Service	Endpoint	Scrape Interval
Spring Boot (via Micrometer)	`http://spring-boot:8080/actuator/prometheus`	15 seconds
FastAPI (custom)	`http://fastapi:8000/metrics`	15 seconds
RabbitMQ (via management plugin)	`http://rabbitmq:15692/metrics`	30 seconds
---
Key Metrics:
Spring Boot (automatic via Micrometer):
`http_server_requests_seconds` — HTTP request duration histogram by endpoint and status
`hikaricp_connections_active` — Active DB connections
`hikaricp_connections_pending` — Threads waiting for a DB connection (key overload indicator)
Custom Spring Boot business metrics:
`incidents_submitted_total` — Counter of total incidents created
`incidents_resolved_total` — Counter of total incidents resolved
`rabbitmq_publish_failures_total` — Counter of failed RabbitMQ publish attempts
FastAPI custom metrics:
`analysis_pipeline_duration_seconds` — Histogram of full pipeline time, labeled by analysis_status
`agent_execution_duration_seconds` — Histogram of per-agent time, labeled by agent_name
`agent_failures_total` — Counter of agent failures, labeled by agent_name
`active_analyses` — Gauge of currently running pipelines
`llm_call_duration_seconds` — Histogram of GEMINI LLM MODEL inference time per call
---
Grafana Dashboards (3 pre-built):
Dashboard 1 — Incident Overview: Total incidents over time, active incidents by severity, average analysis duration trend, resolution rate.
Dashboard 2 — Agent Performance: Per-agent execution time bar chart, per-agent failure rate, LLM inference time trend, pipeline COMPLETED vs PARTIAL vs FAILED ratio.
Dashboard 3 — System Health: HTTP request rate and error rate, database connection pool gauge, RabbitMQ queue depths (analysis queue and DLQ), Redis hit/miss ratio.
---
Alert Rules:
Alert	Condition	Severity
HighAgentFailureRate	agent_failures_total rate > 5 per minute	Critical
DLQBacklogGrowing	DLQ message count > 5	Warning
DatabasePoolSaturated	hikaricp_connections_pending > 5 for 2 minutes	Critical
SlowAPIResponse	99th percentile response time > 3 seconds	Warning
---
---
D. Data Flow & Pipeline
End-to-End Lifecycle of a Single Incident
---
Phase 1 — Incident Submission (Synchronous, approximately 200ms)
User submits the 10-field form. Client-side validation passes all fields.
Frontend sends `POST /api/v1/incidents` with the IncidentCreateRequest body and JWT header.
Spring Boot validates JWT. If invalid: 401 returned, no further processing.
Spring Boot validates request body. If invalid: 400 returned with field errors.
Spring Boot executes a single database transaction:
INSERT into `incidents` → generates UUID (incidentId)
INSERT into `incident_metrics` with incidentId reference
INSERT into `incident_logs` with incidentId reference
Transaction commits. Spring Boot publishes `{message_id, incident_id, published_at}` to `incident.analysis.exchange`.
Spring Boot returns 201 to frontend with `{id: incidentId, status: "PENDING"}`.
Frontend navigates to `/incidents/{incidentId}` and begins polling status every 3 seconds.
---
Phase 2 — Data Fetch and Pipeline Initialization (Asynchronous, approximately 1 second)
FastAPI's AMQP consumer receives the message from `incident.analysis.queue`.
Message deserialized: extracts `incident_id`.
FastAPI executes three read queries against PostgreSQL using its read-only connection:
Read: incident core data from `incidents` table
Read: metric values from `incident_metrics` table
Read: log content from `incident_logs` table
All data assembled into `IncidentAnalysisState` (Contract 4). Agent statuses all set to PENDING.
---
Phase 3 — AI Analysis (Asynchronous, approximately 60–120 seconds)
The total analysis time equals the sum of all three agent LLM call durations.
Agent	Input Sources	LLM Call	Approx. Time	State Written
Log Analysis	raw_logs, severity, affected_services	One call to Gemini api	10–30 seconds	log_analysis
Root Cause	log_analysis, metrics, description, affected_services, severity	One call to Gemini api	15–35 seconds	root_cause
Recommendation	root_cause, severity, environment, affected_services	One call to gemini api	10–25 seconds	recommendations
Log Analysis Agent executes. LLM called. `log_analysis` written to state.
Root Cause Agent executes. Reads `log_analysis` from state. LLM called. `root_cause` written to state.
Recommendation Agent executes. Reads `root_cause` from state. LLM called. `recommendations` written to state.
FastAPI constructs `IncidentAnalysisResultMessage` from final state.
FastAPI publishes result to `incident.results.exchange`.
FastAPI acks the original message from `incident.analysis.queue`.
---
Phase 4 — Result Persistence (Synchronous, approximately 500ms)
Spring Boot's `@RabbitListener` receives the result from `incident.results.queue`.
Single database transaction:
UPDATE `incidents` SET status=RESOLVED, resolved_at=NOW()
INSERT 3 rows into `agent_runs`
INSERT 1 row into `incident_analysis`
INSERT N rows into `recommendations`
Delete Redis cache key `incident:result:{incidentId}`.
Push WebSocket message `{type: "INCIDENT_RESOLVED", incidentId}` to frontend sessions.
Spring Boot acks the result message.
---
Phase 5 — Frontend Update
Frontend receives WebSocket push (or next poll detects RESOLVED status).
Frontend sends `GET /api/v1/incidents/{incidentId}`.
Spring Boot queries PostgreSQL (and caches result in Redis).
Frontend renders complete analysis: 3-card agent timeline (all green), 3-tab result section fully populated.
---
Async Event Flow Summary:
```
Frontend
  → POST /api/v1/incidents
    → Spring Boot: validate + 3-table atomic insert
    → RabbitMQ PUBLISH {incident_id}
    → 201 → Frontend (navigates to detail page, starts polling)

RabbitMQ DELIVER {incident_id} to FastAPI
  → FastAPI: 3 PostgreSQL reads
  → FastAPI: run LangGraph (3 agents, ~60-120 seconds)
  → RabbitMQ PUBLISH {result}
  → FastAPI: ACK original message

RabbitMQ DELIVER {result} to Spring Boot
  → Spring Boot: 4-table atomic write
  → Spring Boot: Redis cache invalidation
  → Spring Boot: WebSocket push to frontend
  → Spring Boot: ACK result message

Frontend: WebSocket push received
  → GET /api/v1/incidents/{id} (served from Redis cache)
  → Renders complete analysis UI
```
---
---
E. System Design
Caching Layer
Cache	Data	Key	TTL	Invalidation
Redis — Sessions	JWT validity and user role	`session:{userId}:{tokenHash}`	86400 seconds	Logout or user deactivation
Redis — Incident Results	Full IncidentDetailResponse JSON	`incident:result:{incidentId}`	600 seconds	Any status change on the incident
Redis — Dashboard Stats	Aggregate count and timing data	`dashboard:stats:{userId}`	120 seconds	Time-based expiry only
---
API Contracts (Frontend ↔ Spring Boot)
All endpoints require `Authorization: Bearer {jwt}` unless stated otherwise.
All request and response bodies are `Content-Type: application/json`.
---
POST /api/v1/auth/register — No auth required
Request fields: `username` (string), `email` (string, valid email format), `password` (string, min 8 characters, must contain at least one uppercase letter and one digit), `role` (string: DEVELOPER or ADMIN).
Success (201): `data` contains `{id, username, email, role, createdAt}`.
Error (400): `error.code` = VALIDATION_ERROR, `error.fields` = array of `{field, message}`.
---
POST /api/v1/auth/login — No auth required
Request fields: `email` (string), `password` (string).
Success (200): `data` contains `{token, tokenType: "Bearer", expiresIn: 86400, user: {id, username, email, role}}`.
Error (401): `error.code` = INVALID_CREDENTIALS.
Error (423): `error.code` = ACCOUNT_DEACTIVATED (when admin has deactivated the account).
---
POST /api/v1/auth/logout — Auth required
Request: Empty body.
Success (200): `data.message` = "Logged out successfully".
---
POST /api/v1/incidents — Auth required
Request: IncidentCreateRequest — matches Frozen Contract 1 exactly.
Success (201): `data` contains `{id (UUID), title, status: "PENDING", createdAt}`.
Error (400): `error.code` = VALIDATION_ERROR, `error.fields` = field-level errors.
Error (500): `error.code` = INTERNAL_ERROR, `error.message` = safe generic message.
---
GET /api/v1/incidents — Auth required
Query params: `page` (integer, default 0), `size` (integer, default 20, max 100), `status` (optional filter), `severity` (optional filter).
Success (200): `data` contains `{content: [IncidentSummary], totalElements, totalPages, currentPage}`.
Each `IncidentSummary`: `id, title, severity, status, environment, affectedServices, createdAt, resolvedAt`.
---
GET /api/v1/incidents/{id} — Auth required
Success (200): `data` contains the full IncidentDetailResponse with all nested objects.
The `IncidentDetailResponse` structure:
Field	Type	Description
id	UUID String	Incident ID
title	String	Incident title
description	String	User description
environment	String	Environment value
severity	String	P1–P4
status	String	Current status
affectedServices	Array of Strings	Service list
metrics	MetricsObject	CPU, memory, error rate, response time
rawLogs	String	The submitted log content
agentRuns	Array of AgentRunSummary	3 items — one per agent
analysis	RootCauseObject or null	Root cause findings
recommendations	Array of RecommendationObject	Ordered recommendation list
createdAt	ISO 8601 String	
resolvedAt	ISO 8601 String or null	
Error (404): `error.code` = INCIDENT_NOT_FOUND.
---
GET /api/v1/incidents/{id}/status — Auth required (polling endpoint)
This endpoint is called every 3 seconds by the frontend. It must be lightweight.
Success (200): `data` contains `{status, agentRuns: [{agentName, status, startedAt, finishedAt, outputSummary}]}`.
Returns only status and agent run summaries — not the full analysis data. Two small indexed table lookups only.
---
GET /api/v1/dashboard/stats — Auth required
Success (200): `data` contains `{totalIncidents, activeIncidents, resolvedToday, failedToday, avgResolutionMinutes, p1Count, p2Count}`.
Served from Redis cache (120-second TTL). Cache miss triggers an aggregation query.
---
WebSocket /ws/incidents/{id} — Auth via query param `?token={jwt}`
Server-to-client message types:
Type	Fields	Trigger
INCIDENT_RESOLVED	incidentId, analysisStatus, timestamp	Analysis pipeline completed (any status)
AGENT_UPDATE	agentName, status, timestamp	Optional — if Spring Boot pushes intermediate updates
Note: In V1, only the `INCIDENT_RESOLVED` push is mandatory. `AGENT_UPDATE` pushes (for showing each agent completing in real time) can be implemented if the team has time; otherwise, the polling approach on the status endpoint adequately covers the agent timeline updates.
---
Authentication & Security
JWT Strategy: HMAC-SHA256 signed tokens. Claims: `sub` (userId), `role`, `iat`, `exp`. Stored in HTTP-only, Secure, SameSite=Strict cookie. Not accessible via JavaScript — prevents XSS-based token theft.
Password Hashing: BCrypt with cost factor 12. Plaintext passwords never stored, logged, or returned in responses.
CORS: Spring Boot allows requests only from the configured `FRONTEND_URL`. All other origins are rejected before reaching any endpoint handler.
Rate Limiting (using Bucket4j):
Login endpoint: 10 attempts per IP per minute. Excess returns 429.
Incident submission: 30 submissions per user per hour.
Database User Separation: Spring Boot uses a read-write user. FastAPI uses a separate read-only user with SELECT-only grants on three specific tables. Neither user has DBA or superuser privileges.
Internal Service Isolation: FastAPI is not port-published outside the Docker network. LLM(GEMINI API) is not port-published outside the Docker network. These services are inaccessible from outside the running Docker environment.
---
---
F. Deployment & Infrastructure
Environment Configuration
Development Environment:
All services run via Docker Compose except LLM (runs natively on the host for direct hardware access). Next.js runs in development mode (hot reload). Spring Boot runs with DevTools hot reload. FastAPI runs with Uvicorn `--reload`.
Development-specific settings:
All service ports published to host for debugging (PostgreSQL 5432, Redis 6379, RabbitMQ 5672 and 15672, Spring Boot 8080, FastAPI 8000, Grafana 3001).
CORS allows all localhost origins.
JWT expiry extended to 7 days.
SQL query logging enabled in Spring Boot.
Log level DEBUG for Spring Boot and FastAPI.
Staging Environment (AWS Free Tier):
Frontend: Vercel free tier (automatic deployments from GitHub main branch).
Spring Boot + FastAPI: Docker containers on AWS EC2 t3.micro.
PostgreSQL: AWS RDS db.t3.micro (free tier, 20 GB SSD).
Redis + RabbitMQ: Self-hosted containers on the same EC2 instance.
LLM: Runs natively on the EC2 instance with the smallest quantized model. Note: t3.micro has 1 GB RAM — a t3.medium (2 GB) is recommended for staging if the free tier allows it, otherwise LLM will fail to load the model.
Prometheus + Grafana: Containers on the same EC2 instance.
Production Architecture (Interview Talking Points — Not Built for V1):
When asked about scaling in interviews, describe:
Frontend on Vercel with global CDN edge caching.
Spring Boot on AWS ECS Fargate (auto-scaled based on CPU > 70%).
FastAPI on AWS ECS Fargate (auto-scaled based on RabbitMQ analysis queue depth > 10).
PostgreSQL on AWS RDS Multi-AZ with automated backups.
Redis on AWS ElastiCache.
RabbitMQ on AWS Amazon MQ managed service.
LLM on AWS EC2 G4dn.xlarge (NVIDIA T4 GPU) or replaced with AWS Bedrock for fully managed inference.
---
Docker Compose Services
Service	Base Image	Published Ports (Dev)	Depends On	Health Check
postgres	postgres:16-alpine	5432	None	pg_isready
redis	redis:7-alpine	6379	None	redis-cli ping
rabbitmq	rabbitmq:3-management-alpine	5672, 15672	None	rabbitmq-diagnostics check_running
spring-boot	Custom Dockerfile	8080	postgres (healthy), redis (healthy), rabbitmq (healthy)	/actuator/health
fastapi	Custom Dockerfile	8000	rabbitmq (healthy), postgres (healthy)	/health
frontend	Custom Dockerfile	3000	spring-boot (healthy)	HTTP 200 on /
prometheus	prom/prometheus	9090	spring-boot, fastapi	/-/healthy
grafana	grafana/grafana	3001	prometheus	/api/health
All services share the Docker bridge network `devops-copilot-net`. Services address each other by service name (e.g., Spring Boot connects to `postgres:5432`, not `localhost:5432`). LLM runs outside Docker and is addressed by FastAPI via `host.docker.internal:11434`.
---
CI/CD Pipeline (GitHub Actions)
Workflow 1 — Build and Test: Triggered on every push to any branch.
Check out repository.
Java 21 + Maven: Build Spring Boot, run unit tests, run integration tests (Testcontainers spins up real PostgreSQL and RabbitMQ).
Node.js 20: TypeScript type checking (`tsc --noEmit`), ESLint.
Python 3.11: Install FastAPI dependencies, run pytest (LLM calls mocked — no real LLM in CI).
Failure in any step blocks the push and notifies the developer.
Workflow 2 — Docker Build: Triggered on push to `main`, after Workflow 1 passes.
Authenticate to Docker Hub using GitHub Secrets.
Build and push Spring Boot, FastAPI, and Next.js images tagged with `latest` and the commit SHA.
Workflow 3 — Deploy: Triggered after Workflow 2 succeeds on `main`.
SSH into EC2 staging instance.
`docker compose pull` to fetch new images.
`docker compose up -d` to restart updated containers.
Smoke test: check Spring Boot `/actuator/health` and FastAPI `/health` return 200.
On failure: restore previous image tags. On success: notify team Slack channel.
---
Scaling Strategy
Horizontal scaling for FastAPI: Each FastAPI instance takes one incident from the RabbitMQ queue at a time (default prefetch of 1). Running two FastAPI instances doubles throughput. RabbitMQ distributes messages round-robin. No code changes are required to add instances.
Queue-based backpressure: If all FastAPI instances are busy, new incidents queue in RabbitMQ without being dropped. Frontend shows PENDING status until a consumer is available. This is automatic — RabbitMQ handles it without any code.
Database read scaling: As the incidents table grows large, add a read replica and route GET-only queries to it. Spring Boot's JPA data source supports this via routing configuration without changing query logic.
---
Monitoring & Alerting
Prometheus retains 15 days of metric data by default. Alertmanager is configured with a Slack webhook. Alert rules are defined in `/infrastructure/prometheus/alert.rules.yml` and match the rules documented in Component 9.
Grafana credentials default to `admin/admin` — change these immediately after first access. The three dashboard JSON files are imported from `/infrastructure/grafana/dashboards/`.
---
---
G. Setup & Running Instructions
Prerequisites
Tool	Minimum Version	Source
Java (Amazon Corretto recommended)	21	corretto.aws
Maven	3.9	maven.apache.org
Node.js (LTS)	20	nodejs.org
Python	3.11	python.org
Docker Desktop	Latest	docker.com
Git	Any recent	git-scm.com

---
Repository Structure
```
/
├── frontend/                  Next.js application
│   └── .env.local.example
├── backend/                   Spring Boot application (Maven)
│   ├── .env.example
│   └── src/main/resources/
│       └── db/migration/      Flyway SQL migration files
├── ai-service/                FastAPI application (Python)
│   ├── .env.example
│   └── requirements.txt
├── infrastructure/
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   ├── prometheus/
│   │   ├── prometheus.yml
│   │   └── alert.rules.yml
│   └── grafana/
│       └── dashboards/        Pre-built dashboard JSON files
└── docs/
    └── AI_IncidentResponse_TechnicalDocumentation_V2.md
```
---
Step 1 — Environment Variables
Copy `.env.example` to `.env` in each of the three service directories (`frontend`, `backend`, `ai-service`). Fill in all values. Required variables are listed in each component's configuration table above.
Critical setup items:
`JWT_SECRET`: Generate with `openssl rand -hex 32`. Minimum 32 characters.
`POSTGRES_READ_URL`: Must use the read-only PostgreSQL user credentials — not the same as Spring Boot's write credentials.
Never commit `.env` files. Verify `.gitignore` lists them before the first commit.
---
Step 2 — Database User Setup
Before starting any service, create two PostgreSQL users:
`appwriter` (or your chosen name): Full CRUD on all tables. Used by Spring Boot.
`appreader` (or your chosen name): SELECT-only on `incidents`, `incident_metrics`, `incident_logs`. Used by FastAPI. This user must not have permissions on `users`, `agent_runs`, `incident_analysis`, or `recommendations`.
This setup is done once via a database initialization SQL script run when the PostgreSQL container first starts. Store this script in `/infrastructure/db/init.sql` and configure Docker Compose to mount it as a PostgreSQL initialization file.
---
---
Step 4 — Start Infrastructure Services
From `/infrastructure`, start only PostgreSQL, Redis, and RabbitMQ first. Wait until all three report healthy status. Verify RabbitMQ management UI at `http://localhost:15672` shows the broker online.
---
Step 5 — Database Migration
Start Spring Boot. Flyway automatically applies all migration scripts from `/backend/src/main/resources/db/migration/` in version order, creating all 7 tables. Verify the startup log shows "Flyway: Successfully applied N migrations."
---
Step 6 — Start Application Services (in order)
LLM — must already be running
Spring Boot — wait for "Started Application in X.XXX seconds"
FastAPI — wait for "Application startup complete"
Next.js frontend — wait for "Ready - started server on 0.0.0.0:3000"
---
Step 7 — Start Monitoring
Start Prometheus and Grafana. Access Grafana at `http://localhost:3001`. Change the default credentials immediately. Import dashboard JSON files from `/infrastructure/grafana/dashboards/`.
---
Testing Strategy
Unit Tests: Test individual functions and classes in isolation with mocked dependencies. Run before every commit. Spring Boot uses `@MockBean`. FastAPI uses `unittest.mock.patch` for LLM calls and RabbitMQ consumers.
Integration Tests: Run in CI automatically. Spring Boot integration tests use Testcontainers (real PostgreSQL and RabbitMQ containers, destroyed after tests). FastAPI integration tests use a mock llm reuest HTTP server to return pre-written JSON responses.
Manual End-to-End Test (run after all services are healthy):
Register a user account.
Submit an incident with realistic log content (include exception stack traces and repeated errors) and degraded metrics (CPU > 90%, error rate > 30%, response time > 5000ms).
Navigate to the Incident Detail page. Watch all 3 agent cards complete in sequence.
Verify Root Cause tab shows primary cause, causal chain, and confidence score.
Verify Recommendations tab shows 3–5 items with priorities.
Verify Raw Data tab shows the submitted log and metric values.
Check Grafana Agent Performance dashboard to confirm per-agent metrics were recorded.
Check RabbitMQ management UI to confirm all queues are empty and DLQ has 0 messages.
---
---
Document Version: 2.0
Architecture Level: Production-Grade Student Portfolio Reference — V1 Scope
All schemas and contracts in Section B are frozen and must not be modified after development begins.
External integrations (Jira, Slack, CloudWatch, Datadog, Prometheus alert ingestion, Ticket Generation) are deferred to Version 2 of the platform.
Last Updated: June 2026