-- ============================================================
-- V3: Multi-tenant org model
-- ============================================================

-- 1. Approved organizations
CREATE TABLE organizations (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_key          VARCHAR(255) NOT NULL UNIQUE,
    name                VARCHAR(255) NOT NULL UNIQUE,
    owner_user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status              VARCHAR(50)  NOT NULL DEFAULT 'APPROVED'
                                CHECK (status IN ('APPROVED', 'SUSPENDED')),
    approved_by_user_id UUID         REFERENCES users(id) ON DELETE SET NULL,
    approved_at         TIMESTAMPTZ,
    suspended_at        TIMESTAMPTZ,
    suspension_reason   TEXT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_status ON organizations(status);

-- 2. Pending org creation requests
CREATE TABLE organization_requests (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_key           VARCHAR(255) NOT NULL,
    org_name             VARCHAR(255) NOT NULL,
    requested_by_user_id UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status               VARCHAR(50)  NOT NULL DEFAULT 'PENDING'
                                 CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approved_by_user_id   UUID         REFERENCES users(id) ON DELETE SET NULL,
    rejected_by_user_id   UUID         REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason      TEXT,
    approved_organization_id UUID      REFERENCES organizations(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organization_requests_domain_status
    ON organization_requests(domain_key, status);

CREATE INDEX idx_organization_requests_requested_by
    ON organization_requests(requested_by_user_id);

-- 3. Pending join requests for approved organizations
CREATE TABLE organization_join_requests (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id      UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id              UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status               VARCHAR(50)  NOT NULL DEFAULT 'PENDING'
                                 CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approved_by_user_id   UUID         REFERENCES users(id) ON DELETE SET NULL,
    rejected_by_user_id   UUID         REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason      TEXT,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_join_request UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_organization_join_requests_org_status
    ON organization_join_requests(organization_id, status);

CREATE INDEX idx_organization_join_requests_user_id
    ON organization_join_requests(user_id);

-- 4. Super admins
CREATE TABLE system_admins (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 5. Existing users: add tenant fields without breaking current auth
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS organization_id UUID NULL REFERENCES organizations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('DEVELOPER', 'ADMIN', 'MEMBER', 'ORG_ADMIN', 'SUPER_ADMIN'));

ALTER TABLE users
    ADD CONSTRAINT users_account_status_check
    CHECK (account_status IN ('PENDING', 'ACTIVE', 'REJECTED', 'LOCKED'));

CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_organization_status ON users(organization_id, account_status);

-- 6. Existing incidents: add tenant ownership
ALTER TABLE incidents
    ADD COLUMN IF NOT EXISTS organization_id UUID NULL REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX idx_incidents_organization_id ON incidents(organization_id);
CREATE INDEX idx_incidents_org_status ON incidents(organization_id, status);
CREATE INDEX idx_incidents_org_created ON incidents(organization_id, created_at DESC);

