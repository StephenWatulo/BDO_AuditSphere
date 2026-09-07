-- ---------------------------------------------------------------------------
-- BDO AuditSphere: tenant Row Level Security, immutable audit trail,
-- trigram search indexes.
--
-- TENANCY MODEL
-- The API is the primary enforcement point for tenant isolation: every query
-- goes through a Prisma client extension that injects `tenantId` filters and
-- values. The policies below are defence-in-depth for any *other* database
-- role (reporting users, BI connectors, ad-hoc analysts) that connects with
-- `SET app.tenant_id = '<uuid>'`.
--
-- RLS is enabled WITHOUT `FORCE ROW LEVEL SECURITY`. In PostgreSQL the table
-- owner bypasses non-forced policies, so the application user (which owns the
-- tables because it ran the migrations) keeps full access when
-- `app.tenant_id` is not set - for example during migrations, seeding and
-- background jobs that legitimately span tenants. Any non-owner role is
-- restricted to the tenant named in `app.tenant_id`, or to nothing at all when
-- the setting is absent (`app_current_tenant()` then returns NULL and the
-- comparison is never true). Members of `auditsphere_admin` bypass the tenant
-- policy explicitly through the permissive `tenant_admin_bypass` policy.
--
-- Tables whose `tenantId` is nullable (global BDO content: WorkpaperTemplate,
-- LibraryItem) additionally allow rows with a NULL tenantId to be read by every
-- tenant.
-- ---------------------------------------------------------------------------

-- a) Current tenant helper. `current_setting(..., true)` returns NULL instead of
--    raising when the setting has not been defined in the session.
CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

COMMENT ON FUNCTION app_current_tenant() IS
  'Tenant id for the current session, read from the app.tenant_id setting (NULL when unset).';

-- b) Administrative bypass role (NOLOGIN; grant membership to break-glass users).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auditsphere_admin') THEN
    CREATE ROLE auditsphere_admin NOLOGIN;
  END IF;
END
$$;

-- b) Enable RLS and create policies on every table that carries a tenantId column.
DO $$
DECLARE
  t record;
  using_expr text;
BEGIN
  FOR t IN
    SELECT c.table_name, c.is_nullable
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
    WHERE c.table_schema = current_schema()
      AND c.column_name = 'tenantId'
      AND tb.table_type = 'BASE TABLE'
    ORDER BY c.table_name
  LOOP
    IF t.is_nullable = 'YES' THEN
      using_expr := format('(%I IS NULL OR %I = app_current_tenant())', 'tenantId', 'tenantId');
    ELSE
      using_expr := format('(%I = app_current_tenant())', 'tenantId');
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.table_name);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t.table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I AS PERMISSIVE FOR ALL TO PUBLIC USING %s WITH CHECK %s',
      t.table_name, using_expr, using_expr
    );

    EXECUTE format('DROP POLICY IF EXISTS tenant_admin_bypass ON %I', t.table_name);
    EXECUTE format(
      'CREATE POLICY tenant_admin_bypass ON %I AS PERMISSIVE FOR ALL TO auditsphere_admin USING (true) WITH CHECK (true)',
      t.table_name
    );
  END LOOP;
END
$$;

-- c) Append-only audit trail: block UPDATE and DELETE at the database level.
CREATE OR REPLACE FUNCTION audit_trail_immutable() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AuditTrail rows are immutable (% attempted on id %)', TG_OP, COALESCE(OLD.id, -1)
    USING ERRCODE = 'restrict_violation';
END
$$;

DROP TRIGGER IF EXISTS audit_trail_immutable_trg ON "AuditTrail";
CREATE TRIGGER audit_trail_immutable_trg
  BEFORE UPDATE OR DELETE ON "AuditTrail"
  FOR EACH ROW EXECUTE FUNCTION audit_trail_immutable();

-- Also block bulk TRUNCATE.
CREATE OR REPLACE FUNCTION audit_trail_no_truncate() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AuditTrail cannot be truncated' USING ERRCODE = 'restrict_violation';
END
$$;

DROP TRIGGER IF EXISTS audit_trail_no_truncate_trg ON "AuditTrail";
CREATE TRIGGER audit_trail_no_truncate_trg
  BEFORE TRUNCATE ON "AuditTrail"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_trail_no_truncate();

-- d) Trigram search indexes for the global search endpoint.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Engagement_title_trgm_idx" ON "Engagement" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Finding_title_trgm_idx" ON "Finding" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Workpaper_title_trgm_idx" ON "Workpaper" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "AuditEntity_name_trgm_idx" ON "AuditEntity" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Risk_title_trgm_idx" ON "Risk" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Control_title_trgm_idx" ON "Control" USING GIN ("title" gin_trgm_ops);

-- e) Document.uploadedAt safety: the column is already defined in the schema and
--    created by the init migration. Kept as a guarded no-op so this migration
--    stays valid against databases created from an earlier schema revision.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Document'
      AND column_name = 'uploadedAt'
  ) THEN
    ALTER TABLE "Document" ADD COLUMN "uploadedAt" TIMESTAMP(3);
  END IF;
END
$$;
