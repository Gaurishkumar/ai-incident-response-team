# Multi-Tenant Org Approval Plan

This is the repo-specific implementation plan for the org approval flow.

Current stack:
- Backend: Spring Boot 3.3, Java 21, JPA, Flyway, PostgreSQL, JWT, Redis, RabbitMQ, WebSocket
- Frontend: Next.js 14 app router under `frontend/src/app`
- AI service: FastAPI-style Python package under `ai-service/app`

Goal:
- `SUPER_ADMIN` can view and approve/reject org requests globally.
- `ORG_ADMIN` can approve/reject new joinees in their approved org only.
- No OTP validation step.
- Email domain becomes a `domain_key` used for grouping requests, not for trust.
- Multiple pending org requests can exist for the same `domain_key`.
- Only one approved org may exist per `domain_key`.
- When one org request is approved, the rest for that `domain_key` are automatically rejected.
- The first requester becomes the org admin only after the org is approved.
- Org admins have no access until approval.

## Core Rules

1. Normalize every email domain to a lowercased `domain_key`.
2. Treat public domains like `gmail.com` or `google.com` the same as any other `domain_key`.
3. Never use `domain_key` as proof of ownership.
4. The approval step is what turns a request into a real org.
5. All org-owned data must be filtered by `organization_id`.
6. No org-scoped access is allowed before approval.
7. Existing auth flow stays cookie-based JWT with `ApiResponse` and `AuthResponse`.
8. Keep the current codebase style: controllers/services/repositories/DTOs, not a new framework layer.

## Phase 1: Data Model And Migrations

### 1.1 New tables

Create Flyway migrations under:
- `backend/src/main/resources/db/migration/V3__multi_tenant_orgs.sql`
- `backend/src/main/resources/db/migration/V4__backfill_legacy_tenant.sql`

Add these tables:

#### `organizations`
- `id` UUID primary key
- `domain_key` varchar, normalized email domain
- `name` varchar, org display name
- `owner_user_id` UUID, FK to the first approved admin
- `status` enum-like varchar: `APPROVED`, `SUSPENDED`
- `approved_by_user_id` UUID, nullable
- `approved_at` timestamp, nullable
- `suspended_at` timestamp, nullable
- `suspension_reason` text, nullable
- `created_at`, `updated_at`

Important:
- `organizations` stores active approved orgs.
- Enforce only one org per `domain_key` using a unique constraint.
- Pending duplicates for the same `domain_key` live in `organization_requests`.

#### `organization_requests`
- This is the approval queue for creating a new org.
- `id` UUID primary key
- `domain_key` varchar
- `org_name` varchar
- `requested_by_user_id` UUID
- `status` varchar: `PENDING`, `APPROVED`, `REJECTED`
- `approved_by_user_id` UUID, nullable
- `rejected_by_user_id` UUID, nullable
- `rejection_reason` text, nullable
- `approved_organization_id` UUID, nullable
- `created_at`, `updated_at`

Purpose:
- Store multiple pending requests per domain.
- Preserve the audit trail for super-admin review.

#### `organization_join_requests`
- This is the approval queue for users joining an already approved org.
- `id` UUID primary key
- `organization_id` UUID, FK to `organizations`
- `user_id` UUID, FK to `users`
- `status` varchar: `PENDING`, `APPROVED`, `REJECTED`
- `approved_by_user_id` UUID, nullable
- `rejected_by_user_id` UUID, nullable
- `rejection_reason` text, nullable
- `created_at`, `updated_at`

Purpose:
- Let org admins approve or reject new joinees in their own org.

#### `system_admins`
- `id` UUID primary key
- `user_id` UUID unique, FK to `users`
- `created_at`

Purpose:
- Gate all super-admin permissions through a dedicated table.

### 1.2 Update existing tables

#### `users`
Add fields:
- `organization_id` UUID, nullable
- `account_status` varchar: `PENDING`, `ACTIVE`, `REJECTED`, `LOCKED`
- `role` varchar: `MEMBER`, `ORG_ADMIN`, `SUPER_ADMIN`
- `joined_at` timestamp, nullable

Notes:
- Keep authentication on `users`.
- Use `account_status` to block login until approval.
- Keep `role` simple and current-stack-friendly.

#### `incidents`
Add:
- `organization_id` UUID not null

Rules:
- Every incident query must be scoped by `organization_id`.
- Add indexes for `organization_id`, `status`, and `created_at`.

### 1.3 Backfill strategy

If the repo already contains live data:
1. Create a seed or legacy org.
2. Attach existing users/incidents to that org.
3. Seed one initial `system_admin`.
4. Only then make org-scoped constraints stricter.

Do not add a not-null `organization_id` to existing rows without backfill.

## Phase 2: Backend Entities And Repositories

### 2.1 Entities

Create or update entities in:
- `backend/src/main/java/com/devopscopilot/backend/entity/Organization.java`
- `backend/src/main/java/com/devopscopilot/backend/entity/OrganizationRequest.java`
- `backend/src/main/java/com/devopscopilot/backend/entity/OrganizationJoinRequest.java`
- `backend/src/main/java/com/devopscopilot/backend/entity/SystemAdmin.java`
- `backend/src/main/java/com/devopscopilot/backend/entity/User.java`
- `backend/src/main/java/com/devopscopilot/backend/entity/Incident.java`

Entity expectations:
- Keep Lombok style consistent with the rest of the code.
- Use JPA annotations already used in the repo.
- Model timestamps as `OffsetDateTime` or the project’s current date type.

### 2.2 Repositories

Add repositories in:
- `backend/src/main/java/com/devopscopilot/backend/repository/OrganizationRepository.java`
- `backend/src/main/java/com/devopscopilot/backend/repository/OrganizationRequestRepository.java`
- `backend/src/main/java/com/devopscopilot/backend/repository/OrganizationJoinRequestRepository.java`
- `backend/src/main/java/com/devopscopilot/backend/repository/SystemAdminRepository.java`

Repository needs:
- find by `domain_key`
- find by status
- count by status for admin dashboards
- find join requests by `organization_id`
- always fetch incidents with `organization_id`

Recommended method shape:
- `findByIdAndOrganizationId(...)`
- `findByDomainKeyAndStatus(...)`
- `findByOrganizationIdAndStatus(...)`
- `existsByUserId(...)`

### 2.3 User repository updates

Update `backend/src/main/java/com/devopscopilot/backend/repository/UserRepository.java` to support:
- `findByEmail(...)`
- `existsByEmail(...)`
- `findByOrganizationId(...)`
- `findByOrganizationIdAndAccountStatus(...)`
- `findByEmailAndOrganizationId(...)` if needed for scoped lookups

## Phase 3: Auth And Registration Flow

### 3.1 Request DTO changes

Update:
- `backend/src/main/java/com/devopscopilot/backend/dto/request/RegisterRequest.java`

New registration shape:
- `username`
- `email`
- `password`
- `organizationName`

Remove the client-supplied role field from registration.
Roles should be assigned by the workflow, not chosen arbitrarily by the client.

### 3.2 Registration logic

Update `backend/src/main/java/com/devopscopilot/backend/service/AuthService.java`

Registration flow:
1. Normalize the email and extract `domain_key`.
2. Look up an approved org for that `domain_key`.
3. If an approved org exists:
   - create a `organization_join_requests` row
   - create the user with `account_status=PENDING`
   - set the user role to `MEMBER`
   - do not grant access yet
4. If no approved org exists:
   - require `organizationName`
   - create an `organization_requests` row
   - create the user with `account_status=PENDING`
   - mark the user as the provisional admin candidate
   - set the user role to `ORG_ADMIN` provisionally
5. Return a response that tells the frontend whether the user is:
   - waiting for super-admin org approval
   - waiting for org-admin join approval

Important:
- No OTP stage.
- No email-based trust check beyond domain extraction.
- The first requester becomes admin only after the org is approved.

### 3.3 Login logic

Update `AuthService.login(...)` and keep the existing cookie-based controller flow.

Login rules:
1. Authenticate username/email and password as today.
2. Deny login unless `account_status=ACTIVE`.
3. Deny login if the org is not approved.
4. Deny login if the user is in a pending org request or pending join request.
5. Mint JWT only after approval.

JWT should include:
- `userId`
- `organizationId`
- `role`
- `isSystemAdmin` or equivalent authority signal

### 3.4 Auth response shape

Extend `AuthResponse` if needed to include:
- `organizationId`
- `accountStatus`
- `role`
- `nextStep` or a similar status hint

Keep the existing `ApiResponse<AuthResponse>` pattern used by `AuthController`.

## Phase 4: Super Admin Approval Flow

### 4.1 Super admin service

Create:
- `backend/src/main/java/com/devopscopilot/backend/service/OrganizationAdminService.java`
- `backend/src/main/java/com/devopscopilot/backend/service/SystemAdminService.java`

Responsibilities:
- Approve org requests
- Reject org requests
- List pending org requests
- List approved orgs
- Auto-reject duplicates for the same `domain_key`

### 4.2 Super admin controller

Create:
- `backend/src/main/java/com/devopscopilot/backend/controller/AdminController.java`

Suggested endpoints:
- `GET /api/v1/admin/organizations`
- `GET /api/v1/admin/organizations/pending`
- `GET /api/v1/admin/organization-requests`
- `POST /api/v1/admin/organization-requests/{id}/approve`
- `POST /api/v1/admin/organization-requests/{id}/reject`

Behavior when approving one request:
1. Create or activate the org from that request.
2. Mark the requesting user as `ACTIVE`.
3. Promote that user to `ORG_ADMIN`.
4. Mark the org as `APPROVED`.
5. Reject every other pending org request with the same `domain_key`.
6. If the domain already has an approved org, block approval of any other request for that domain.

### 4.3 System admin security

Update `backend/src/main/java/com/devopscopilot/backend/config/SecurityConfig.java`

Rules:
- `SUPER_ADMIN` authority comes from `system_admins`.
- Use `@PreAuthorize("hasRole('SUPER_ADMIN')")` or equivalent on admin endpoints.
- Super admin can see all orgs and all org requests.

## Phase 5: Org Admin Join Approval Flow

### 5.1 Org admin controller

Create:
- `backend/src/main/java/com/devopscopilot/backend/controller/OrgAdminController.java`

Suggested endpoints:
- `GET /api/v1/org-admin/join-requests`
- `POST /api/v1/org-admin/join-requests/{id}/approve`
- `POST /api/v1/org-admin/join-requests/{id}/reject`

### 5.2 Org admin service logic

Rules:
1. Only the active org admin for that specific org can approve joiners.
2. The org must already be approved.
3. A pending join request does not grant access.
4. On approval, update the user to:
   - `organization_id = current org`
   - `role = MEMBER`
   - `account_status = ACTIVE`
5. On rejection, keep the request audited and block login.

### 5.3 Joiner behavior

If an approved org already exists for a `domain_key`, later users should be treated as join requests to that approved org.

If no approved org exists yet, the user should create an org request instead.

## Phase 6: Tenant Isolation And Security

### 6.1 Tenant context

Create a simple request-scoped org context if needed:
- `backend/src/main/java/com/devopscopilot/backend/security/OrgContext.java`

Use it to hold:
- current `organizationId`
- current role

### 6.2 JWT and auth filter

Update:
- `backend/src/main/java/com/devopscopilot/backend/security/JwtService.java`
- `backend/src/main/java/com/devopscopilot/backend/security/JwtAuthFilter.java`
- `backend/src/main/java/com/devopscopilot/backend/security/UserDetailsServiceImpl.java`

JWT and auth rules:
- Only mint tokens for active accounts.
- Include organization claims in the token.
- Load `SUPER_ADMIN` authority from `system_admins`.
- Load org role from the active user record.

### 6.3 Incident access rules

Update:
- `backend/src/main/java/com/devopscopilot/backend/controller/IncidentController.java`
- `backend/src/main/java/com/devopscopilot/backend/service/IncidentService.java`
- `backend/src/main/java/com/devopscopilot/backend/repository/IncidentRepository.java`

Rules:
- Never query incidents without `organization_id`.
- Prefer repository methods like `findByIdAndOrganizationId(...)`.
- Every list query must be org-filtered.
- Every create/update/delete path must enforce the current org.

### 6.4 Dashboard access

Update:
- `backend/src/main/java/com/devopscopilot/backend/controller/DashboardController.java`
- `backend/src/main/java/com/devopscopilot/backend/service/DashboardService.java`

Dashboard rules:
- Regular users see only their org data.
- Super admin may see global admin metrics if needed.

## Phase 7: Frontend Flow

### 7.1 Registration page

Update:
- `frontend/src/app/(auth)/register/page.tsx`

Expected UI behavior:
- Email, password, username, organization name
- Explain that approval is required before access
- Show separate states for:
  - org request pending super admin approval
  - join request pending org admin approval

Use the existing Next.js app router and current form style.
Keep the UI consistent with the repo’s current auth and dashboard pages.

### 7.2 Waiting page

Create:
- `frontend/src/app/(auth)/waiting-approval/page.tsx`

Purpose:
- Show that the user has registered successfully but cannot log in yet.
- Explain whether they are waiting on:
  - super admin org approval
  - org admin join approval

### 7.3 Super admin dashboard

Create:
- `frontend/src/app/admin/organizations/page.tsx`
- optionally `frontend/src/app/admin/organizations/[id]/page.tsx`

Display:
- pending org requests
- approved orgs
- rejection reasons
- approve/reject actions
- counts by status

### 7.4 Org admin dashboard

Create:
- `frontend/src/app/org-admin/join-requests/page.tsx`

Display:
- pending join requests for the current org
- approve/reject actions
- basic org info

### 7.5 Frontend data flow

Prefer the existing fetch patterns already used in the app:
- cookie-based auth
- `ApiResponse`
- simple form submit + status handling

Do not introduce a new state management layer unless needed.

## Phase 8: RabbitMQ And AI Service Updates

### 8.1 Message schema

Update:
- `backend/src/main/java/com/devopscopilot/backend/messaging/IncidentAnalysisRequestMessage.java`
- `backend/src/main/java/com/devopscopilot/backend/messaging/IncidentAnalysisResultMessage.java`

Add:
- `organization_id`

### 8.2 Backend publisher

Update the backend path that creates analysis jobs so every message includes the org ID.

### 8.3 AI service

Update:
- `ai-service/app/models/messages.py`
- `ai-service/app/services/rabbitmq.py`
- `ai-service/app/services/database.py`
- `ai-service/app/pipeline/graph.py` if needed

Rules:
- Every database query in the AI service must filter by `organization_id`.
- The AI service should never mix logs, metrics, or incident results across orgs.
- If a message is missing org context, reject it or fail safely.

## Phase 9: Migration And Testing

### 9.1 Migration sequence

1. Add the new org tables.
2. Add the new approval status columns.
3. Backfill legacy data into a seeded org if needed.
4. Seed one initial `system_admin`.
5. Tighten constraints only after the backfill is safe.

### 9.2 Test matrix

Add tests for:
- first user creates an org request
- super admin approves one request and auto-rejects duplicates for the same `domain_key`
- org admin cannot access anything before approval
- org admin can approve/reject join requests only for their org
- later signups on an approved domain become join requests, not new orgs
- login is blocked for pending or rejected accounts
- incident queries are always org-scoped
- `gmail.com` and `google.com` behave as grouping keys, not trust signals

### 9.3 Security checks

Verify:
- no incident query is missing `organization_id`
- no pending org admin can access protected endpoints
- `SUPER_ADMIN` only comes from `system_admins`
- tokens are only minted for active users
- rejected orgs and rejected joiners cannot log in

## Implementation Order

1. Add migrations and backfill path.
2. Add org and request entities/repositories.
3. Update auth registration and login.
4. Add super admin approval endpoints.
5. Add org admin join approval endpoints.
6. Enforce org scoping in incidents and dashboards.
7. Add frontend pages and status handling.
8. Update RabbitMQ and AI service org filtering.
9. Add tests and security audits.

## Key Invariants To Preserve

1. Multiple pending org requests per `domain_key` are allowed.
2. Only one approved org per `domain_key` is allowed.
3. Approving one org request auto-rejects the others for that domain.
4. The first requester becomes org admin only after approval.
5. Org admins have no access before approval.
6. Org admins manage joiners for their own org only.
7. Super admins can view and manage all orgs.
8. Domain matching is grouping only, not authorization.
