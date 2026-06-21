-- ============================================================
-- V4: Backfill legacy rows into a default approved organization
-- ============================================================

DO $$
DECLARE
    legacy_owner UUID;
    legacy_org_id UUID;
BEGIN
    SELECT id
    INTO legacy_owner
    FROM users
    ORDER BY created_at ASC
    LIMIT 1;

    IF legacy_owner IS NULL THEN
        RAISE NOTICE 'No users found. Skipping legacy org backfill.';
        RETURN;
    END IF;

    INSERT INTO organizations (
        domain_key,
        name,
        owner_user_id,
        status,
        created_at,
        updated_at
    ) VALUES (
        'legacy.local',
        'Legacy Organization',
        legacy_owner,
        'APPROVED',
        NOW(),
        NOW()
    )
    RETURNING id INTO legacy_org_id;

    UPDATE users
    SET organization_id = legacy_org_id
    WHERE organization_id IS NULL;

    UPDATE incidents
    SET organization_id = legacy_org_id
    WHERE organization_id IS NULL;
END $$;

