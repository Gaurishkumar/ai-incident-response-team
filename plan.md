# Multi-Tenant Implementation Plan

## Phase 1: Database Setup
### Step 1.1 - Create Flyway Migration Files
**File:** `backend/src/main/resources/db/migration/V2__add_multi_tenant_support.sql`

```sql
-- New organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    domain VARCHAR(255) NOT NULL UNIQUE,
    owner_user_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    -- allowed: PENDING, APPROVED, REJECTED
    rejection_reason TEXT NULLABLE,
    rejected_at TIMESTAMPTZ NULLABLE,
    approved_at TIMESTAMPTZ NULLABLE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_organizations_domain (domain),
    INDEX idx_organizations_status (status)
);

-- New system_admins table (super-admins)
CREATE TABLE system_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Modify users table: add organization_id
ALTER TABLE users 
ADD COLUMN organization_id UUID NULLABLE,
ADD FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;

-- Add index for org-based queries
CREATE INDEX idx_users_organization_id ON users(organization_id);

-- Modify incidents: add organization_id
ALTER TABLE incidents 
ADD COLUMN organization_id UUID NOT NULL,
ADD FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
ADD INDEX idx_incidents_organization_id (organization_id);

-- Add org isolation index (critical for performance)
CREATE INDEX idx_incidents_org_status ON incidents(organization_id, status);
CREATE INDEX idx_incidents_org_created ON incidents(organization_id, created_at DESC);
```

### Step 1.2 - Create System Admin Bootstrap Migration
**File:** `backend/src/main/resources/db/migration/V3__bootstrap_system_admin.sql`

```sql
-- MANUAL SETUP REQUIRED:
-- After first super-admin user is created, run:
-- INSERT INTO system_admins (user_id) VALUES ('{SUPER_ADMIN_USER_ID}');
```

---

## Phase 2: Entity & Model Updates (Spring Boot)
### Step 2.1 - Create Organization JPA Entity
**File:** `backend/src/main/java/com/devops/entities/Organization.java`

Key fields:
- `id` (UUID)
- `name` (String, unique)
- `domain` (String, unique)
- `ownerUserId` (UUID, FK to User)
- `status` (String: PENDING, APPROVED, REJECTED)
- `rejectionReason` (String, nullable)
- `rejectedAt`, `approvedAt`, `createdAt` (timestamps)

Relationships:
- One-to-many: Organization → Users
- One-to-many: Organization → Incidents

### Step 2.2 - Create SystemAdmin JPA Entity
**File:** `backend/src/main/java/com/devops/entities/SystemAdmin.java`

Key fields:
- `id` (UUID)
- `userId` (UUID, unique, FK to User)
- `createdAt` (timestamp)

### Step 2.3 - Update User Entity
**File:** `backend/src/main/java/com/devops/entities/User.java`

Add fields:
- `organizationId` (UUID, nullable)
- `isSystemAdmin` (boolean, transient, loaded from SystemAdmin table)

### Step 2.4 - Update Incident Entity
**File:** `backend/src/main/java/com/devops/entities/Incident.java`

Add field:
- `organizationId` (UUID, non-nullable)

Add constraint:
- Cascade delete: if org deleted, incidents deleted

---

## Phase 3: Repository & Query Updates (Spring Boot)
### Step 3.1 - Create Organization Repository
**File:** `backend/src/main/java/com/devops/repositories/OrganizationRepository.java`

Methods:
```java
Optional<Organization> findByDomain(String domain);
Optional<Organization> findByName(String name);
List<Organization> findByStatus(String status);  // PENDING, APPROVED
List<Organization> findByStatusOrderByCreatedAtDesc(String status);
```

### Step 3.2 - Create SystemAdmin Repository
**File:** `backend/src/main/java/com/devops/repositories/SystemAdminRepository.java`

Methods:
```java
boolean existsByUserId(UUID userId);
Optional<SystemAdmin> findByUserId(UUID userId);
```

### Step 3.3 - Update User Repository
**File:** `backend/src/main/java/com/devops/repositories/UserRepository.java`

Add methods:
```java
Optional<User> findByEmailAndOrganizationId(String email, UUID orgId);
List<User> findByOrganizationId(UUID orgId);
```

### Step 3.4 - Update Incident Repository
**File:** `backend/src/main/java/com/devops/repositories/IncidentRepository.java`

Replace ALL queries with org-filtered versions:

OLD:
```java
List<Incident> findByCreatedBy(UUID userId);
```

NEW:
```java
List<Incident> findByOrganizationIdAndCreatedByOrderByCreatedAtDesc(UUID orgId, UUID userId, Pageable p);
List<Incident> findByOrganizationIdAndStatusOrderByCreatedAtDesc(UUID orgId, String status, Pageable p);
Optional<Incident> findByIdAndOrganizationId(UUID id, UUID orgId);  // CRITICAL: always use this
```

**CRITICAL RULE:** Never query incidents without filtering by `organizationId`. Use `findByIdAndOrganizationId` instead of `findById`.

---

## Phase 4: Authentication Service Updates (Spring Boot)
### Step 4.1 - Create Organization Service
**File:** `backend/src/main/java/com/devops/services/OrganizationService.java`

Methods:
```java
public Organization createPendingOrganization(String name, String domain, UUID ownerUserId) {
    // Validate: domain not taken, name not taken
    // Create org with status=PENDING, rejectionReason=null
    // Return org
}

public Organization approveOrganization(UUID orgId) {
    // Set status=APPROVED, approvedAt=NOW()
    // Get owner user, set user.organizationId = orgId
    // Save user
    // Send email to owner: "Your org is approved"
    // Return org
}

public Organization rejectOrganization(UUID orgId, String reason) {
    // Set status=REJECTED, rejectionReason=reason, rejectedAt=NOW()
    // Send email to owner with reason
    // Return org
}

public Optional<Organization> findByDomain(String domain) {
    // Query by domain
}

public Optional<Organization> findApprovedByDomain(String domain) {
    // Query by domain AND status=APPROVED
}
```

### Step 4.2 - Create SystemAdmin Service
**File:** `backend/src/main/java/com/devops/services/SystemAdminService.java`

Methods:
```java
public boolean isSystemAdmin(UUID userId) {
    // Check if user exists in system_admins table
}

public void makeSystemAdmin(UUID userId) {
    // Insert into system_admins
}

public void removeSystemAdmin(UUID userId) {
    // Delete from system_admins
}
```

### Step 4.3 - Update AuthService (Register)
**File:** `backend/src/main/java/com/devops/services/AuthService.java`

Modify `register()` method:

```java
public RegisterResponse register(RegisterRequest req) {
    String email = req.getEmail();
    String domain = extractDomain(email);  // alice@acme.com → "acme.com"
    
    // Check: domain already registered?
    Optional<Organization> existingOrg = organizationService.findApprovedByDomain(domain);
    
    if (existingOrg.isPresent()) {
        // Case 1: Org exists and is APPROVED
        Organization org = existingOrg.get();
        User user = new User(email, password, role=DEVELOPER, org_id=org.id);
        userRepository.save(user);
        
        return RegisterResponse(
            status="joined_existing_org",
            orgName=org.name,
            message="Welcome to " + org.name
        );
    } else {
        // Case 2: Org doesn't exist → user must create it
        // organizationName is REQUIRED in request
        if (req.getOrganizationName() == null) {
            throw new ValidationException("Organization name required");
        }
        
        Organization newOrg = organizationService.createPendingOrganization(
            name=req.getOrganizationName(),
            domain=domain,
            ownerUserId=null  // Will set after user is created
        );
        
        User user = new User(email, password, role=ADMIN, org_id=null);
        user = userRepository.save(user);  // Save first to get ID
        
        newOrg.setOwnerUserId(user.getId());
        organizationRepository.save(newOrg);
        
        return RegisterResponse(
            status="org_pending_approval",
            orgName=newOrg.name,
            message="Your organization awaits admin approval"
        );
    }
}

private String extractDomain(String email) {
    return email.substring(email.indexOf("@") + 1);
}
```

### Step 4.4 - Update AuthService (Login)
**File:** `backend/src/main/java/com/devops/services/AuthService.java`

Modify `login()` method:

```java
public LoginResponse login(LoginRequest req) {
    User user = userRepository.findByEmail(req.getEmail())
        .orElseThrow(() -> new InvalidCredentialsException());
    
    if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
        throw new InvalidCredentialsException();
    }
    
    // NEW: Check organization status
    if (user.getOrganizationId() != null) {
        Organization org = organizationRepository.findById(user.getOrganizationId())
            .orElseThrow();
        
        if (!org.getStatus().equals("APPROVED")) {
            return LoginResponse(
                success=false,
                error="organization_not_approved",
                message="Your organization has not been approved yet"
            );
        }
    } else {
        // User belongs to pending/rejected org
        return LoginResponse(
            success=false,
            error="organization_pending",
            message="Your organization is awaiting approval"
        );
    }
    
    // Issue JWT
    String jwt = jwtService.generateToken(user);
    return LoginResponse(token=jwt, ...);
}
```

---

## Phase 5: Data Isolation Layer (Spring Boot)
### Step 5.1 - Create OrgContext Helper
**File:** `backend/src/main/java/com/devops/security/OrgContext.java`

```java
public class OrgContext {
    private static final ThreadLocal<UUID> orgId = new ThreadLocal<>();
    
    public static void setOrgId(UUID id) {
        orgId.set(id);
    }
    
    public static UUID getOrgId() {
        return orgId.get();
    }
    
    public static void clear() {
        orgId.remove();
    }
}
```

### Step 5.2 - Create JWT Aspect (Extract Org from Token)
**File:** `backend/src/main/java/com/devops/security/OrgContextAspect.java`

```java
@Aspect
@Component
public class OrgContextAspect {
    @Before("@annotation(RequiresOrg)")
    public void extractOrgFromJWT(JoinPoint jp) {
        // Extract JWT from request header
        // Parse JWT, get organizationId claim
        // Set OrgContext.setOrgId(organizationId)
    }
}
```

### Step 5.3 - Create @RequiresOrg Annotation
**File:** `backend/src/main/java/com/devops/security/RequiresOrg.java`

Marker annotation for endpoints that require org context.

### Step 5.4 - Update All Incident Endpoints
**File:** `backend/src/main/java/com/devops/controllers/IncidentController.java`

Add `@RequiresOrg` to all methods. Replace queries:

```java
@PostMapping
@RequiresOrg
public ResponseEntity<?> createIncident(@RequestBody IncidentCreateRequest req) {
    UUID orgId = OrgContext.getOrgId();
    UUID userId = getCurrentUser().getId();
    
    // Verify org is APPROVED
    Organization org = organizationRepository.findById(orgId).orElseThrow();
    if (!org.getStatus().equals("APPROVED")) {
        return forbidden("Organization not approved");
    }
    
    Incident incident = new Incident(...);
    incident.setOrganizationId(orgId);
    incident.setCreatedBy(userId);
    // ... rest of creation logic
}

@GetMapping
@RequiresOrg
public ResponseEntity<?> listIncidents(@RequestParam int page, @RequestParam int size) {
    UUID orgId = OrgContext.getOrgId();
    
    Page<Incident> incidents = incidentRepository
        .findByOrganizationIdOrderByCreatedAtDesc(orgId, PageRequest.of(page, size));
    
    return ok(incidents);
}

@GetMapping("/{id}")
@RequiresOrg
public ResponseEntity<?> getIncident(@PathVariable UUID id) {
    UUID orgId = OrgContext.getOrgId();
    
    Incident incident = incidentRepository
        .findByIdAndOrganizationId(id, orgId)
        .orElseThrow(() -> notFound("Incident not found"));
    
    return ok(incident);
}
```

**CRITICAL:** Every single incident query must include `.andOrganizationId(orgId)` filter.

---

## Phase 6: Admin Dashboard Endpoints (Spring Boot)
### Step 6.1 - Create AdminController
**File:** `backend/src/main/java/com/devops/controllers/AdminController.java`

```java
@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {
    
    @GetMapping("/orgs/pending")
    @PreAuthorize("hasRole('SYSTEM_ADMIN')")
    public ResponseEntity<?> getPendingOrganizations() {
        List<Organization> pending = organizationRepository
            .findByStatusOrderByCreatedAtDesc("PENDING");
        return ok(pending);
    }
    
    @PostMapping("/orgs/{orgId}/approve")
    @PreAuthorize("hasRole('SYSTEM_ADMIN')")
    public ResponseEntity<?> approveOrganization(@PathVariable UUID orgId) {
        Organization org = organizationRepository.findById(orgId).orElseThrow();
        organizationService.approveOrganization(orgId);
        return ok(org);
    }
    
    @PostMapping("/orgs/{orgId}/reject")
    @PreAuthorize("hasRole('SYSTEM_ADMIN')")
    public ResponseEntity<?> rejectOrganization(
        @PathVariable UUID orgId,
        @RequestBody RejectRequest req
    ) {
        organizationService.rejectOrganization(orgId, req.getReason());
        return ok("Organization rejected");
    }
    
    @GetMapping("/dashboard")
    @PreAuthorize("hasRole('SYSTEM_ADMIN')")
    public ResponseEntity<?> getDashboardStats() {
        long pendingCount = organizationRepository.countByStatus("PENDING");
        long approvedCount = organizationRepository.countByStatus("APPROVED");
        long rejectedCount = organizationRepository.countByStatus("REJECTED");
        
        return ok(new AdminDashboardStats(pendingCount, approvedCount, rejectedCount));
    }
}
```

### Step 6.2 - Add System Admin Check
**File:** `backend/src/main/java/com/devops/security/SecurityConfig.java`

Configure Spring Security to:
- Load SYSTEM_ADMIN role from `system_admins` table
- Set role only for users in system_admins table
- Use `@PreAuthorize("hasRole('SYSTEM_ADMIN')")` on admin endpoints

---

## Phase 7: Frontend Registration Flow (Next.js)
### Step 7.1 - Update Register Page
**File:** `frontend/app/auth/register/page.tsx`

```typescript
export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [existingOrg, setExistingOrg] = useState<Organization | null>(null);
  const [checkingDomain, setCheckingDomain] = useState(false);

  // Check domain when email changes
  useEffect(() => {
    if (!email.includes("@")) return;
    
    const domain = email.substring(email.indexOf("@") + 1);
    setCheckingDomain(true);
    
    fetch(`/api/v1/auth/check-domain?domain=${domain}`)
      .then(r => r.json())
      .then(data => {
        setExistingOrg(data.organization);
        setCheckingDomain(false);
      });
  }, [email]);

  const handleRegister = async () => {
    if (existingOrg && !orgName) {
      // Joining existing org
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      // Handle response
    } else {
      // Creating new org
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, organizationName: orgName })
      });
      // Handle response
    }
  };

  return (
    <div>
      <input value={email} onChange={e => setEmail(e.target.value)} />
      <input value={password} onChange={e => setPassword(e.target.value)} />
      
      {checkingDomain && <p>Checking organization...</p>}
      
      {existingOrg && (
        <div>
          <p>Found organization: {existingOrg.name}</p>
          <button onClick={handleRegister}>Join {existingOrg.name}</button>
        </div>
      )}
      
      {!existingOrg && !checkingDomain && (
        <div>
          <input 
            value={orgName} 
            onChange={e => setOrgName(e.target.value)}
            placeholder="Organization name"
          />
          <button onClick={handleRegister} disabled={!orgName}>
            Create Organization
          </button>
        </div>
      )}
    </div>
  );
}
```

### Step 7.2 - Create Approval Waiting Page
**File:** `frontend/app/auth/waiting-approval/page.tsx`

Shown after registration if org is PENDING.

### Step 7.3 - Create Admin Dashboard Page
**File:** `frontend/app/admin/organizations/page.tsx`

Display:
- Pending orgs table with [Approve] [Reject] buttons
- Approved orgs table
- Stats

---

## Phase 8: RabbitMQ & FastAPI Updates
### Step 8.1 - Update RabbitMQ Message Schema
Add `organization_id` to `IncidentAnalysisRequestMessage` and `IncidentAnalysisResultMessage`.

### Step 8.2 - Update FastAPI
**File:** `ai-service/app/services/analysis_service.py`

Add org_id to:
- PostgreSQL query filters (incidents, incident_metrics, incident_logs)
- RabbitMQ result message construction

---

## Phase 9: Testing & Migration
### Step 9.1 - Database Migration
1. Run Flyway migrations V2 and V3
2. Manually insert first system admin into `system_admins` table

### Step 9.2 - Test Checklist
- [ ] Alice registers with alice@acme.com, creates "Acme Corp" org
- [ ] Org appears as PENDING in admin dashboard
- [ ] Alice can't login (org not approved)
- [ ] Admin approves org
- [ ] Alice can now login
- [ ] Bob registers with bob@acme.com
- [ ] Bob auto-joins Acme Corp
- [ ] Bob can immediately use system
- [ ] Charlie registers with charlie@gmail.com, creates "Charlie's Startup"
- [ ] Charlie's org is PENDING, Charlie can't login
- [ ] Admin rejects with reason "Personal email not allowed"
- [ ] Charlie sees rejection reason, can retry with different name
- [ ] Alice and Bob see only Acme incidents (not Charlie's)
- [ ] Incidents table is properly filtered by org_id

### Step 9.3 - Security Audit
- [ ] No incident query missing org_id filter
- [ ] All endpoints require @RequiresOrg
- [ ] JWT contains organization_id claim
- [ ] System admin role only for users in system_admins table

---

## Estimated Effort
- Phase 1-2 (Database + entities): 2-3 hours
- Phase 3-4 (Auth + orgs): 4-5 hours
- Phase 5 (Data isolation): 3-4 hours
- Phase 6 (Admin endpoints): 2-3 hours
- Phase 7 (Frontend): 3-4 hours
- Phase 8 (RabbitMQ/FastAPI): 1-2 hours
- Phase 9 (Testing): 2-3 hours

**Total: 17-24 hours (2-3 days for 1 developer)**

---

## Order of Implementation
1. Start with Phase 1-2 (DB + entities)
2. Then Phase 3-4 (repos + auth)
3. Then Phase 5 (isolation) — do this BEFORE updating all controllers
4. Then Phase 6 (admin)
5. Then Phase 7 (frontend)
6. Then Phase 8 (messaging)
7. Finally Phase 9 (test)

**Do NOT skip Phase 5.** Data isolation must be in place before deploying.
