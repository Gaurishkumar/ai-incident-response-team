• Here’s the plan broken into smaller execution steps, in the order I’d actually do it.

  1. Define the tenant model

  - Add organizations, organization_requests, organization_join_requests, and system_admins.
  - Decide the statuses up front: PENDING, APPROVED, REJECTED, SUSPENDED for orgs, and PENDING, APPROVED, REJECTED for
    requests.

  - Add organization_id to users and incidents.

  2. Add migrations and backfill path

  - Create Flyway migrations in backend/src/main/resources/db/migration.
  - Backfill existing users/incidents into a default org if the repo already has data.
  - Add constraints only after the backfill path is safe.

  3. Update backend entities and repositories

  - Create JPA entities for orgs, org requests, join requests, and system admins.
  - Update User and Incident entities to carry tenant fields.
  - Add repository methods that always support organization_id filtering.

  4. Change registration logic

  - Remove client-selected role from signup.
  - Extract domain_key from the email domain.
  - If no approved org exists, create an org request and keep the user pending.
  - If an approved org exists, create a join request for that org instead.

  5. Change login and JWT issuance

  - Block login for pending or rejected accounts.
  - Issue JWT only after the user is active.
  - Put organizationId and role info into the token and auth context.

  6. Build super admin approval flow

  - Add admin endpoints for listing pending org requests and approved orgs.
  - Let SUPER_ADMIN approve or reject org requests.
  - When one request is approved for a domain_key, auto-reject the rest.

  7. Build org admin join approval flow

  - Add org-admin endpoints for pending join requests in their org.
  - Allow ORG_ADMIN to approve or reject new joinees.
  - Keep org admins blocked until the org itself is approved.

  8. Enforce org isolation everywhere

  - Update incident queries to always require organization_id.
  - Update dashboards and any org-owned data access the same way.
  - Make sure no endpoint can read cross-org data by accident.

  9. Update the frontend flows

  - Update registration to show org-request vs join-request outcomes.
  - Add a waiting/approval page.
  - Add a super-admin org review page.
  - Add an org-admin join-request page.

  - Add organization_id to incident analysis messages.
  - Filter every AI-service database query by org.
  11. Add tests and security checks

  - Test duplicate domain requests, auto-rejection, and approval behavior.
  - Test that pending admins have no access.
  - Test that incidents are always scoped to the current org.
  - Test that only system_admins can access super-admin actions.

  12. Validate rollout order

  - Do migrations first.
  - Then auth and approval flows.
  - Then isolation enforcement.
  - Then frontend.
  - Then messaging and AI service.
  - Finish with tests and security audit.