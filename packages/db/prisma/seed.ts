/**
 * BDO AuditSphere seed.
 *
 *   pnpm db:seed
 *
 * Idempotent: every row is located by a natural key (slug, email, code,
 * reference, ...) and created or updated, so the script can be re-run on a
 * database that already contains demo data. AuditTrail rows are append-only
 * (a trigger blocks UPDATE/DELETE) and are therefore only inserted when absent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient, Prisma } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLE_LABELS,
  ROLE_KEYS,
  FRAMEWORKS,
  scoreRisk,
  permissionModule,
  DEFAULT_THRESHOLDS,
  DEFAULT_WEIGHTS,
  type PermissionKey,
  type RoleKey,
} from '@auditsphere/shared';
import { FRAMEWORK_REFERENCES, FRAMEWORK_DESCRIPTIONS } from './seed-data/frameworks';
import { LIBRARY_ITEMS, PROGRAM_P2P, PROGRAM_UAM, PROGRAM_PAYROLL, type ProgramSectionSeed } from './seed-data/library';
import {
  ENTITIES,
  PROCESSES,
  RISK_CATEGORIES,
  RISKS,
  CONTROLS,
  WORKPAPER_TEMPLATES,
  CHARGE_CODES,
  type OwnerKey,
} from './seed-data/universe';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

function loadEnv() {
  if (process.env.DATABASE_URL) return;
  const candidates = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '..', '..', '.env'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      let value = m[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(m[1] in process.env)) process.env[m[1]] = value;
    }
    if (process.env.DATABASE_URL) return;
  }
}
loadEnv();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env or export DATABASE_URL.');
  process.exit(1);
}

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Where = Record<string, unknown>;
type Data = Record<string, unknown>;
interface Delegate<T> {
  findFirst(args: { where: Where }): Promise<T | null>;
  create(args: { data: Data }): Promise<T>;
  update(args: { where: { id: string }; data: Data }): Promise<T>;
}

/** Find by natural key, then update or create. `where` must be flat scalar fields. */
async function ensure<T extends { id: string }>(delegate: Delegate<T>, where: Where, data: Data): Promise<T> {
  const existing = await delegate.findFirst({ where });
  if (existing) return delegate.update({ where: { id: existing.id }, data });
  return delegate.create({ data: { ...where, ...data } });
}

/** Insert only when absent (for append-only tables). */
async function ensureOnce<T>(delegate: { findFirst(args: { where: Where }): Promise<T | null>; create(args: { data: Data }): Promise<T> }, where: Where, data: Data): Promise<T> {
  const existing = await delegate.findFirst({ where });
  if (existing) return existing;
  return delegate.create({ data: { ...where, ...data } });
}

const d = (iso: string) => new Date(iso.length === 10 ? `${iso}T09:00:00.000Z` : iso);
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const addMonths = (date: Date, months: number) => {
  const copy = new Date(date);
  copy.setUTCMonth(copy.getUTCMonth() + months);
  return copy;
};
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

const PASSWORD = 'Admin123!';

// ---------------------------------------------------------------------------
// Seed sections
// ---------------------------------------------------------------------------

async function seedPermissions() {
  for (const [key, description] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({
      where: { key },
      update: { description, module: permissionModule(key as PermissionKey) },
      create: { key, description, module: permissionModule(key as PermissionKey) },
    });
  }
  return prisma.permission.findMany();
}

async function seedTenant() {
  return prisma.tenant.upsert({
    where: { slug: 'bdo-ea' },
    update: {
      name: 'BDO East Africa',
      region: 'EA',
      settings: { currency: 'KES', entraDefaultRole: 'BUSINESS_OWNER' },
      isActive: true,
    },
    create: {
      slug: 'bdo-ea',
      name: 'BDO East Africa',
      region: 'EA',
      settings: { currency: 'KES', entraDefaultRole: 'BUSINESS_OWNER' },
    },
  });
}

async function seedRoles(tenantId: string, permissions: { id: string; key: string }[]) {
  const permByKey = new Map(permissions.map((p) => [p.key, p.id]));
  const roles: Record<RoleKey, { id: string }> = {} as Record<RoleKey, { id: string }>;
  for (const key of ROLE_KEYS) {
    const role = await prisma.role.upsert({
      where: { tenantId_key: { tenantId, key } },
      update: { name: ROLE_LABELS[key], description: `${ROLE_LABELS[key]} (system role)`, isSystem: true },
      create: { tenantId, key, name: ROLE_LABELS[key], description: `${ROLE_LABELS[key]} (system role)`, isSystem: true },
    });
    roles[key] = role;
    const wanted = ROLE_PERMISSIONS[key].map((p) => permByKey.get(p)).filter((id): id is string => Boolean(id));
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: { notIn: wanted } } });
    await prisma.rolePermission.createMany({
      data: wanted.map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });
  }
  return roles;
}

type UserHandle = 'admin' | 'partner' | 'cae' | 'manager' | 'senior' | 'junior' | 'owner' | 'reviewer' | 'committee';
type Users = Record<UserHandle, { id: string; email: string; displayName: string }>;

const USER_SEED: { handle: UserHandle; email: string; role: RoleKey; firstName: string; lastName: string; jobTitle: string; office: string; chargeRate?: number }[] = [
  { handle: 'admin', email: 'admin@bdo-ea.com', role: 'GLOBAL_ADMIN', firstName: 'Grace', lastName: 'Wanjiru', jobTitle: 'Platform Administrator', office: 'Nairobi' },
  { handle: 'partner', email: 'partner@bdo-ea.com', role: 'AUDIT_PARTNER', firstName: 'David', lastName: 'Mwangi', jobTitle: 'Partner, Risk Advisory Services', office: 'Nairobi', chargeRate: 35000 },
  { handle: 'cae', email: 'cae@bdo-ea.com', role: 'CHIEF_AUDIT_EXECUTIVE', firstName: 'Amina', lastName: 'Hassan', jobTitle: 'Chief Audit Executive (outsourced)', office: 'Nairobi', chargeRate: 28000 },
  { handle: 'manager', email: 'manager@bdo-ea.com', role: 'AUDIT_MANAGER', firstName: 'Peter', lastName: 'Ochieng', jobTitle: 'Internal Audit Manager', office: 'Nairobi', chargeRate: 18000 },
  { handle: 'senior', email: 'senior@bdo-ea.com', role: 'SENIOR_AUDITOR', firstName: 'Faith', lastName: 'Njeri', jobTitle: 'Senior Internal Auditor', office: 'Nairobi', chargeRate: 11000 },
  { handle: 'junior', email: 'junior@bdo-ea.com', role: 'JUNIOR_AUDITOR', firstName: 'Brian', lastName: 'Kiptoo', jobTitle: 'Associate, Internal Audit', office: 'Nairobi', chargeRate: 6500 },
  { handle: 'owner', email: 'owner@client.example', role: 'BUSINESS_OWNER', firstName: 'Samuel', lastName: 'Otieno', jobTitle: 'Head of Procurement, Baraka Holdings', office: 'Nairobi' },
  { handle: 'reviewer', email: 'reviewer@client.example', role: 'MANAGEMENT_REVIEWER', firstName: 'Lydia', lastName: 'Achieng', jobTitle: 'Chief Financial Officer, Baraka Holdings', office: 'Nairobi' },
  { handle: 'committee', email: 'committee@client.example', role: 'AUDIT_COMMITTEE_VIEWER', firstName: 'Joseph', lastName: 'Kamau', jobTitle: 'Chair, Board Audit Committee', office: 'Nairobi' },
];

async function seedUsers(tenantId: string, roles: Record<RoleKey, { id: string }>): Promise<Users> {
  const passwordHash = await hash(PASSWORD);
  const users = {} as Users;
  for (const u of USER_SEED) {
    const displayName = `${u.firstName} ${u.lastName}`;
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email: u.email } },
      update: {
        displayName,
        firstName: u.firstName,
        lastName: u.lastName,
        jobTitle: u.jobTitle,
        officeLocation: u.office,
        country: 'KE',
        status: 'ACTIVE',
        authProvider: 'LOCAL',
        passwordHash,
        mfaEnabled: false,
        chargeRate: u.chargeRate ?? null,
        failedLoginCount: 0,
        lockedUntil: null,
        deletedAt: null,
      },
      create: {
        tenantId,
        email: u.email,
        displayName,
        firstName: u.firstName,
        lastName: u.lastName,
        jobTitle: u.jobTitle,
        officeLocation: u.office,
        country: 'KE',
        status: 'ACTIVE',
        authProvider: 'LOCAL',
        passwordHash,
        mfaEnabled: false,
        chargeRate: u.chargeRate ?? null,
        preferences: { theme: 'system', timezone: 'Africa/Nairobi' },
      },
    });
    users[u.handle] = user;
    const roleId = roles[u.role].id;
    const existing = await prisma.userRole.findFirst({ where: { userId: user.id, roleId, entityId: null } });
    if (!existing) await prisma.userRole.create({ data: { tenantId, userId: user.id, roleId, entityId: null } });
  }
  return users;
}

async function seedFrameworks() {
  const refIds = new Map<string, string>(); // `${code}:${refCode}` -> id
  for (const fw of FRAMEWORKS) {
    const framework = await prisma.framework.upsert({
      where: { code: fw.code },
      update: { name: fw.name, version: fw.version, description: FRAMEWORK_DESCRIPTIONS[fw.code] },
      create: { code: fw.code, name: fw.name, version: fw.version, description: FRAMEWORK_DESCRIPTIONS[fw.code] },
    });
    for (const ref of FRAMEWORK_REFERENCES[fw.code] ?? []) {
      const parentId = ref.parent ? refIds.get(`${fw.code}:${ref.parent}`) ?? null : null;
      const row = await prisma.frameworkReference.upsert({
        where: { frameworkId_refCode: { frameworkId: framework.id, refCode: ref.refCode } },
        update: { title: ref.title, description: ref.description ?? null, parentId },
        create: { frameworkId: framework.id, refCode: ref.refCode, title: ref.title, description: ref.description ?? null, parentId },
      });
      refIds.set(`${fw.code}:${ref.refCode}`, row.id);
    }
  }
  return refIds;
}

async function seedWorkpaperTemplates() {
  const templates = new Map<string, string>();
  for (const t of WORKPAPER_TEMPLATES) {
    const row = await ensure(prisma.workpaperTemplate, { tenantId: null, name: t.name }, {
      category: t.category,
      description: t.description,
      structure: t.structure,
      isActive: true,
    });
    templates.set(t.name, row.id);
  }
  return templates;
}

async function seedRiskConfig(tenantId: string) {
  const categories = new Map<string, string>();
  for (const c of RISK_CATEGORIES) {
    const row = await prisma.riskCategory.upsert({
      where: { tenantId_code: { tenantId, code: c.code } },
      update: { name: c.name, description: c.description, weight: c.weight, colour: c.colour },
      create: { tenantId, ...c },
    });
    categories.set(c.code, row.id);
  }
  const scale = (labels: [string, string][]) => labels.map(([label, description], i) => ({ value: i + 1, label, description }));
  const model = await prisma.scoringModel.upsert({
    where: { tenantId_name: { tenantId, name: 'BDO standard 5x5' } },
    update: { isDefault: true },
    create: {
      tenantId,
      name: 'BDO standard 5x5',
      isDefault: true,
      likelihoodScale: scale([
        ['Rare', 'May occur only in exceptional circumstances (less than once in 10 years).'],
        ['Unlikely', 'Could occur at some time (once in 5 to 10 years).'],
        ['Possible', 'Might occur at some time (once in 2 to 5 years).'],
        ['Likely', 'Will probably occur in most circumstances (once a year).'],
        ['Almost certain', 'Expected to occur in most circumstances (several times a year).'],
      ]),
      impactScale: scale([
        ['Insignificant', 'Loss below KES 1m; no regulatory or reputational effect.'],
        ['Minor', 'Loss KES 1m to 10m; minor customer impact; internal reporting only.'],
        ['Moderate', 'Loss KES 10m to 50m; regulatory query; local media attention.'],
        ['Major', 'Loss KES 50m to 250m; regulatory sanction; sustained negative coverage.'],
        ['Severe', 'Loss above KES 250m; licence at risk; board-level crisis.'],
      ]),
      weights: DEFAULT_WEIGHTS,
      thresholds: DEFAULT_THRESHOLDS,
      appetite: { overall: 10, byCategory: { FRD: 6, CMP: 8, TEC: 8 } },
    },
  });
  return { categories, model };
}

async function seedChargeCodes(tenantId: string) {
  const codes = new Map<string, string>();
  for (const c of CHARGE_CODES) {
    const row = await prisma.chargeCode.upsert({
      where: { tenantId_code: { tenantId, code: c.code } },
      update: { name: c.name, isBillable: c.isBillable, isActive: true },
      create: { tenantId, ...c },
    });
    codes.set(c.code, row.id);
  }
  return codes;
}

function ownerId(users: Users, key?: OwnerKey) {
  return key ? users[key].id : null;
}

async function seedUniverse(tenantId: string, users: Users) {
  const entities = new Map<string, string>();
  for (const e of ENTITIES) {
    const last = e.lastAuditDate ? d(e.lastAuditDate) : null;
    const row = await prisma.auditEntity.upsert({
      where: { tenantId_code: { tenantId, code: e.code } },
      update: {
        parentId: e.parent ? entities.get(e.parent) ?? null : null,
        type: e.type,
        name: e.name,
        description: e.description ?? null,
        ownerId: ownerId(users, e.owner),
        country: e.country ?? null,
        strategicObjectives: e.strategicObjectives ?? [],
        regulatoryRequirements: e.regulatoryRequirements ?? [],
        riskRating: e.riskRating,
        riskScore: e.riskScore ?? null,
        lastAuditDate: last,
        nextAuditDue: last && e.auditFrequencyMonths ? addMonths(last, e.auditFrequencyMonths) : null,
        auditFrequencyMonths: e.auditFrequencyMonths ?? null,
        metadata: e.metadata ?? {},
        isActive: true,
        deletedAt: null,
      },
      create: {
        tenantId,
        code: e.code,
        parentId: e.parent ? entities.get(e.parent) ?? null : null,
        type: e.type,
        name: e.name,
        description: e.description ?? null,
        ownerId: ownerId(users, e.owner),
        country: e.country ?? null,
        strategicObjectives: e.strategicObjectives ?? [],
        regulatoryRequirements: e.regulatoryRequirements ?? [],
        riskRating: e.riskRating,
        riskScore: e.riskScore ?? null,
        lastAuditDate: last,
        nextAuditDue: last && e.auditFrequencyMonths ? addMonths(last, e.auditFrequencyMonths) : null,
        auditFrequencyMonths: e.auditFrequencyMonths ?? null,
        metadata: e.metadata ?? {},
      },
    });
    entities.set(e.code, row.id);
  }

  const processes = new Map<string, { id: string; entityId: string }>();
  for (const p of PROCESSES) {
    const entityId = entities.get(p.entity)!;
    const row = await prisma.process.upsert({
      where: { tenantId_code: { tenantId, code: p.code } },
      update: { entityId, name: p.name, description: p.description, ownerId: ownerId(users, p.owner), category: p.category, isKey: p.isKey, deletedAt: null },
      create: { tenantId, code: p.code, entityId, name: p.name, description: p.description, ownerId: ownerId(users, p.owner), category: p.category, isKey: p.isKey },
    });
    processes.set(p.code, { id: row.id, entityId });
  }
  return { entities, processes };
}

async function seedRisksAndControls(
  tenantId: string,
  users: Users,
  categories: Map<string, string>,
  processes: Map<string, { id: string; entityId: string }>,
  scoringModelId: string,
) {
  const risks = new Map<string, string>();
  for (const r of RISKS) {
    const proc = processes.get(r.process)!;
    const score = scoreRisk({
      inherentLikelihood: r.inherentLikelihood,
      inherentImpact: r.inherentImpact,
      controlEffectiveness: r.controlEffectiveness,
      velocity: r.velocity,
      appetiteThreshold: r.appetiteThreshold,
    });
    const data = {
      title: r.title,
      description: r.description,
      categoryId: categories.get(r.category) ?? null,
      entityId: proc.entityId,
      processId: proc.id,
      ownerId: ownerId(users, r.owner),
      source: r.source,
      status: 'ACTIVE' as const,
      inherentLikelihood: r.inherentLikelihood,
      inherentImpact: r.inherentImpact,
      inherentScore: score.inherentScore,
      controlEffectiveness: r.controlEffectiveness,
      residualLikelihood: score.residualLikelihood,
      residualImpact: score.residualImpact,
      residualScore: score.residualScore,
      velocity: r.velocity,
      rating: score.rating,
      appetiteThreshold: r.appetiteThreshold ?? null,
      withinAppetite: score.withinAppetite,
      lastAssessedAt: d('2026-01-20'),
      tags: r.tags,
      deletedAt: null,
    };
    const row = await prisma.risk.upsert({
      where: { tenantId_code: { tenantId, code: r.code } },
      update: data,
      create: { tenantId, code: r.code, ...data },
    });
    risks.set(r.code, row.id);

    // A FY2026-Q1 assessment for every risk, and a prior-year point for the trend on a subset.
    await ensure(prisma.riskAssessment, { riskId: row.id, periodLabel: 'FY2026-Q1' }, {
      tenantId,
      scoringModelId,
      inherentLikelihood: r.inherentLikelihood,
      inherentImpact: r.inherentImpact,
      inherentScore: score.inherentScore,
      controlEffectiveness: r.controlEffectiveness,
      residualLikelihood: score.residualLikelihood,
      residualImpact: score.residualImpact,
      residualScore: score.residualScore,
      velocity: r.velocity,
      rating: score.rating,
      rationale: `Annual risk assessment workshop, January 2026. Source: ${r.source}.`,
      assessedById: users.manager.id,
      assessedAt: d('2026-01-20'),
    });
    if (['R-001', 'R-003', 'R-009', 'R-010', 'R-017', 'R-020'].includes(r.code)) {
      const prior = scoreRisk({
        inherentLikelihood: r.inherentLikelihood,
        inherentImpact: r.inherentImpact,
        controlEffectiveness: Math.max(1, r.controlEffectiveness - 1),
        velocity: r.velocity,
      });
      await ensure(prisma.riskAssessment, { riskId: row.id, periodLabel: 'FY2025-Q1' }, {
        tenantId,
        scoringModelId,
        inherentLikelihood: r.inherentLikelihood,
        inherentImpact: r.inherentImpact,
        inherentScore: prior.inherentScore,
        controlEffectiveness: Math.max(1, r.controlEffectiveness - 1),
        residualLikelihood: prior.residualLikelihood,
        residualImpact: prior.residualImpact,
        residualScore: prior.residualScore,
        velocity: r.velocity,
        rating: prior.rating,
        rationale: 'Annual risk assessment workshop, January 2025.',
        assessedById: users.manager.id,
        assessedAt: d('2025-01-22'),
      });
    }
  }

  const controls = new Map<string, string>();
  for (const c of CONTROLS) {
    const proc = processes.get(c.process)!;
    const row = await prisma.control.upsert({
      where: { tenantId_code: { tenantId, code: c.code } },
      update: {
        title: c.title,
        description: c.description,
        processId: proc.id,
        ownerId: ownerId(users, c.owner),
        frequency: c.frequency,
        type: c.type,
        nature: c.nature,
        isKeyControl: c.isKeyControl,
        frameworkReferences: c.frameworkReferences,
        isActive: true,
        deletedAt: null,
      },
      create: {
        tenantId,
        code: c.code,
        title: c.title,
        description: c.description,
        processId: proc.id,
        ownerId: ownerId(users, c.owner),
        frequency: c.frequency,
        type: c.type,
        nature: c.nature,
        isKeyControl: c.isKeyControl,
        frameworkReferences: c.frameworkReferences,
      },
    });
    controls.set(c.code, row.id);
    const riskIds = c.risks.map((code) => risks.get(code)!).filter(Boolean);
    await prisma.riskControl.deleteMany({ where: { controlId: row.id, riskId: { notIn: riskIds } } });
    await prisma.riskControl.createMany({
      data: riskIds.map((riskId) => ({ tenantId, riskId, controlId: row.id })),
      skipDuplicates: true,
    });
  }
  return { risks, controls };
}

async function seedLibrary(tenantId: string, users: Users, refIds: Map<string, string>) {
  const items = new Map<string, string>();
  for (const item of LIBRARY_ITEMS) {
    const row = await prisma.libraryItem.upsert({
      where: { tenantId_code_version: { tenantId, code: item.code, version: 1 } },
      update: {
        type: item.type,
        title: item.title,
        summary: item.summary,
        content: item.content as Prisma.InputJsonValue,
        industry: item.industry ?? null,
        tags: item.tags,
        status: 'PUBLISHED',
        approvedById: users.cae.id,
        approvedAt: d('2025-11-14'),
      },
      create: {
        tenantId,
        type: item.type,
        code: item.code,
        title: item.title,
        summary: item.summary,
        content: item.content as Prisma.InputJsonValue,
        industry: item.industry ?? null,
        tags: item.tags,
        version: 1,
        status: 'PUBLISHED',
        usageCount: item.type === 'AUDIT_PROGRAM' ? 3 : 1,
        rating: item.type === 'AUDIT_PROGRAM' ? 4.5 : null,
        createdById: users.manager.id,
        approvedById: users.cae.id,
        approvedAt: d('2025-11-14'),
      },
    });
    items.set(item.code, row.id);
    const referenceIds = item.frameworkRefs.map(([fw, ref]) => refIds.get(`${fw}:${ref}`)).filter((id): id is string => Boolean(id));
    await prisma.libraryItemFrameworkRef.deleteMany({ where: { libraryItemId: row.id, referenceId: { notIn: referenceIds } } });
    await prisma.libraryItemFrameworkRef.createMany({
      data: referenceIds.map((referenceId) => ({ libraryItemId: row.id, referenceId })),
      skipDuplicates: true,
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

async function seedPlan(tenantId: string, users: Users, entities: Map<string, string>) {
  const plan = await prisma.auditPlan.upsert({
    where: { tenantId_fiscalYear_version: { tenantId, fiscalYear: 2026, version: 1 } },
    update: { status: 'ACTIVE' },
    create: {
      tenantId,
      title: 'Internal Audit Plan FY2026',
      fiscalYear: 2026,
      horizonYears: 1,
      startDate: day('2026-01-01'),
      endDate: day('2026-12-31'),
      status: 'ACTIVE',
      version: 1,
      totalBudgetHours: 3200,
      totalBudgetAmount: 38400000,
      currency: 'KES',
      narrative:
        'Risk-based plan derived from the January 2026 enterprise risk assessment, CBK inspection themes, management requests and follow-up of prior year findings. Coverage prioritises procurement, identity and access, credit origination and treasury.',
      createdById: users.cae.id,
      approvedById: users.partner.id,
      approvedAt: d('2025-12-10'),
    },
  });

  const items: { key: string; title: string; entity: string; source: 'RISK_BASED' | 'MANAGEMENT_REQUEST' | 'REGULATORY' | 'FOLLOW_UP' | 'AUDIT_COMMITTEE' | 'ROTATIONAL'; type: 'OPERATIONAL' | 'FINANCIAL' | 'COMPLIANCE' | 'IT' | 'FOLLOW_UP' | 'ADVISORY'; rating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; priority: number; quarter: number; start: string; end: string; hours: number; lead: UserHandle; status: 'PROPOSED' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'DEFERRED' | 'CANCELLED'; rationale: string }[] = [
    { key: 'P2P', title: 'Procure-to-pay process review', entity: 'BH-SS-PRC', source: 'RISK_BASED', type: 'OPERATIONAL', rating: 'HIGH', priority: 1, quarter: 3, start: '2026-07-13', end: '2026-09-30', hours: 320, lead: 'senior', status: 'IN_PROGRESS', rationale: 'Procurement last audited in 2023; three fraud-category risks above appetite.' },
    { key: 'UAM', title: 'User access management review', entity: 'BH-SS-IT', source: 'RISK_BASED', type: 'IT', rating: 'CRITICAL', priority: 1, quarter: 3, start: '2026-09-14', end: '2026-11-13', hours: 280, lead: 'senior', status: 'IN_PROGRESS', rationale: 'CBK inspection raised privileged access on core banking; leaver control rated ineffective.' },
    { key: 'CHG', title: 'IT change management review', entity: 'BH-SS-IT', source: 'RISK_BASED', type: 'IT', rating: 'HIGH', priority: 2, quarter: 1, start: '2026-02-02', end: '2026-03-27', hours: 240, lead: 'senior', status: 'DEFERRED', rationale: 'Deferred to FY2027 pending completion of the core banking upgrade.' },
    { key: 'TRS', title: 'Treasury dealing and settlement review', entity: 'BH-SS-TRS', source: 'RISK_BASED', type: 'FINANCIAL', rating: 'HIGH', priority: 2, quarter: 2, start: '2026-04-06', end: '2026-05-29', hours: 300, lead: 'senior', status: 'COMPLETED', rationale: 'Annual coverage of market risk limits requested by ALCO.' },
    { key: 'PAYFU', title: 'Payroll follow-up review', entity: 'BH-SS-HR', source: 'FOLLOW_UP', type: 'FOLLOW_UP', rating: 'MEDIUM', priority: 3, quarter: 2, start: '2026-03-02', end: '2026-03-31', hours: 80, lead: 'junior', status: 'COMPLETED', rationale: 'Validate remediation of the four findings from IA-2025-014.' },
    { key: 'LON', title: 'Loan origination and KYC compliance review', entity: 'BH-KE-RB', source: 'REGULATORY', type: 'COMPLIANCE', rating: 'CRITICAL', priority: 1, quarter: 4, start: '2026-10-05', end: '2026-12-04', hours: 360, lead: 'manager', status: 'PLANNED', rationale: 'CBK AML/CFT inspection scheduled for Q1 FY2027.' },
    { key: 'CLM', title: 'Insurance claims processing review', entity: 'BH-KE-INS', source: 'RISK_BASED', type: 'OPERATIONAL', rating: 'HIGH', priority: 2, quarter: 4, start: '2026-10-19', end: '2026-12-11', hours: 260, lead: 'manager', status: 'PLANNED', rationale: 'Claims fraud losses increased 22% year on year.' },
    { key: 'CIT', title: 'Cash-in-transit vendor review', entity: 'TP-CIT', source: 'MANAGEMENT_REQUEST', type: 'OPERATIONAL', rating: 'MEDIUM', priority: 3, quarter: 4, start: '2026-11-16', end: '2026-12-18', hours: 160, lead: 'junior', status: 'PROPOSED', rationale: 'Requested by the CFO following unexplained cash shortages at two branches.' },
  ];

  const planItems = new Map<string, string>();
  for (const it of items) {
    const row = await ensure(prisma.auditPlanItem, { planId: plan.id, title: it.title }, {
      tenantId,
      entityId: entities.get(it.entity) ?? null,
      description: it.rationale,
      source: it.source,
      engagementType: it.type,
      riskRating: it.rating,
      priority: it.priority,
      plannedYear: 2026,
      plannedQuarter: it.quarter,
      plannedStart: day(it.start),
      plannedEnd: day(it.end),
      budgetHours: it.hours,
      budgetAmount: it.hours * 12000,
      leadId: users[it.lead].id,
      status: it.status,
      rationale: it.rationale,
    });
    planItems.set(it.key, row.id);
  }

  await ensure(prisma.managementRequest, { tenantId, title: 'Review of cash-in-transit provider losses' }, {
    description: 'Two branches reported cash shortages of KES 3.4m in June 2026 after ATM replenishment by SecureMove. Management requests an independent review of the provider controls and reconciliation process.',
    requestedById: users.reviewer.id,
    requesterName: users.reviewer.displayName,
    entityId: entities.get('TP-CIT') ?? null,
    planItemId: planItems.get('CIT') ?? null,
    priority: 'HIGH',
    status: 'PLANNED',
    receivedAt: d('2026-07-02'),
    decisionNote: 'Accepted and added to the Q4 plan as a management request item.',
  });
  await ensure(prisma.managementRequest, { tenantId, title: 'Pre-implementation review of the mobile lending platform' }, {
    description: 'Retail Banking requests an advisory review of controls in the new mobile lending platform before go-live in Q1 FY2027.',
    requestedById: users.owner.id,
    requesterName: 'Kevin Omondi, Head of Digital Banking',
    entityId: entities.get('BH-KE-RB') ?? null,
    priority: 'MEDIUM',
    status: 'UNDER_REVIEW',
    receivedAt: d('2026-08-21'),
  });

  return { plan, planItems };
}

// ---------------------------------------------------------------------------
// Engagements
// ---------------------------------------------------------------------------

interface EngagementRefs {
  id: string;
  auditNumber: string;
}

async function upsertEngagement(tenantId: string, auditNumber: string, data: Data): Promise<EngagementRefs> {
  const row = await prisma.engagement.upsert({
    where: { tenantId_auditNumber: { tenantId, auditNumber } },
    update: data,
    create: { tenantId, auditNumber, ...data },
  });
  return { id: row.id, auditNumber };
}

async function addMembers(tenantId: string, engagementId: string, users: Users, members: [UserHandle, 'PARTNER' | 'MANAGER' | 'LEAD' | 'SENIOR' | 'JUNIOR' | 'REVIEWER' | 'SPECIALIST' | 'OBSERVER', number][]) {
  for (const [handle, role, hours] of members) {
    await prisma.engagementMember.upsert({
      where: { engagementId_userId: { engagementId, userId: users[handle].id } },
      update: { role, plannedHours: hours },
      create: { tenantId, engagementId, userId: users[handle].id, role, plannedHours: hours },
    });
  }
}

async function addStageHistory(tenantId: string, engagementId: string, changedById: string, steps: [string | null, string, string, string?][]) {
  for (const [fromStage, toStage, at, comment] of steps) {
    await ensure(prisma.engagementStageHistory, { engagementId, toStage }, {
      tenantId,
      fromStage,
      changedById,
      comment: comment ?? null,
      changedAt: d(at),
    });
  }
}

async function addMilestones(tenantId: string, engagementId: string, rows: [string, string | null, string, string | null][]) {
  let sortOrder = 0;
  for (const [name, stage, due, completed] of rows) {
    await ensure(prisma.engagementMilestone, { engagementId, name }, {
      tenantId,
      stage,
      dueDate: day(due),
      completedAt: completed ? d(completed) : null,
      sortOrder: sortOrder++,
    });
  }
}

async function instantiateProgram(
  tenantId: string,
  engagementId: string,
  title: string,
  sections: ProgramSectionSeed[],
  libraryItemId: string | null,
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED',
  approvedById: string | null,
  approvedAt: string | null,
  risks: Map<string, string>,
  controls: Map<string, string>,
  assign: (reference: string) => { assigneeId: string | null; status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NOT_APPLICABLE' },
) {
  const program = await ensure(prisma.auditProgram, { engagementId, title }, {
    tenantId,
    description: 'Instantiated from the BDO methodology library.',
    status,
    libraryItemId,
    approvedById,
    approvedAt: approvedAt ? d(approvedAt) : null,
  });
  const steps = new Map<string, string>();
  let sortOrder = 0;
  for (const section of sections) {
    for (const step of section.steps) {
      const a = assign(step.reference);
      const row = await prisma.auditProgramStep.upsert({
        where: { programId_reference: { programId: program.id, reference: step.reference } },
        update: {
          section: section.name,
          sortOrder,
          objective: step.objective,
          procedure: step.procedure,
          riskId: step.riskCode ? risks.get(step.riskCode) ?? null : null,
          controlId: step.controlCode ? controls.get(step.controlCode) ?? null : null,
          assigneeId: a.assigneeId,
          estimatedHours: step.estimatedHours,
          status: a.status,
        },
        create: {
          tenantId,
          programId: program.id,
          section: section.name,
          reference: step.reference,
          sortOrder,
          objective: step.objective,
          procedure: step.procedure,
          riskId: step.riskCode ? risks.get(step.riskCode) ?? null : null,
          controlId: step.controlCode ? controls.get(step.controlCode) ?? null : null,
          assigneeId: a.assigneeId,
          estimatedHours: step.estimatedHours,
          status: a.status,
        },
      });
      steps.set(step.reference, row.id);
      sortOrder++;
    }
  }
  return { program, steps };
}

interface WorkpaperSeed {
  reference: string;
  title: string;
  objective: string;
  template?: string;
  step?: string;
  risk?: string;
  control?: string;
  status: 'DRAFT' | 'PREPARED' | 'IN_REVIEW' | 'REVIEW_NOTES_OPEN' | 'REVIEWED' | 'SIGNED_OFF';
  preparedBy: UserHandle;
  preparedAt?: string;
  reviewedBy?: UserHandle;
  reviewedAt?: string;
  signedOffBy?: UserHandle;
  signedOffAt?: string;
  procedure?: string;
  testPerformed?: string;
  results?: string;
  exceptions?: string;
  conclusion?: string;
  content?: Record<string, unknown>;
  versions?: string[]; // change summaries for versions 2..n
}

async function seedWorkpapers(
  tenantId: string,
  engagementId: string,
  users: Users,
  templates: Map<string, string>,
  steps: Map<string, string>,
  risks: Map<string, string>,
  controls: Map<string, string>,
  rows: WorkpaperSeed[],
) {
  const out = new Map<string, string>();
  let sortOrder = 0;
  for (const w of rows) {
    const versions = 1 + (w.versions?.length ?? 0);
    const data = {
      tenantId,
      programStepId: w.step ? steps.get(w.step) ?? null : null,
      templateId: w.template ? templates.get(w.template) ?? null : null,
      title: w.title,
      objective: w.objective,
      riskId: w.risk ? risks.get(w.risk) ?? null : null,
      controlId: w.control ? controls.get(w.control) ?? null : null,
      procedure: w.procedure ?? null,
      testPerformed: w.testPerformed ?? null,
      results: w.results ?? null,
      exceptions: w.exceptions ?? null,
      conclusion: w.conclusion ?? null,
      content: (w.content ?? {}) as Prisma.InputJsonValue,
      status: w.status,
      currentVersion: versions,
      preparedById: users[w.preparedBy].id,
      preparedAt: w.preparedAt ? d(w.preparedAt) : null,
      reviewedById: w.reviewedBy ? users[w.reviewedBy].id : null,
      reviewedAt: w.reviewedAt ? d(w.reviewedAt) : null,
      signedOffById: w.signedOffBy ? users[w.signedOffBy].id : null,
      signedOffAt: w.signedOffAt ? d(w.signedOffAt) : null,
      isLocked: w.status === 'SIGNED_OFF',
      sortOrder: sortOrder++,
      deletedAt: null,
    };
    const row = await prisma.workpaper.upsert({
      where: { engagementId_reference: { engagementId, reference: w.reference } },
      update: data,
      create: { engagementId, reference: w.reference, ...data },
    });
    out.set(w.reference, row.id);

    const snapshotBase = { reference: w.reference, title: w.title, objective: w.objective, procedure: w.procedure ?? null, status: 'DRAFT' };
    const changes = ['Initial version', ...(w.versions ?? [])];
    for (let n = 1; n <= versions; n++) {
      const snapshot = n === versions
        ? { ...snapshotBase, testPerformed: w.testPerformed ?? null, results: w.results ?? null, conclusion: w.conclusion ?? null, status: w.status }
        : { ...snapshotBase, testPerformed: n > 1 ? w.testPerformed ?? null : null };
      await prisma.workpaperVersion.upsert({
        where: { workpaperId_versionNumber: { workpaperId: row.id, versionNumber: n } },
        update: { snapshot, changeSummary: changes[n - 1] },
        create: {
          tenantId,
          workpaperId: row.id,
          versionNumber: n,
          snapshot,
          changeSummary: changes[n - 1],
          changedById: users[w.preparedBy].id,
          createdAt: w.preparedAt ? new Date(d(w.preparedAt).getTime() - (versions - n) * 86_400_000) : new Date(),
        },
      });
    }
  }
  return out;
}

interface FindingSeed {
  reference: string;
  title: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'DRAFT' | 'MANAGEMENT_REVIEW' | 'AGREED' | 'IMPLEMENTATION' | 'VALIDATION' | 'CLOSED' | 'RISK_ACCEPTED';
  workpaper?: string;
  entity: string;
  process: string;
  risk?: string;
  control?: string;
  condition: string;
  criteria: string;
  cause: string;
  impact: string;
  recommendation: string;
  managementResponse?: string;
  rootCause: 'PEOPLE' | 'PROCESS' | 'TECHNOLOGY' | 'GOVERNANCE' | 'EXTERNAL' | 'DATA' | 'POLICY';
  category: string;
  actionOwner?: UserHandle;
  actionOwnerName?: string;
  actionOwnerEmail?: string;
  dueDate?: string;
  agreedAt?: string;
  implementedAt?: string;
  validatedBy?: UserHandle;
  validatedAt?: string;
  closedAt?: string;
  raisedBy: UserHandle;
  isRepeat?: boolean;
  repeatOfId?: string | null;
  createdAt: string;
  history: [string | null, string, string, UserHandle, string?][];
  recommendations: { text: string; priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'; status: 'PROPOSED' | 'AGREED' | 'IN_PROGRESS' | 'IMPLEMENTED' | 'VALIDATED' | 'NOT_IMPLEMENTED' | 'SUPERSEDED'; dueDate?: string; progressPct?: number; actionPlan?: string; completedAt?: string }[];
}

async function seedFindings(
  tenantId: string,
  engagementId: string,
  users: Users,
  entities: Map<string, string>,
  processes: Map<string, { id: string; entityId: string }>,
  risks: Map<string, string>,
  controls: Map<string, string>,
  workpapers: Map<string, string>,
  rows: FindingSeed[],
) {
  const out = new Map<string, string>();
  for (const f of rows) {
    const data = {
      tenantId,
      workpaperId: f.workpaper ? workpapers.get(f.workpaper) ?? null : null,
      entityId: entities.get(f.entity) ?? null,
      processId: processes.get(f.process)?.id ?? null,
      riskId: f.risk ? risks.get(f.risk) ?? null : null,
      controlId: f.control ? controls.get(f.control) ?? null : null,
      title: f.title,
      severity: f.severity,
      status: f.status,
      condition: f.condition,
      criteria: f.criteria,
      cause: f.cause,
      impact: f.impact,
      recommendation: f.recommendation,
      managementResponse: f.managementResponse ?? null,
      rootCauseCategory: f.rootCause,
      category: f.category,
      actionOwnerId: f.actionOwner ? users[f.actionOwner].id : null,
      actionOwnerName: f.actionOwnerName ?? (f.actionOwner ? users[f.actionOwner].displayName : null),
      actionOwnerEmail: f.actionOwnerEmail ?? (f.actionOwner ? users[f.actionOwner].email : null),
      dueDate: f.dueDate ? day(f.dueDate) : null,
      originalDueDate: f.dueDate ? day(f.dueDate) : null,
      agreedAt: f.agreedAt ? d(f.agreedAt) : null,
      implementedAt: f.implementedAt ? d(f.implementedAt) : null,
      validatedById: f.validatedBy ? users[f.validatedBy].id : null,
      validatedAt: f.validatedAt ? d(f.validatedAt) : null,
      closedAt: f.closedAt ? d(f.closedAt) : null,
      isRepeat: f.isRepeat ?? false,
      repeatOfId: f.repeatOfId ?? null,
      raisedById: users[f.raisedBy].id,
      deletedAt: null,
    };
    const row = await prisma.finding.upsert({
      where: { engagementId_reference: { engagementId, reference: f.reference } },
      update: data,
      create: { engagementId, reference: f.reference, createdAt: d(f.createdAt), ...data },
    });
    out.set(f.reference, row.id);

    for (const [fromStatus, toStatus, at, by, comment] of f.history) {
      await ensure(prisma.findingStatusHistory, { findingId: row.id, toStatus }, {
        tenantId,
        fromStatus,
        changedById: users[by].id,
        comment: comment ?? null,
        changedAt: d(at),
      });
    }
    let sequence = 1;
    for (const r of f.recommendations) {
      await ensure(prisma.recommendation, { findingId: row.id, sequence }, {
        tenantId,
        text: r.text,
        priority: r.priority,
        ownerId: f.actionOwner ? users[f.actionOwner].id : null,
        ownerName: f.actionOwnerName ?? (f.actionOwner ? users[f.actionOwner].displayName : null),
        dueDate: r.dueDate ? day(r.dueDate) : f.dueDate ? day(f.dueDate) : null,
        status: r.status,
        actionPlan: r.actionPlan ?? null,
        progressPct: r.progressPct ?? (r.status === 'VALIDATED' || r.status === 'IMPLEMENTED' ? 100 : 0),
        completedAt: r.completedAt ? d(r.completedAt) : null,
      });
      sequence++;
    }
  }
  return out;
}

const DEMO_ENGAGEMENT_PROGRAM: ProgramSectionSeed[] = [
  {
    name: 'Planning',
    steps: [
      {
        reference: 'P.1',
        objective: 'Confirm the engagement mandate, objectives, scope and stakeholder expectations.',
        procedure: 'Review the approved audit plan or request, hold the opening meeting, document scope boundaries and agree the reporting timetable with the engagement sponsor.',
        estimatedHours: 4,
      },
      {
        reference: 'P.2',
        objective: 'Obtain key policies, process maps and data populations.',
        procedure: 'Issue document requests for policies, process narratives, reconciliations, system extracts and prior audit actions. Reconcile the primary population before sampling.',
        estimatedHours: 5,
      },
    ],
  },
  {
    name: 'Risk assessment',
    steps: [
      {
        reference: 'RA.1',
        objective: 'Identify inherent risks, key controls and expected evidence.',
        procedure: 'Map the in-scope process to the enterprise risk register and control catalogue. Rate residual risk and agree the testing strategy with the audit manager.',
        estimatedHours: 5,
      },
      {
        reference: 'RA.2',
        objective: 'Tailor the audit programme to the assessed risks.',
        procedure: 'Select procedures for design evaluation, operating effectiveness testing, analytics and interviews. Assign owners and estimated hours to each step.',
        estimatedHours: 4,
      },
    ],
  },
  {
    name: 'Fieldwork',
    steps: [
      {
        reference: 'B.1',
        objective: 'Evaluate control design and implementation.',
        procedure: 'Perform walkthroughs for the key control points and inspect evidence that controls are configured or performed as described.',
        estimatedHours: 8,
      },
      {
        reference: 'B.2',
        objective: 'Test operating effectiveness over the audit period.',
        procedure: 'Select a risk-based sample, test against the control criteria, record exceptions and quantify impact using available transaction data.',
        estimatedHours: 12,
      },
      {
        reference: 'B.3',
        objective: 'Perform targeted data analytics.',
        procedure: 'Run exception analytics over the reconciled population, investigate outliers with the process owner and link results to findings or control conclusions.',
        estimatedHours: 8,
      },
    ],
  },
  {
    name: 'Reporting',
    steps: [
      {
        reference: 'R.1',
        objective: 'Conclude, agree actions and prepare the report.',
        procedure: 'Validate facts, rate findings, agree action owners and target dates, then draft the executive summary and detailed finding register.',
        estimatedHours: 7,
      },
    ],
  },
];

type EngagementMemberSeed = [UserHandle, 'PARTNER' | 'MANAGER' | 'LEAD' | 'SENIOR' | 'JUNIOR' | 'REVIEWER' | 'SPECIALIST' | 'OBSERVER', number];
type EngagementMilestoneSeed = [string, string | null, string, string | null];
type EngagementStageHistorySeed = [string | null, string, string, string?];
type ProgramStatusSeed = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED';

interface PortfolioEngagementSeed {
  auditNumber: string;
  title: string;
  type: 'OPERATIONAL' | 'FINANCIAL' | 'COMPLIANCE' | 'IT' | 'INVESTIGATION' | 'ADVISORY' | 'FOLLOW_UP' | 'INTEGRATED';
  entity: string;
  objectives: string;
  scope: string;
  outOfScope?: string;
  background: string;
  periodStart: string;
  periodEnd: string;
  stage: string;
  status: 'ACTIVE' | 'ON_HOLD' | 'CANCELLED' | 'COMPLETED';
  riskRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  plannedStart: string;
  plannedEnd: string;
  actualStart?: string;
  actualEnd?: string;
  reportIssuedAt?: string;
  budgetHours: number;
  budgetAmount: number;
  lead: UserHandle;
  manager: UserHandle;
  partner: UserHandle;
  opinion: 'SATISFACTORY' | 'NEEDS_IMPROVEMENT' | 'UNSATISFACTORY' | 'NOT_RATED';
  executiveSummary?: string;
  members: EngagementMemberSeed[];
  stakeholders: { name: string; email: string; title: string; organisation: string; role: string; isPrimary?: boolean }[];
  milestones: EngagementMilestoneSeed[];
  history: EngagementStageHistorySeed[];
  programTitle: string;
  programStatus: ProgramStatusSeed;
  approvedBy?: UserHandle;
  approvedAt?: string;
  completedSteps: string[];
  inProgressSteps?: string[];
  findings?: FindingSeed[];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const started = Date.now();
  console.log('Seeding BDO AuditSphere ...');

  const permissions = await seedPermissions();
  const tenant = await seedTenant();
  const tenantId = tenant.id;
  const roles = await seedRoles(tenantId, permissions);
  const users = await seedUsers(tenantId, roles);
  const refIds = await seedFrameworks();
  const templates = await seedWorkpaperTemplates();
  const { categories, model } = await seedRiskConfig(tenantId);
  const chargeCodes = await seedChargeCodes(tenantId);
  const { entities, processes } = await seedUniverse(tenantId, users);
  const { risks, controls } = await seedRisksAndControls(tenantId, users, categories, processes, model.id);
  const library = await seedLibrary(tenantId, users, refIds);
  const { plan, planItems } = await seedPlan(tenantId, users, entities);

  // ---------------------------------------------------------------- IA-2025-014 (closed)
  const payroll = await upsertEngagement(tenantId, 'IA-2025-014', {
    title: 'Payroll process review',
    type: 'OPERATIONAL',
    entityId: entities.get('BH-SS-HR'),
    objectives: 'Assess the design and operating effectiveness of controls over payroll master data, calculation, disbursement and statutory compliance for FY2025.',
    scope: 'Kenya payroll for all permanent and contract staff, July 2024 to June 2025, including HR master data, monthly payroll runs, bank disbursement files and statutory remittances (PAYE, NSSF, SHIF, housing levy).',
    outOfScope: 'Uganda and Tanzania payrolls; executive remuneration policy.',
    background: 'Payroll is processed monthly in the ERP payroll module fed from the HR system. Monthly gross payroll is approximately KES 310m for 2,450 staff.',
    periodStart: day('2024-07-01'),
    periodEnd: day('2025-06-30'),
    stage: 'CLOSED',
    status: 'COMPLETED',
    riskRating: 'HIGH',
    plannedStart: day('2025-08-04'),
    plannedEnd: day('2025-10-03'),
    actualStart: d('2025-08-04'),
    actualEnd: d('2026-03-31'),
    budgetHours: 240,
    budgetAmount: 2880000,
    leadId: users.senior.id,
    managerId: users.manager.id,
    partnerId: users.partner.id,
    opinion: 'NEEDS_IMPROVEMENT',
    executiveSummary:
      'Payroll controls are broadly designed appropriately but two high-rated weaknesses were identified: the monthly headcount reconciliation was not performed for five months, and ERP roles allowed three users to both create and approve master data changes. Management agreed all four findings; remediation was validated in March 2026.',
    reportIssuedAt: d('2025-10-20'),
    metadata: { reportReference: 'BH/IA/2025/014' },
    deletedAt: null,
  });
  await addMembers(tenantId, payroll.id, users, [
    ['partner', 'PARTNER', 8],
    ['manager', 'MANAGER', 32],
    ['senior', 'LEAD', 100],
    ['junior', 'JUNIOR', 100],
  ]);
  await ensure(prisma.engagementStakeholder, { engagementId: payroll.id, name: 'Jane Mwikali' }, {
    tenantId, email: 'jane.mwikali@barakaholdings.example', title: 'Head of Human Resources', organisation: 'Baraka Holdings', role: 'Process Owner', isPrimary: true,
  });
  await ensure(prisma.engagementStakeholder, { engagementId: payroll.id, name: users.reviewer.displayName }, {
    tenantId, userId: users.reviewer.id, email: users.reviewer.email, title: 'Chief Financial Officer', organisation: 'Baraka Holdings', role: 'Sponsor', isPrimary: false,
  });
  await addMilestones(tenantId, payroll.id, [
    ['Planning memorandum approved', 'PLANNING', '2025-08-08', '2025-08-07'],
    ['Programme approved', 'PROGRAMME', '2025-08-15', '2025-08-14'],
    ['Fieldwork complete', 'FIELDWORK', '2025-09-19', '2025-09-22'],
    ['Draft report issued', 'REPORTING', '2025-10-03', '2025-10-06'],
    ['Final report issued', 'REPORTING', '2025-10-17', '2025-10-20'],
    ['Follow-up validation complete', 'FOLLOW_UP', '2026-03-31', '2026-03-27'],
  ]);
  await addStageHistory(tenantId, payroll.id, users.manager.id, [
    [null, 'PLANNING', '2025-08-04', 'Engagement created from plan item.'],
    ['PLANNING', 'RISK_ASSESSMENT', '2025-08-07'],
    ['RISK_ASSESSMENT', 'PROGRAMME', '2025-08-11'],
    ['PROGRAMME', 'FIELDWORK', '2025-08-14', 'Programme approved.'],
    ['FIELDWORK', 'REVIEW', '2025-09-22'],
    ['REVIEW', 'REPORTING', '2025-09-30', 'All workpapers signed off.'],
    ['REPORTING', 'FOLLOW_UP', '2025-10-20', 'Final report BH/IA/2025/014 issued to the Audit Committee.'],
    ['FOLLOW_UP', 'CLOSED', '2026-03-31', 'All findings validated and closed.'],
  ]);
  const payrollProgram = await instantiateProgram(
    tenantId, payroll.id, 'Payroll audit programme', PROGRAM_PAYROLL, library.get('LIB-AP-PAY')!, 'COMPLETED', users.manager.id, '2025-08-14', risks, controls,
    (ref) => ({ assigneeId: ref.startsWith('P') || ref.startsWith('R') ? users.senior.id : users.junior.id, status: 'COMPLETED' }),
  );
  const payrollWps = await seedWorkpapers(tenantId, payroll.id, users, templates, payrollProgram.steps, risks, controls, [
    {
      reference: 'B.1.1', title: 'Payroll process walkthrough', objective: 'Confirm understanding of the payroll process and identify key controls.', template: 'Walkthrough', step: 'P.1',
      status: 'SIGNED_OFF', preparedBy: 'junior', preparedAt: '2025-08-20', reviewedBy: 'senior', reviewedAt: '2025-08-22', signedOffBy: 'manager', signedOffAt: '2025-08-25',
      procedure: 'Walked through the July 2025 payroll from HR change forms to bank file.', results: 'Process operates as documented except that the headcount reconciliation is performed ad hoc.', conclusion: 'Understanding confirmed; C-009 flagged for testing.',
      content: { scope: 'July 2025 payroll cycle', participants: 'Jane Mwikali (Head of HR), Paul Kariuki (Payroll Officer)', narrative: 'Change forms are approved by the Head of HR, entered by the payroll officer, calculated in ERP, approved by the CFO and paid through the bank portal.', controls: 'C-008 master file approval; C-009 headcount reconciliation.', conclusion: 'Documented process reflects practice.' },
    },
    {
      reference: 'B.2.1', title: 'Payroll master file change test', objective: 'Test that master file changes were authorised.', template: 'Control test', step: 'B.1', risk: 'R-008', control: 'C-008',
      status: 'SIGNED_OFF', preparedBy: 'junior', preparedAt: '2025-09-05', reviewedBy: 'senior', reviewedAt: '2025-09-09', signedOffBy: 'manager', signedOffAt: '2025-09-12',
      procedure: 'Selected 25 master file changes from the ERP change log for the period.', testPerformed: 'Agreed each change to an approved HR form and checked reviewer independence.', results: '22 of 25 changes supported; 3 salary changes were entered and approved by the same user.', exceptions: '3 exceptions relating to combined create/approve access.', conclusion: 'Control partially effective; see finding F-03.', versions: ['Added exception analysis after review'],
    },
    {
      reference: 'B.3.1', title: 'Headcount reconciliation and ghost employee analytics', objective: 'Detect ghost employees.', template: 'Analytical review', step: 'B.2', risk: 'R-007', control: 'C-009',
      status: 'SIGNED_OFF', preparedBy: 'senior', preparedAt: '2025-09-15', reviewedBy: 'manager', reviewedAt: '2025-09-18', signedOffBy: 'manager', signedOffAt: '2025-09-19',
      procedure: 'Reconciled payroll headcount to HR by cost centre; ran duplicate bank account and identity tests.', results: 'Reconciliation not performed for 5 of 12 months. No ghost employees identified; two duplicate bank accounts explained (spouses).', conclusion: 'Detective control not operating; no loss identified. Finding F-01.',
    },
  ]);
  const payrollFindings = await seedFindings(tenantId, payroll.id, users, entities, processes, risks, controls, payrollWps, [
    {
      reference: 'F-01', title: 'Monthly payroll headcount reconciliation not performed', severity: 'HIGH', status: 'CLOSED', workpaper: 'B.3.1', entity: 'BH-SS-HR', process: 'PRC-PAY', risk: 'R-007', control: 'C-009',
      condition: 'The reconciliation of payroll headcount to the HR system was not performed for five of the twelve months in the period (August, October, December 2024 and February, May 2025).',
      criteria: 'Finance Procedure FP-07 requires a monthly headcount and cost reconciliation reviewed by the Financial Controller before payroll approval.',
      cause: 'The reconciliation depends on one officer and was not performed during leave periods; no compensating review exists.',
      impact: 'Ghost employees or duplicated payments could remain undetected for several months. No loss was identified by audit analytics.',
      recommendation: 'Automate the headcount reconciliation in the ERP payroll module and include it as a mandatory step in the payroll approval checklist.',
      managementResponse: 'Agreed. The reconciliation has been automated in the ERP and added to the CFO approval checklist from November 2025.',
      rootCause: 'PROCESS', category: 'Detective controls', actionOwnerName: 'Jane Mwikali', actionOwnerEmail: 'jane.mwikali@barakaholdings.example', dueDate: '2025-12-31', agreedAt: '2025-10-10', implementedAt: '2025-12-05', validatedBy: 'manager', validatedAt: '2026-03-20', closedAt: '2026-03-20', raisedBy: 'senior', createdAt: '2025-09-16',
      history: [[null, 'DRAFT', '2025-09-16', 'senior'], ['DRAFT', 'MANAGEMENT_REVIEW', '2025-09-24', 'senior'], ['MANAGEMENT_REVIEW', 'AGREED', '2025-10-10', 'reviewer', 'Agreed with action plan.'], ['AGREED', 'IMPLEMENTATION', '2025-10-21', 'reviewer'], ['IMPLEMENTATION', 'VALIDATION', '2025-12-08', 'reviewer', 'Automated reconciliation live.'], ['VALIDATION', 'CLOSED', '2026-03-20', 'manager', 'Validated three months of reconciliations.']],
      recommendations: [{ text: 'Automate the headcount reconciliation in the ERP payroll module.', priority: 'HIGH', status: 'VALIDATED', completedAt: '2025-12-05', actionPlan: 'ERP report configured and scheduled monthly.' }, { text: 'Add the reconciliation to the CFO payroll approval checklist.', priority: 'MEDIUM', status: 'VALIDATED', completedAt: '2025-11-28' }],
    },
    {
      reference: 'F-02', title: 'Overtime claims approved after payment', severity: 'MEDIUM', status: 'CLOSED', workpaper: 'B.2.1', entity: 'BH-SS-HR', process: 'PRC-PAY', risk: 'R-008', control: 'C-008',
      condition: 'For 6 of 25 overtime claims tested, line manager approval was dated after the payroll run in which the overtime was paid.',
      criteria: 'The Overtime Policy requires approval before submission to payroll.',
      cause: 'Overtime is captured in spreadsheets and approvals are collected retrospectively to meet the payroll cut-off.',
      impact: 'Unapproved or inflated overtime may be paid; total overtime paid in the period was KES 41m.',
      recommendation: 'Capture overtime in the HR self-service module with workflow approval before the payroll cut-off.',
      managementResponse: 'Agreed. The HR self-service overtime module went live in January 2026.',
      rootCause: 'TECHNOLOGY', category: 'Authorisation', actionOwnerName: 'Jane Mwikali', actionOwnerEmail: 'jane.mwikali@barakaholdings.example', dueDate: '2026-01-31', agreedAt: '2025-10-10', implementedAt: '2026-01-15', validatedBy: 'manager', validatedAt: '2026-03-25', closedAt: '2026-03-25', raisedBy: 'junior', createdAt: '2025-09-12',
      history: [[null, 'DRAFT', '2025-09-12', 'junior'], ['DRAFT', 'MANAGEMENT_REVIEW', '2025-09-24', 'senior'], ['MANAGEMENT_REVIEW', 'AGREED', '2025-10-10', 'reviewer'], ['AGREED', 'IMPLEMENTATION', '2025-10-21', 'reviewer'], ['IMPLEMENTATION', 'VALIDATION', '2026-01-20', 'reviewer'], ['VALIDATION', 'CLOSED', '2026-03-25', 'manager']],
      recommendations: [{ text: 'Implement workflow-approved overtime capture in HR self-service.', priority: 'MEDIUM', status: 'VALIDATED', completedAt: '2026-01-15' }],
    },
    {
      reference: 'F-03', title: 'Segregation of duties over ERP master data maintenance', severity: 'HIGH', status: 'CLOSED', workpaper: 'B.2.1', entity: 'BH-SS-HR', process: 'PRC-PAY', risk: 'R-008', control: 'C-008',
      condition: 'Three users held the ERP role HR_MASTER_FULL which permits both creation and approval of employee master data changes; three salary changes in the sample were created and approved by the same user.',
      criteria: 'Finance Policy s.4.2 requires master data changes to be created and approved by different individuals.',
      cause: 'The combined role was created during the ERP implementation for the project team and was never removed.',
      impact: 'Fictitious employees or unauthorised salary increases could be processed without detection.',
      recommendation: 'Remove the combined role, split into request and approve roles, and introduce a monthly independent review of master data changes.',
      managementResponse: 'Agreed. Combined role removed in November 2025; monthly review introduced from December 2025.',
      rootCause: 'TECHNOLOGY', category: 'Segregation of duties', actionOwner: 'reviewer', dueDate: '2025-12-31', agreedAt: '2025-10-10', implementedAt: '2025-12-02', validatedBy: 'manager', validatedAt: '2026-03-27', closedAt: '2026-03-27', raisedBy: 'senior', createdAt: '2025-09-10',
      history: [[null, 'DRAFT', '2025-09-10', 'senior'], ['DRAFT', 'MANAGEMENT_REVIEW', '2025-09-24', 'senior'], ['MANAGEMENT_REVIEW', 'AGREED', '2025-10-10', 'reviewer'], ['AGREED', 'IMPLEMENTATION', '2025-10-21', 'reviewer'], ['IMPLEMENTATION', 'VALIDATION', '2025-12-04', 'reviewer'], ['VALIDATION', 'CLOSED', '2026-03-27', 'manager', 'Role removed; review evidenced for Dec 2025 to Feb 2026. Note: the same role design weakness has since been identified for vendor master data (IA-2026-001 F-03).']],
      recommendations: [{ text: 'Remove HR_MASTER_FULL from all users and split into request and approve roles.', priority: 'HIGH', status: 'VALIDATED', completedAt: '2025-11-21' }, { text: 'Introduce a monthly independent review of the employee master data change log.', priority: 'HIGH', status: 'VALIDATED', completedAt: '2025-12-02' }],
    },
    {
      reference: 'F-04', title: 'Statutory deductions remitted after the deadline', severity: 'MEDIUM', status: 'CLOSED', workpaper: 'B.1.1', entity: 'BH-SS-HR', process: 'PRC-PAY', risk: 'R-019', control: 'C-021',
      condition: 'Housing levy remittances for three months were paid between 4 and 11 days after the statutory deadline, attracting penalties of KES 612,000.',
      criteria: 'The Affordable Housing Act requires remittance by the ninth working day of the following month.',
      cause: 'The new levy was not added to the tax compliance calendar when introduced.',
      impact: 'Penalties and interest; reputational exposure with the Kenya Revenue Authority.',
      recommendation: 'Update the tax compliance calendar for all statutory payroll deductions and assign a second-person reviewer.',
      managementResponse: 'Agreed. Calendar updated in October 2025; penalties paid and waiver application lodged.',
      rootCause: 'PROCESS', category: 'Compliance', actionOwner: 'reviewer', dueDate: '2025-11-30', agreedAt: '2025-10-10', implementedAt: '2025-10-28', validatedBy: 'manager', validatedAt: '2026-03-13', closedAt: '2026-03-13', raisedBy: 'junior', createdAt: '2025-09-18',
      history: [[null, 'DRAFT', '2025-09-18', 'junior'], ['DRAFT', 'MANAGEMENT_REVIEW', '2025-09-24', 'senior'], ['MANAGEMENT_REVIEW', 'AGREED', '2025-10-10', 'reviewer'], ['AGREED', 'IMPLEMENTATION', '2025-10-21', 'reviewer'], ['IMPLEMENTATION', 'VALIDATION', '2025-11-03', 'reviewer'], ['VALIDATION', 'CLOSED', '2026-03-13', 'manager']],
      recommendations: [{ text: 'Update the tax compliance calendar for all payroll statutory deductions.', priority: 'MEDIUM', status: 'VALIDATED', completedAt: '2025-10-28' }],
    },
  ]);
  await ensure(prisma.controlTest, { controlId: controls.get('C-008')!, engagementId: payroll.id, testType: 'OPERATING' }, {
    tenantId, workpaperId: payrollWps.get('B.2.1'), periodStart: day('2024-07-01'), periodEnd: day('2025-06-30'), populationSize: 412, sampleSize: 25, exceptions: 3, result: 'PASS_WITH_EXCEPTIONS',
    procedure: 'Agreed 25 master file changes to approved HR documentation and confirmed reviewer independence.', conclusion: 'Three changes created and approved by the same user; control partially effective.', remediation: 'Combined ERP role removed; monthly review introduced.', testedById: users.junior.id, testedAt: d('2025-09-05'),
  });
  await ensure(prisma.controlTest, { controlId: controls.get('C-009')!, engagementId: payroll.id, testType: 'OPERATING' }, {
    tenantId, workpaperId: payrollWps.get('B.3.1'), periodStart: day('2024-07-01'), periodEnd: day('2025-06-30'), populationSize: 12, sampleSize: 12, exceptions: 5, result: 'FAIL',
    procedure: 'Inspected evidence of the monthly headcount reconciliation for all twelve months.', conclusion: 'Not performed for five months; control ineffective.', testedById: users.senior.id, testedAt: d('2025-09-15'),
  });

  // ---------------------------------------------------------------- IA-2026-001 (fieldwork)
  const p2p = await upsertEngagement(tenantId, 'IA-2026-001', {
    title: 'Procure-to-pay process review',
    type: 'OPERATIONAL',
    entityId: entities.get('BH-SS-PRC'),
    objectives: 'Evaluate the adequacy and effectiveness of controls over requisitioning, purchase order approval, receiving, invoice processing, vendor master data maintenance and payment for the year to 30 June 2026.',
    scope: 'All purchase transactions processed through the ERP for Baraka Kenya and Shared Services between 1 July 2025 and 30 June 2026 (approximately 12,400 invoices, KES 4.1bn). Includes vendor onboarding and master data changes in the same period.',
    outOfScope: 'Capital projects above KES 100m governed by the Board Tender Committee; Uganda and Tanzania procurement.',
    background: 'Procurement was last audited in 2023. Since then the ERP was upgraded to Dynamics 365 Finance and the three-way match was configured as automated. The January 2026 risk assessment rated three procurement fraud risks above appetite.',
    periodStart: day('2025-07-01'),
    periodEnd: day('2026-06-30'),
    stage: 'FIELDWORK',
    status: 'ACTIVE',
    riskRating: 'HIGH',
    plannedStart: day('2026-07-13'),
    plannedEnd: day('2026-09-30'),
    actualStart: d('2026-07-15'),
    budgetHours: 320,
    budgetAmount: 3840000,
    leadId: users.senior.id,
    managerId: users.manager.id,
    partnerId: users.partner.id,
    opinion: 'NOT_RATED',
    metadata: { planItemKey: 'P2P' },
    deletedAt: null,
  });
  await addMembers(tenantId, p2p.id, users, [
    ['partner', 'PARTNER', 16],
    ['manager', 'MANAGER', 40],
    ['senior', 'LEAD', 120],
    ['junior', 'JUNIOR', 130],
    ['cae', 'REVIEWER', 8],
  ]);
  await ensure(prisma.engagementStakeholder, { engagementId: p2p.id, name: users.owner.displayName }, {
    tenantId, userId: users.owner.id, email: users.owner.email, title: 'Head of Procurement', organisation: 'Baraka Holdings', role: 'Process Owner', isPrimary: true,
  });
  await ensure(prisma.engagementStakeholder, { engagementId: p2p.id, name: users.reviewer.displayName }, {
    tenantId, userId: users.reviewer.id, email: users.reviewer.email, title: 'Chief Financial Officer', organisation: 'Baraka Holdings', role: 'Sponsor', isPrimary: false,
  });
  await ensure(prisma.engagementStakeholder, { engagementId: p2p.id, name: 'Mercy Wambui' }, {
    tenantId, email: 'mercy.wambui@barakaholdings.example', title: 'Head of Accounts Payable', organisation: 'Baraka Holdings', role: 'Auditee', isPrimary: false,
  });
  await ensure(prisma.engagementStakeholder, { engagementId: p2p.id, name: 'James Mutua' }, {
    tenantId, email: 'james.mutua@barakaholdings.example', title: 'ERP Administrator', organisation: 'Baraka Holdings', role: 'Contact', isPrimary: false,
  });
  await addMilestones(tenantId, p2p.id, [
    ['Planning memorandum approved', 'PLANNING', '2026-07-17', '2026-07-17'],
    ['Risk assessment complete', 'RISK_ASSESSMENT', '2026-07-24', '2026-07-24'],
    ['Programme approved', 'PROGRAMME', '2026-07-31', '2026-08-01'],
    ['Fieldwork complete', 'FIELDWORK', '2026-09-11', null],
    ['Closing meeting', 'REVIEW', '2026-09-18', null],
    ['Draft report issued', 'REPORTING', '2026-09-30', null],
    ['Final report issued', 'REPORTING', '2026-10-16', null],
  ]);
  await addStageHistory(tenantId, p2p.id, users.manager.id, [
    [null, 'PLANNING', '2026-07-15', 'Engagement created from FY2026 plan item.'],
    ['PLANNING', 'RISK_ASSESSMENT', '2026-07-20', 'Planning memorandum approved by the manager.'],
    ['RISK_ASSESSMENT', 'PROGRAMME', '2026-07-27'],
    ['PROGRAMME', 'FIELDWORK', '2026-08-03', 'Programme approved; fieldwork started with opening meeting on 4 August.'],
  ]);
  const p2pProgram = await instantiateProgram(
    tenantId, p2p.id, 'Procure-to-pay audit programme', PROGRAM_P2P, library.get('LIB-AP-P2P')!, 'APPROVED', users.manager.id, '2026-08-01', risks, controls,
    (ref) => {
      const map: Record<string, ['senior' | 'junior', 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED']> = {
        'P.1': ['senior', 'COMPLETED'], 'P.2': ['senior', 'COMPLETED'], 'P.3': ['junior', 'COMPLETED'],
        'B.1': ['junior', 'COMPLETED'], 'B.2': ['junior', 'IN_PROGRESS'], 'B.3': ['junior', 'COMPLETED'],
        'B.4': ['senior', 'IN_PROGRESS'], 'B.5': ['junior', 'COMPLETED'], 'R.1': ['senior', 'NOT_STARTED'],
      };
      const [who, status] = map[ref] ?? ['senior', 'NOT_STARTED'];
      return { assigneeId: users[who].id, status };
    },
  );
  await ensure(prisma.approval, { targetType: 'AuditProgram', targetId: p2pProgram.program.id, approverId: users.manager.id }, {
    tenantId, step: 1, status: 'APPROVED', comment: 'Programme aligned to risk assessment; approved.', requestedAt: d('2026-07-30'), decidedAt: d('2026-08-01'),
  });
  await ensure(prisma.approval, { targetType: 'AuditPlan', targetId: plan.id, approverId: users.partner.id }, {
    tenantId, step: 1, status: 'APPROVED', comment: 'Approved for presentation to the Audit Committee.', requestedAt: d('2025-12-05'), decidedAt: d('2025-12-10'),
  });

  const p2pWps = await seedWorkpapers(tenantId, p2p.id, users, templates, p2pProgram.steps, risks, controls, [
    {
      reference: 'B.1.1', title: 'Walkthrough of purchase requisition to payment', objective: 'Confirm the documented procure-to-pay process reflects practice and identify key controls.', template: 'Walkthrough', step: 'B.1', risk: 'R-002', control: 'C-002',
      status: 'SIGNED_OFF', preparedBy: 'junior', preparedAt: '2026-08-07', reviewedBy: 'senior', reviewedAt: '2026-08-10', signedOffBy: 'manager', signedOffAt: '2026-08-12',
      procedure: 'Traced PO-2026-04471 (office fit-out, KES 2.3m) from requisition through approval, goods receipt, invoice matching and payment.', testPerformed: 'Interviewed Procurement Officer, AP supervisor and ERP administrator; inspected workflow history in ERP.', results: 'Process operates as documented. Emergency purchases bypass PO workflow and are regularised after the event.', conclusion: 'Understanding confirmed. Emergency purchase route lacks a preventive control; considered in B.1 testing.', versions: ['Incorporated review comments on control identification'],
      content: { scope: 'Requisition to payment, one transaction', participants: 'Samuel Otieno (Head of Procurement), Mercy Wambui (Head of AP), James Mutua (ERP Administrator)', narrative: 'Requisition raised in ERP by the requesting department, approved per DoA, converted to PO by Procurement, goods received against the PO, invoice matched automatically and paid in the weekly run.', controls: 'C-002 PO approval workflow; C-001 three-way match; C-003 duplicate report.', gaps: 'Emergency purchases raised by email and regularised later.', conclusion: 'Documented process reflects practice.' },
    },
    {
      reference: 'B.2.1', title: 'Three-way match operating effectiveness test', objective: 'Confirm the ERP three-way match operated throughout the period.', template: 'Control test', step: 'B.3', risk: 'R-001', control: 'C-001',
      status: 'REVIEWED', preparedBy: 'junior', preparedAt: '2026-08-21', reviewedBy: 'senior', reviewedAt: '2026-08-26',
      procedure: 'Selected 25 paid invoices at random from the reconciled population of 12,412.', testPerformed: 'For each invoice agreed quantity and price to the PO and GRN; inspected match log and override approvals.', results: '23 matched within tolerance. 2 invoices were posted with tolerance overrides approved by the AP supervisor rather than the Finance Manager.', exceptions: 'Two overrides approved below the required authority (KES 184,000 and KES 96,500).', conclusion: 'Control operating with exceptions; overrides escalated to finding evaluation.', versions: ['Added override approval analysis', 'Updated conclusion after senior review'],
      content: { objective: 'Operating effectiveness of C-001', population: '12,412 invoices reconciled to GL account 2100; random sample of 25', procedure: 'Three-way agreement and override inspection', results: '23 pass, 2 exceptions', exceptions: 'Overrides approved by AP supervisor', conclusion: 'Operating with exceptions' },
    },
    {
      reference: 'B.2.2', title: 'Duplicate payment analytics', objective: 'Identify duplicate or suspicious payments across the full population.', template: 'Analytical review', step: 'B.4', risk: 'R-001', control: 'C-003',
      status: 'IN_REVIEW', preparedBy: 'senior', preparedAt: '2026-08-28',
      procedure: 'Ran the BDO duplicate payment routine (LIB-TP-003) over 12,412 payments.', testPerformed: 'Exact and fuzzy duplicate tests, shared bank accounts, weekend postings, round sums.', results: '14 exact-duplicate hits: 11 explained as reversals, 3 confirmed duplicates totalling KES 1.27m (2 since recovered). Weekly duplicate report not reviewed for 4 of 12 weeks sampled.', conclusion: 'Detective control not operating consistently; see finding F-02.',
      content: { objective: 'Detect duplicate and suspicious payments', data: 'ERP payment journal 1 Jul 2025 to 30 Jun 2026, 12,412 rows, reconciled to bank statements', method: 'LIB-TP-003 routine in analytics workbook', results: '3 confirmed duplicates KES 1.27m', conclusion: 'Escalated to F-02' },
    },
    {
      reference: 'B.3.1', title: 'Vendor master change review test', objective: 'Confirm vendor master data changes were independently reviewed.', template: 'Control test', step: 'B.5', risk: 'R-003', control: 'C-004',
      status: 'REVIEW_NOTES_OPEN', preparedBy: 'junior', preparedAt: '2026-08-31',
      procedure: 'Selected 25 vendor master changes (12 new vendors, 13 bank detail changes) from the change log.', testPerformed: 'Inspected supporting documents, call-back evidence and monthly review sign-off.', results: '8 bank detail changes had no call-back evidence; the monthly review was not evidenced for 5 of 12 months. Two users hold the combined VENDOR_MASTER_FULL role.', exceptions: '8 call-back exceptions; 5 months without review.', conclusion: 'Control ineffective; finding F-03 (repeat of IA-2025-014 F-03 root cause).',
      content: { objective: 'Operating effectiveness of C-004', population: '318 changes; 25 sampled', procedure: 'Document, call-back and review inspection', results: '8 exceptions', exceptions: 'No call-back for bank changes', conclusion: 'Ineffective' },
    },
    {
      reference: 'B.4.1', title: 'Interview: Head of Accounts Payable', objective: 'Understand invoice processing, duplicate report review and override practice.', template: 'Interview notes', step: 'P.1',
      status: 'PREPARED', preparedBy: 'junior', preparedAt: '2026-09-01',
      procedure: 'Interview held 1 September 2026 with Mercy Wambui.', results: 'AP supervisor approves tolerance overrides below KES 250,000 based on an unwritten practice; the duplicate report is reviewed when time allows during month-end.', conclusion: 'Corroborates B.2.1 and B.2.2 observations.',
      content: { interviewee: 'Mercy Wambui, Head of Accounts Payable, 1 September 2026', purpose: 'Invoice processing and exception handling', notes: 'Override practice; duplicate report review timing; staffing constraints in AP.', followups: 'Request written override policy if any; obtain AP staffing history.', confirmation: 'Notes sent for confirmation on 2 September 2026.' },
    },
    {
      reference: 'C.1', title: 'Procurement segregation of duties matrix', objective: 'Assess whether ERP roles in procurement and AP enforce segregation of duties.', template: 'Analytical review', step: 'B.2', risk: 'R-004', control: 'C-005',
      status: 'DRAFT', preparedBy: 'junior',
      procedure: 'Obtain ERP role assignments for Procurement and AP users and map to the BDO SoD conflict matrix.',
      content: { objective: 'Identify SoD conflicts in ERP roles', data: 'Pending ERP role extract (DR-002)' },
    },
  ]);

  // Review notes and reviews
  await ensure(prisma.reviewNote, { workpaperId: p2pWps.get('B.3.1')!, text: 'Quantify the value of the 8 bank detail changes without call-back and confirm whether any resulted in a payment to a changed account.' }, {
    tenantId, priority: 'HIGH', status: 'OPEN', raisedById: users.senior.id, assignedToId: users.junior.id, createdAt: d('2026-09-01'),
  });
  await ensure(prisma.reviewNote, { workpaperId: p2pWps.get('B.3.1')!, text: 'Reference the population reconciliation for the 318 changes.' }, {
    tenantId, priority: 'NORMAL', status: 'ADDRESSED', raisedById: users.senior.id, assignedToId: users.junior.id, response: 'Population reconciled to ERP audit log in E-005; reference added.', respondedAt: d('2026-09-02'), createdAt: d('2026-09-01'),
  });
  await ensure(prisma.reviewNote, { workpaperId: p2pWps.get('B.2.1')!, text: 'State the authority limit that applied to each override and who approved it.' }, {
    tenantId, priority: 'NORMAL', status: 'CLEARED', raisedById: users.senior.id, assignedToId: users.junior.id, response: 'Added override authority table to the exceptions section.', respondedAt: d('2026-08-25'), clearedById: users.senior.id, clearedAt: d('2026-08-26'), createdAt: d('2026-08-24'),
  });
  await ensure(prisma.review, { targetType: 'Workpaper', targetId: p2pWps.get('B.1.1')!, level: 'FIRST' }, {
    tenantId, reviewerId: users.senior.id, decision: 'APPROVED', comment: 'Walkthrough complete and controls identified.', decidedAt: d('2026-08-10'),
  });
  await ensure(prisma.review, { targetType: 'Workpaper', targetId: p2pWps.get('B.1.1')!, level: 'SECOND' }, {
    tenantId, reviewerId: users.manager.id, decision: 'APPROVED', comment: 'Signed off.', decidedAt: d('2026-08-12'),
  });
  await ensure(prisma.review, { targetType: 'Workpaper', targetId: p2pWps.get('B.2.1')!, level: 'FIRST' }, {
    tenantId, reviewerId: users.senior.id, decision: 'APPROVED', comment: 'Reviewed; exceptions carried to finding evaluation.', decidedAt: d('2026-08-26'),
  });

  // Document requests and documents
  const dr1 = await prisma.documentRequest.upsert({
    where: { engagementId_reference: { engagementId: p2p.id, reference: 'DR-001' } },
    update: { status: 'ACCEPTED' },
    create: {
      tenantId, engagementId: p2p.id, reference: 'DR-001', title: 'Vendor master change log and approved vendor list (Jul 2025 to Jun 2026)',
      description: 'Full ERP vendor master change log with user, timestamp and old/new values, plus the current approved vendor list.',
      requestedById: users.junior.id, assigneeId: users.owner.id, assigneeEmail: users.owner.email, dueDate: day('2026-08-14'), status: 'ACCEPTED',
      responseNote: 'Extract attached; generated by the ERP administrator on 12 August.', submittedAt: d('2026-08-12'), acceptedAt: d('2026-08-13'), createdAt: d('2026-08-05'),
    },
  });
  const dr2 = await prisma.documentRequest.upsert({
    where: { engagementId_reference: { engagementId: p2p.id, reference: 'DR-002' } },
    update: { status: 'SUBMITTED' },
    create: {
      tenantId, engagementId: p2p.id, reference: 'DR-002', title: 'ERP role assignments for Procurement and Accounts Payable users',
      description: 'User to role mapping for all users with procurement, vendor master or payment roles, with last logon dates.',
      requestedById: users.junior.id, assigneeId: users.owner.id, assigneeEmail: users.owner.email, dueDate: day('2026-09-04'), status: 'SUBMITTED',
      responseNote: 'Role extract attached. Note that the two VENDOR_MASTER_FULL assignments are being reviewed by IT.', submittedAt: d('2026-09-02'), createdAt: d('2026-08-26'),
    },
  });
  await prisma.documentRequest.upsert({
    where: { engagementId_reference: { engagementId: p2p.id, reference: 'DR-003' } },
    update: { status: 'OPEN', dueDate: daysFromNow(5) },
    create: {
      tenantId, engagementId: p2p.id, reference: 'DR-003', title: 'Signed delegation of authority matrix and emergency purchase approvals',
      description: 'Current DoA matrix as approved by the Board, and all emergency purchase approvals for the period.',
      requestedById: users.senior.id, assigneeId: users.owner.id, assigneeEmail: users.owner.email, dueDate: daysFromNow(5), status: 'OPEN', reminderCount: 1, lastReminderAt: daysFromNow(-2), createdAt: daysFromNow(-9),
    },
  });

  const docs: { key: string; fileName: string; mimeType: string; size: number; owner: string; ownerId: string; tags: string[]; uploadedBy: UserHandle; at: string }[] = [
    { key: 'vendor-master-change-log', fileName: 'Vendor_master_change_log_FY26.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 348_112, owner: 'DocumentRequest', ownerId: dr1.id, tags: ['vendor master', 'system extract'], uploadedBy: 'owner', at: '2026-08-12' },
    { key: 'approved-vendor-list', fileName: 'Approved_vendor_list_Aug2026.pdf', mimeType: 'application/pdf', size: 1_204_331, owner: 'DocumentRequest', ownerId: dr1.id, tags: ['vendor master'], uploadedBy: 'owner', at: '2026-08-12' },
    { key: 'erp-role-extract', fileName: 'ERP_role_assignments_Procurement_AP.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 96_440, owner: 'DocumentRequest', ownerId: dr2.id, tags: ['access', 'system extract'], uploadedBy: 'owner', at: '2026-09-02' },
    { key: 'payment-listing', fileName: 'AP_payment_journal_FY26.csv', mimeType: 'text/csv', size: 5_882_004, owner: 'Engagement', ownerId: p2p.id, tags: ['payments', 'analytics'], uploadedBy: 'senior', at: '2026-08-18' },
  ];
  const docIds = new Map<string, string>();
  for (const doc of docs) {
    const storageKey = `${tenantId}/engagements/${p2p.id}/${doc.key}/${doc.fileName}`;
    const row = await ensure(prisma.document, { tenantId, storageKey }, {
      ownerType: doc.owner,
      ownerId: doc.ownerId,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      sizeBytes: BigInt(doc.size),
      checksumSha256: null,
      classification: 'CONFIDENTIAL',
      currentVersion: 1,
      uploadedById: users[doc.uploadedBy].id,
      tags: doc.tags,
      uploadedAt: d(doc.at),
      deletedAt: null,
    });
    docIds.set(doc.key, row.id);
    await prisma.documentVersion.upsert({
      where: { documentId_versionNumber: { documentId: row.id, versionNumber: 1 } },
      update: {},
      create: { tenantId, documentId: row.id, versionNumber: 1, storageKey, sizeBytes: BigInt(doc.size), uploadedById: users[doc.uploadedBy].id, note: 'Initial upload', createdAt: d(doc.at) },
    });
  }
  await prisma.documentRequest.update({ where: { id: dr1.id }, data: { documents: { connect: [{ id: docIds.get('vendor-master-change-log')! }, { id: docIds.get('approved-vendor-list')! }] } } });
  await prisma.documentRequest.update({ where: { id: dr2.id }, data: { documents: { connect: [{ id: docIds.get('erp-role-extract')! }] } } });

  // Evidence
  const evidence: [string, string, string, string | undefined, string | undefined, 'DOCUMENT' | 'SCREENSHOT' | 'SYSTEM_EXTRACT' | 'INTERVIEW_NOTE' | 'OBSERVATION' | 'RECALCULATION' | 'CONFIRMATION' | 'EMAIL', string, UserHandle, string][] = [
    ['E-001', 'ERP workflow history for PO-2026-04471', 'B.1.1', undefined, undefined, 'SCREENSHOT', 'James Mutua (ERP Administrator)', 'junior', '2026-08-06'],
    ['E-002', 'AP payment journal FY2026, 12,412 rows reconciled to bank', 'B.2.2', 'payment-listing', undefined, 'SYSTEM_EXTRACT', 'Mercy Wambui (Head of AP)', 'senior', '2026-08-18'],
    ['E-003', 'Sample of 25 invoices with PO, GRN and match log', 'B.2.1', undefined, undefined, 'DOCUMENT', 'Accounts Payable', 'junior', '2026-08-20'],
    ['E-004', 'Tolerance override approvals (2 items)', 'B.2.1', undefined, undefined, 'EMAIL', 'Mercy Wambui (Head of AP)', 'junior', '2026-08-21'],
    ['E-005', 'Vendor master change log Jul 2025 to Jun 2026 (318 changes)', 'B.3.1', 'vendor-master-change-log', undefined, 'SYSTEM_EXTRACT', 'Samuel Otieno (Head of Procurement)', 'junior', '2026-08-13'],
    ['E-006', 'Interview notes confirmed by Head of AP', 'B.4.1', undefined, undefined, 'INTERVIEW_NOTE', 'Mercy Wambui (Head of AP)', 'junior', '2026-09-02'],
    ['E-007', 'ERP role assignment extract for Procurement and AP', 'C.1', 'erp-role-extract', undefined, 'SYSTEM_EXTRACT', 'James Mutua (ERP Administrator)', 'junior', '2026-09-02'],
  ];
  const evidenceIds = new Map<string, string>();
  for (const [reference, description, wp, docKey, , type, obtainedFrom, by, at] of evidence) {
    const row = await prisma.evidence.upsert({
      where: { engagementId_reference: { engagementId: p2p.id, reference } },
      update: { description, workpaperId: p2pWps.get(wp) ?? null, documentId: docKey ? docIds.get(docKey) ?? null : null, type, obtainedFrom, obtainedAt: d(at), isSufficient: true },
      create: { tenantId, engagementId: p2p.id, reference, description, workpaperId: p2pWps.get(wp) ?? null, documentId: docKey ? docIds.get(docKey) ?? null : null, type, obtainedFrom, obtainedAt: d(at), obtainedById: users[by].id, isSufficient: true },
    });
    evidenceIds.set(reference, row.id);
  }

  // Findings (F-03 repeats IA-2025-014 F-03)
  const p2pFindings = await seedFindings(tenantId, p2p.id, users, entities, processes, risks, controls, p2pWps, [
    {
      reference: 'F-01', title: 'Purchases committed before purchase order approval', severity: 'MEDIUM', status: 'DRAFT', workpaper: 'B.1.1', entity: 'BH-SS-PRC', process: 'PRC-P2P', risk: 'R-002', control: 'C-002',
      condition: 'Of 25 purchase orders tested, 6 were approved after the supplier invoice date and 2 had no purchase order; these "emergency" purchases totalled KES 3.9m and were regularised by email approval.',
      criteria: 'Procurement Policy s.5.1 requires an approved purchase order before goods or services are ordered, approved per the delegation of authority matrix.',
      cause: 'Urgent purchases are initiated by email; the ERP allows invoices to be posted against a PO created after the fact.',
      impact: 'Commitments may exceed budget and authority and the three-way match cannot operate as a preventive control for these transactions.',
      recommendation: 'Configure the ERP to reject invoices dated before PO approval, and introduce a documented emergency purchase procedure with CFO approval within 48 hours.',
      rootCause: 'PROCESS', category: 'Authorisation', raisedBy: 'junior', createdAt: '2026-08-14',
      history: [[null, 'DRAFT', '2026-08-14', 'junior']],
      recommendations: [{ text: 'Configure the ERP to reject vendor invoices dated before the purchase order approval date.', priority: 'HIGH', status: 'PROPOSED' }, { text: 'Publish an emergency purchase procedure requiring CFO approval within 48 hours.', priority: 'MEDIUM', status: 'PROPOSED' }],
    },
    {
      reference: 'F-02', title: 'Duplicate invoice report not reviewed and duplicate payments made', severity: 'HIGH', status: 'MANAGEMENT_REVIEW', workpaper: 'B.2.2', entity: 'BH-SS-PRC', process: 'PRC-P2P', risk: 'R-001', control: 'C-003',
      condition: 'The weekly duplicate invoice exception report was not evidenced as reviewed for 4 of 12 weeks sampled. Analytics over the full population identified 3 duplicate payments totalling KES 1.27m, of which KES 420,000 remains unrecovered.',
      criteria: 'AP Procedure AP-04 requires the duplicate invoice report to be reviewed and signed weekly by the AP supervisor; the three-way match does not detect re-submitted invoices with altered references.',
      cause: 'AP staffing was reduced from five to three in 2025 and the review is performed only at month end.',
      impact: 'Duplicate payments of KES 1.27m in the period; likelihood of undetected duplicates across the KES 4.1bn population.',
      recommendation: 'Enable automated duplicate invoice blocking in the ERP (fuzzy invoice number matching) and reinstate the weekly review with sign-off retained in the ERP.',
      rootCause: 'PEOPLE', category: 'Detective controls', actionOwner: 'owner', raisedBy: 'senior', createdAt: '2026-08-29',
      history: [[null, 'DRAFT', '2026-08-29', 'senior'], ['DRAFT', 'MANAGEMENT_REVIEW', '2026-09-01', 'senior', 'Submitted to the Head of Procurement for response.']],
      recommendations: [{ text: 'Enable automated duplicate invoice blocking in the ERP using fuzzy invoice number matching.', priority: 'HIGH', status: 'PROPOSED' }, { text: 'Reinstate the weekly duplicate report review with evidence retained in the ERP.', priority: 'HIGH', status: 'PROPOSED' }, { text: 'Recover the outstanding KES 420,000 from the vendor.', priority: 'MEDIUM', status: 'PROPOSED' }],
    },
    {
      reference: 'F-03', title: 'Vendor master data changes not independently reviewed (repeat)', severity: 'HIGH', status: 'AGREED', workpaper: 'B.3.1', entity: 'BH-SS-PRC', process: 'PRC-VND', risk: 'R-003', control: 'C-004',
      condition: '8 of 13 bank detail changes tested had no call-back verification, the monthly change log review was not evidenced for 5 of 12 months, and two users hold the VENDOR_MASTER_FULL role allowing them to create and approve changes. The same role design weakness was reported for employee master data in IA-2025-014 F-03.',
      criteria: 'Finance Policy s.4.2 requires master data changes to be created and approved by different individuals; Vendor Management Procedure VM-02 requires call-back verification of all bank detail changes.',
      cause: 'The ERP role redesign performed for HR master data in 2025 was not extended to vendor master data; call-backs depend on a single officer.',
      impact: 'Payment diversion through fraudulent bank detail changes; KES 61m was paid to vendors whose bank details changed without call-back in the period.',
      recommendation: 'Remove the combined role, split into request and approve roles, enforce call-back verification through the ERP workflow and reinstate the monthly review.',
      managementResponse: 'Agreed. IT will redesign the vendor master roles by 31 October 2026 and Finance will evidence the monthly review from September 2026. Call-backs for the 8 changes have been completed with no diversion identified.',
      rootCause: 'TECHNOLOGY', category: 'Segregation of duties', actionOwner: 'owner', dueDate: '2026-11-30', agreedAt: '2026-08-28', raisedBy: 'senior', isRepeat: true, repeatOfId: payrollFindings.get('F-03') ?? null, createdAt: '2026-08-20',
      history: [[null, 'DRAFT', '2026-08-20', 'senior'], ['DRAFT', 'MANAGEMENT_REVIEW', '2026-08-24', 'senior'], ['MANAGEMENT_REVIEW', 'AGREED', '2026-08-28', 'owner', 'Management response provided; action owner and due date set.']],
      recommendations: [{ text: 'Remove VENDOR_MASTER_FULL and split into request and approve roles.', priority: 'HIGH', status: 'AGREED', dueDate: '2026-10-31', actionPlan: 'IT change request CR-2026-311 raised.', progressPct: 20 }, { text: 'Enforce call-back verification of bank detail changes through ERP workflow.', priority: 'HIGH', status: 'AGREED', dueDate: '2026-11-30', progressPct: 0 }, { text: 'Reinstate the monthly independent review of the vendor master change log.', priority: 'MEDIUM', status: 'IN_PROGRESS', dueDate: '2026-09-30', progressPct: 50, actionPlan: 'August review completed and signed.' }],
    },
  ]);
  await prisma.finding.update({ where: { id: p2pFindings.get('F-02')! }, data: { evidence: { connect: [{ id: evidenceIds.get('E-002')! }] } } });
  await prisma.finding.update({ where: { id: p2pFindings.get('F-03')! }, data: { evidence: { connect: [{ id: evidenceIds.get('E-005')! }] } } });

  // Control tests for the P2P engagement, and update control effectiveness
  await ensure(prisma.controlTest, { controlId: controls.get('C-002')!, engagementId: p2p.id, testType: 'DESIGN' }, {
    tenantId, workpaperId: p2pWps.get('B.1.1'), periodStart: day('2025-07-01'), periodEnd: day('2026-06-30'), result: 'PASS',
    procedure: 'Walkthrough of the PO approval workflow and DoA configuration.', conclusion: 'Design appropriate for transactions routed through the workflow; emergency route noted.', testedById: users.junior.id, testedAt: d('2026-08-07'),
  });
  await ensure(prisma.controlTest, { controlId: controls.get('C-001')!, engagementId: p2p.id, testType: 'OPERATING' }, {
    tenantId, workpaperId: p2pWps.get('B.2.1'), periodStart: day('2025-07-01'), periodEnd: day('2026-06-30'), populationSize: 12412, sampleSize: 25, exceptions: 2, result: 'PASS_WITH_EXCEPTIONS',
    procedure: 'Sample of 25 paid invoices agreed to PO and GRN; override approvals inspected.', conclusion: 'Two overrides approved below authority.', testedById: users.junior.id, testedAt: d('2026-08-21'),
  });
  await ensure(prisma.controlTest, { controlId: controls.get('C-004')!, engagementId: p2p.id, testType: 'OPERATING' }, {
    tenantId, workpaperId: p2pWps.get('B.3.1'), periodStart: day('2025-07-01'), periodEnd: day('2026-06-30'), populationSize: 318, sampleSize: 25, exceptions: 8, result: 'FAIL',
    procedure: 'Sample of 25 vendor master changes inspected for call-back and review evidence.', conclusion: 'Control ineffective.', testedById: users.junior.id, testedAt: d('2026-08-31'),
  });
  await ensure(prisma.controlTest, { controlId: controls.get('C-010')!, engagementId: null, testType: 'OPERATING' }, {
    tenantId, periodStart: day('2026-01-01'), periodEnd: day('2026-06-30'), result: 'NOT_STARTED', procedure: 'Planned for IA-2026-002.', testedById: null,
  });
  const effectiveness: Record<string, ['EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE', boolean, boolean | null, string]> = {
    'C-001': ['PARTIALLY_EFFECTIVE', true, false, '2026-08-21'],
    'C-002': ['EFFECTIVE', true, null, '2026-08-07'],
    'C-004': ['INEFFECTIVE', false, false, '2026-08-31'],
    'C-008': ['PARTIALLY_EFFECTIVE', true, false, '2025-09-05'],
    'C-009': ['INEFFECTIVE', true, false, '2025-09-15'],
  };
  for (const [code, [eff, design, operating, at]] of Object.entries(effectiveness)) {
    await prisma.control.update({ where: { id: controls.get(code)! }, data: { effectiveness: eff, designEffective: design, operatingEffective: operating, lastTestedAt: d(at) } });
  }

  // ---------------------------------------------------------------- IA-2026-002 (planning)
  const uam = await upsertEngagement(tenantId, 'IA-2026-002', {
    title: 'User access management review',
    type: 'IT',
    entityId: entities.get('BH-SS-IT'),
    objectives: 'Assess joiner, mover, leaver and privileged access controls over the core banking system, ERP and Active Directory.',
    scope: 'Access provisioning and deprovisioning events from 1 January to 30 September 2026; privileged and generic accounts as at 30 September 2026; authentication configuration.',
    outOfScope: 'Network device administration; physical access.',
    background: 'The CBK inspection report of May 2026 raised privileged access recertification on Finacle. The January 2026 risk assessment rated R-009 and R-010 above appetite.',
    periodStart: day('2026-01-01'),
    periodEnd: day('2026-09-30'),
    stage: 'PLANNING',
    status: 'ACTIVE',
    riskRating: 'CRITICAL',
    plannedStart: day('2026-09-14'),
    plannedEnd: day('2026-11-13'),
    budgetHours: 280,
    budgetAmount: 3360000,
    leadId: users.senior.id,
    managerId: users.manager.id,
    partnerId: users.partner.id,
    opinion: 'NOT_RATED',
    metadata: { planItemKey: 'UAM' },
    deletedAt: null,
  });
  await addMembers(tenantId, uam.id, users, [
    ['manager', 'MANAGER', 36],
    ['senior', 'LEAD', 110],
    ['junior', 'JUNIOR', 120],
  ]);
  await ensure(prisma.engagementStakeholder, { engagementId: uam.id, name: 'Kevin Omondi' }, {
    tenantId, email: 'kevin.omondi@barakaholdings.example', title: 'Head of Information Technology', organisation: 'Baraka Holdings', role: 'Process Owner', isPrimary: true,
  });
  await addMilestones(tenantId, uam.id, [
    ['Planning memorandum approved', 'PLANNING', '2026-09-18', null],
    ['Programme approved', 'PROGRAMME', '2026-09-25', null],
    ['Fieldwork complete', 'FIELDWORK', '2026-10-30', null],
    ['Draft report issued', 'REPORTING', '2026-11-13', null],
  ]);
  await addStageHistory(tenantId, uam.id, users.manager.id, [[null, 'PLANNING', '2026-09-01', 'Engagement created from FY2026 plan item.']]);
  await instantiateProgram(
    tenantId, uam.id, 'User access management audit programme', PROGRAM_UAM, library.get('LIB-AP-UAM')!, 'DRAFT', null, null, risks, controls,
    () => ({ assigneeId: null, status: 'NOT_STARTED' }),
  );

  const portfolioEngagements: PortfolioEngagementSeed[] = [
    {
      auditNumber: 'IA-2026-003',
      title: 'Treasury dealing and liquidity limits review',
      type: 'FINANCIAL',
      entity: 'BH-SS-TRS',
      objectives: 'Assess controls over dealer limits, counterparty exposure, confirmations, settlement and liquidity reporting for the treasury function.',
      scope: 'FX, money market and liquidity management transactions processed from 1 January to 31 July 2026, including limit configuration and daily breach reporting.',
      outOfScope: 'Derivative valuation models and investment portfolio impairment testing.',
      background: 'Treasury volumes increased after regional cash pooling went live. ALCO requested assurance over automated limit monitoring and daily settlement reconciliations.',
      periodStart: '2026-01-01',
      periodEnd: '2026-07-31',
      stage: 'REPORTING',
      status: 'ACTIVE',
      riskRating: 'HIGH',
      plannedStart: '2026-05-18',
      plannedEnd: '2026-08-28',
      actualStart: '2026-05-20',
      budgetHours: 220,
      budgetAmount: 2640000,
      lead: 'senior',
      manager: 'manager',
      partner: 'partner',
      opinion: 'NEEDS_IMPROVEMENT',
      executiveSummary: 'Fieldwork identified inconsistent escalation of automated limit overrides and delays in evidencing daily confirmations. Management is finalising action plans before report issue.',
      members: [
        ['partner', 'PARTNER', 10],
        ['manager', 'MANAGER', 34],
        ['senior', 'LEAD', 92],
        ['junior', 'JUNIOR', 76],
      ],
      stakeholders: [
        { name: 'Moses Karanja', email: 'moses.karanja@barakaholdings.example', title: 'Head of Treasury', organisation: 'Baraka Holdings', role: 'Process Owner', isPrimary: true },
        { name: users.reviewer.displayName, email: users.reviewer.email, title: 'Chief Financial Officer', organisation: 'Baraka Holdings', role: 'Sponsor' },
      ],
      milestones: [
        ['Planning memorandum approved', 'PLANNING', '2026-05-22', '2026-05-22'],
        ['Programme approved', 'PROGRAMME', '2026-06-05', '2026-06-06'],
        ['Fieldwork complete', 'FIELDWORK', '2026-08-07', '2026-08-10'],
        ['Management responses agreed', 'REPORTING', '2026-09-04', null],
        ['Final report issued', 'REPORTING', '2026-09-18', null],
      ],
      history: [
        [null, 'PLANNING', '2026-05-18', 'Engagement opened following ALCO request.'],
        ['PLANNING', 'RISK_ASSESSMENT', '2026-05-25'],
        ['RISK_ASSESSMENT', 'PROGRAMME', '2026-06-01'],
        ['PROGRAMME', 'FIELDWORK', '2026-06-06', 'Programme approved.'],
        ['FIELDWORK', 'REVIEW', '2026-08-10'],
        ['REVIEW', 'REPORTING', '2026-08-24', 'Draft report issued for management response.'],
      ],
      programTitle: 'Treasury dealing and liquidity limits audit programme',
      programStatus: 'COMPLETED',
      approvedBy: 'manager',
      approvedAt: '2026-06-06',
      completedSteps: ['P.1', 'P.2', 'RA.1', 'RA.2', 'B.1', 'B.2', 'B.3'],
      inProgressSteps: ['R.1'],
      findings: [
        {
          reference: 'F-01',
          title: 'Treasury limit overrides not escalated within policy timelines',
          severity: 'HIGH',
          status: 'MANAGEMENT_REVIEW',
          entity: 'BH-SS-TRS',
          process: 'PRC-TRD',
          risk: 'R-012',
          control: 'C-014',
          condition: 'Six automated limit overrides were approved after execution and two remained open in the breach register for more than five business days.',
          criteria: 'Treasury Policy TP-02 requires same-day escalation of limit overrides to the Treasurer and CFO with documented ALCO ratification for breaches above tolerance.',
          cause: 'The limit dashboard sends alerts to the dealing desk but does not force evidence upload or escalation closure.',
          impact: 'Limit breaches may remain unresolved, exposing the group to counterparty and liquidity risk outside appetite.',
          recommendation: 'Configure mandatory escalation workflow and overdue breach reminders in the treasury system.',
          rootCause: 'TECHNOLOGY',
          category: 'Limit monitoring',
          actionOwnerName: 'Moses Karanja',
          actionOwnerEmail: 'moses.karanja@barakaholdings.example',
          dueDate: '2026-10-31',
          raisedBy: 'senior',
          createdAt: '2026-08-11',
          history: [[null, 'DRAFT', '2026-08-11', 'senior'], ['DRAFT', 'MANAGEMENT_REVIEW', '2026-08-24', 'manager']],
          recommendations: [{ text: 'Enable workflow-enforced override escalation with ageing and owner dashboards.', priority: 'HIGH', status: 'PROPOSED', dueDate: '2026-10-31' }],
        },
      ],
    },
    {
      auditNumber: 'IA-2026-004',
      title: 'Insurance claims processing review',
      type: 'OPERATIONAL',
      entity: 'BH-KE-INS',
      objectives: 'Evaluate claim intake, assessment, fraud referral, reserve approval and settlement controls for the Kenya insurance subsidiary.',
      scope: 'Motor and medical claims received between 1 January and 30 June 2026, including high-value claim approvals and reserve adjustments.',
      outOfScope: 'Actuarial model validation, reinsurance recoveries and litigation provisioning.',
      background: 'Claims volumes increased by 18 percent in H1 2026 and the risk assessment highlighted fraud investigation delays in motor claims.',
      periodStart: '2026-01-01',
      periodEnd: '2026-06-30',
      stage: 'REVIEW',
      status: 'ACTIVE',
      riskRating: 'HIGH',
      plannedStart: '2026-06-22',
      plannedEnd: '2026-09-12',
      actualStart: '2026-06-24',
      budgetHours: 260,
      budgetAmount: 3120000,
      lead: 'senior',
      manager: 'manager',
      partner: 'partner',
      opinion: 'NOT_RATED',
      members: [
        ['partner', 'PARTNER', 12],
        ['manager', 'MANAGER', 38],
        ['senior', 'LEAD', 110],
        ['junior', 'JUNIOR', 92],
      ],
      stakeholders: [
        { name: 'Nancy Adhiambo', email: 'nancy.adhiambo@barakaholdings.example', title: 'Claims Manager', organisation: 'Baraka Insurance Kenya', role: 'Process Owner', isPrimary: true },
        { name: 'Daniel Ouko', email: 'daniel.ouko@barakaholdings.example', title: 'Head of Fraud Investigation', organisation: 'Baraka Insurance Kenya', role: 'Auditee' },
      ],
      milestones: [
        ['Planning memorandum approved', 'PLANNING', '2026-06-26', '2026-06-27'],
        ['Programme approved', 'PROGRAMME', '2026-07-10', '2026-07-11'],
        ['Fieldwork complete', 'FIELDWORK', '2026-08-28', '2026-08-31'],
        ['Manager review complete', 'REVIEW', '2026-09-08', null],
        ['Draft report issued', 'REPORTING', '2026-09-12', null],
      ],
      history: [
        [null, 'PLANNING', '2026-06-22', 'Engagement created from the FY2026 plan.'],
        ['PLANNING', 'RISK_ASSESSMENT', '2026-07-01'],
        ['RISK_ASSESSMENT', 'PROGRAMME', '2026-07-08'],
        ['PROGRAMME', 'FIELDWORK', '2026-07-11'],
        ['FIELDWORK', 'REVIEW', '2026-08-31', 'Workpapers submitted for manager review.'],
      ],
      programTitle: 'Insurance claims processing audit programme',
      programStatus: 'IN_PROGRESS',
      approvedBy: 'manager',
      approvedAt: '2026-07-11',
      completedSteps: ['P.1', 'P.2', 'RA.1', 'RA.2', 'B.1', 'B.2'],
      inProgressSteps: ['B.3', 'R.1'],
      findings: [
        {
          reference: 'F-01',
          title: 'Fraud referral criteria not consistently applied for motor claims',
          severity: 'HIGH',
          status: 'AGREED',
          entity: 'BH-KE-INS',
          process: 'PRC-CLM',
          risk: 'R-014',
          control: 'C-016',
          condition: 'Nine of 30 high-risk motor claims were settled without documented fraud desk referral despite meeting the policy threshold.',
          criteria: 'Claims Procedure CLM-04 requires fraud desk referral for claims above KES 500,000 with late notification, repeat claimant indicators or inconsistent police abstracts.',
          cause: 'The claims workflow flags high-risk indicators but allows settlement to continue without evidence of referral clearance.',
          impact: 'Potentially inflated or fraudulent claims may be settled before independent investigation.',
          recommendation: 'Configure system-enforced referral clearance before settlement and refresh training for claims assessors.',
          managementResponse: 'Agreed. Workflow change requested and refresher training scheduled for October 2026.',
          rootCause: 'PROCESS',
          category: 'Fraud controls',
          actionOwnerName: 'Nancy Adhiambo',
          actionOwnerEmail: 'nancy.adhiambo@barakaholdings.example',
          dueDate: '2026-10-31',
          agreedAt: '2026-09-03',
          raisedBy: 'senior',
          createdAt: '2026-08-25',
          history: [[null, 'DRAFT', '2026-08-25', 'senior'], ['DRAFT', 'MANAGEMENT_REVIEW', '2026-08-31', 'manager'], ['MANAGEMENT_REVIEW', 'AGREED', '2026-09-03', 'owner']],
          recommendations: [{ text: 'Block claim settlement until fraud referral clearance is attached for policy threshold matches.', priority: 'HIGH', status: 'AGREED', dueDate: '2026-10-31', progressPct: 15 }],
        },
      ],
    },
    {
      auditNumber: 'IA-2026-005',
      title: 'Credit origination and KYC compliance review',
      type: 'COMPLIANCE',
      entity: 'BH-KE-RB',
      objectives: 'Assess compliance with credit approval, customer onboarding, KYC and sanctions screening requirements for retail lending.',
      scope: 'Retail loans originated from 1 April to 31 August 2026, including policy exception approvals and mandatory customer due diligence evidence.',
      outOfScope: 'Corporate banking facilities and collections strategy.',
      background: 'The Audit Committee requested an early start after continuous monitoring flagged missing KYC artefacts in new loan files.',
      periodStart: '2026-04-01',
      periodEnd: '2026-08-31',
      stage: 'PROGRAMME',
      status: 'ACTIVE',
      riskRating: 'CRITICAL',
      plannedStart: '2026-09-21',
      plannedEnd: '2026-11-20',
      budgetHours: 300,
      budgetAmount: 3600000,
      lead: 'senior',
      manager: 'manager',
      partner: 'partner',
      opinion: 'NOT_RATED',
      members: [
        ['partner', 'PARTNER', 14],
        ['manager', 'MANAGER', 42],
        ['senior', 'LEAD', 126],
        ['junior', 'JUNIOR', 110],
        ['cae', 'REVIEWER', 8],
      ],
      stakeholders: [
        { name: 'Kevin Omondi', email: 'kevin.omondi@barakaholdings.example', title: 'Head of Digital Banking', organisation: 'Baraka Bank Kenya', role: 'Sponsor', isPrimary: true },
        { name: 'Winnie Chebet', email: 'winnie.chebet@barakaholdings.example', title: 'Head of Retail Credit', organisation: 'Baraka Bank Kenya', role: 'Process Owner' },
      ],
      milestones: [
        ['Opening meeting', 'PLANNING', '2026-09-21', null],
        ['Risk assessment complete', 'RISK_ASSESSMENT', '2026-09-30', null],
        ['Programme approved', 'PROGRAMME', '2026-10-05', null],
        ['Fieldwork complete', 'FIELDWORK', '2026-11-06', null],
        ['Draft report issued', 'REPORTING', '2026-11-20', null],
      ],
      history: [
        [null, 'PLANNING', '2026-09-01', 'Early-start engagement created from continuous monitoring signal.'],
        ['PLANNING', 'RISK_ASSESSMENT', '2026-09-03'],
        ['RISK_ASSESSMENT', 'PROGRAMME', '2026-09-04', 'Draft programme prepared for manager approval.'],
      ],
      programTitle: 'Credit origination and KYC compliance audit programme',
      programStatus: 'PENDING_APPROVAL',
      completedSteps: ['P.1', 'P.2', 'RA.1'],
      inProgressSteps: ['RA.2'],
      findings: [
        {
          reference: 'F-01',
          title: 'KYC file completeness exception trend requires targeted testing',
          severity: 'MEDIUM',
          status: 'DRAFT',
          entity: 'BH-KE-RB',
          process: 'PRC-LON',
          risk: 'R-017',
          control: 'C-019',
          condition: 'Continuous monitoring flagged 47 loan files with at least one missing onboarding artefact, primarily proof of address and sanctions screening timestamps.',
          criteria: 'AML/KYC Procedure AML-01 requires all mandatory onboarding artefacts before loan disbursement.',
          cause: 'Root cause is under assessment during planning.',
          impact: 'Potential non-compliance with AML/CFT obligations and regulatory reporting exposure.',
          recommendation: 'Perform targeted testing over flagged files and confirm whether system controls blocked incomplete onboarding.',
          rootCause: 'DATA',
          category: 'Regulatory compliance',
          actionOwnerName: 'Winnie Chebet',
          actionOwnerEmail: 'winnie.chebet@barakaholdings.example',
          dueDate: '2026-11-30',
          raisedBy: 'senior',
          createdAt: '2026-09-04',
          history: [[null, 'DRAFT', '2026-09-04', 'senior']],
          recommendations: [{ text: 'Investigate flagged files and complete the exception root-cause analysis.', priority: 'MEDIUM', status: 'PROPOSED', dueDate: '2026-11-30' }],
        },
      ],
    },
    {
      auditNumber: 'IA-2026-006',
      title: 'IFRS 17 reporting readiness advisory',
      type: 'ADVISORY',
      entity: 'BH-KE-INS',
      objectives: 'Review IFRS 17 reporting readiness, data hand-offs and governance over actuarial assumption changes before year-end close.',
      scope: 'Finance, actuarial and claims data hand-offs supporting IFRS 17 reporting for the 2026 year-end dry run.',
      outOfScope: 'Independent actuarial valuation and external audit procedures.',
      background: 'Management requested advisory support after the June dry run identified reconciliation breaks between claims, actuarial and finance data sets.',
      periodStart: '2026-07-01',
      periodEnd: '2026-12-31',
      stage: 'FIELDWORK',
      status: 'ON_HOLD',
      riskRating: 'MEDIUM',
      plannedStart: '2026-08-17',
      plannedEnd: '2026-10-02',
      actualStart: '2026-08-19',
      budgetHours: 180,
      budgetAmount: 2160000,
      lead: 'senior',
      manager: 'manager',
      partner: 'partner',
      opinion: 'NOT_RATED',
      members: [
        ['partner', 'PARTNER', 8],
        ['manager', 'MANAGER', 26],
        ['senior', 'LEAD', 84],
        ['junior', 'JUNIOR', 54],
      ],
      stakeholders: [
        { name: 'Esther Naliaka', email: 'esther.naliaka@barakaholdings.example', title: 'Head of Financial Reporting', organisation: 'Baraka Insurance Kenya', role: 'Process Owner', isPrimary: true },
        { name: 'Dr. Patrick Wekesa', email: 'patrick.wekesa@barakaholdings.example', title: 'Appointed Actuary', organisation: 'Baraka Insurance Kenya', role: 'Specialist' },
      ],
      milestones: [
        ['Planning memorandum approved', 'PLANNING', '2026-08-21', '2026-08-22'],
        ['Programme approved', 'PROGRAMME', '2026-08-28', '2026-08-29'],
        ['Data extracts received', 'FIELDWORK', '2026-09-04', null],
        ['Fieldwork resumes', 'FIELDWORK', '2026-09-14', null],
        ['Advisory memo issued', 'REPORTING', '2026-10-02', null],
      ],
      history: [
        [null, 'PLANNING', '2026-08-17', 'Management-request advisory engagement opened.'],
        ['PLANNING', 'RISK_ASSESSMENT', '2026-08-22'],
        ['RISK_ASSESSMENT', 'PROGRAMME', '2026-08-27'],
        ['PROGRAMME', 'FIELDWORK', '2026-08-29', 'Paused pending actuarial data extracts.'],
      ],
      programTitle: 'IFRS 17 reporting readiness advisory programme',
      programStatus: 'IN_PROGRESS',
      approvedBy: 'manager',
      approvedAt: '2026-08-29',
      completedSteps: ['P.1', 'P.2', 'RA.1', 'RA.2', 'B.1'],
      inProgressSteps: ['B.2'],
    },
    {
      auditNumber: 'IA-2026-007',
      title: 'Fixed assets verification and register reconciliation',
      type: 'FINANCIAL',
      entity: 'BH-SS-FIN',
      objectives: 'Assess the accuracy of the fixed asset register, physical verification controls and reconciliation to the general ledger.',
      scope: 'Property and equipment recorded as at 31 March 2026 for Kenya operations, including additions, disposals and depreciation reconciliations.',
      outOfScope: 'Investment property fair valuation and right-of-use asset accounting.',
      background: 'External audit management letters noted recurring differences between branch asset listings and the central fixed asset register.',
      periodStart: '2025-07-01',
      periodEnd: '2026-03-31',
      stage: 'CLOSED',
      status: 'COMPLETED',
      riskRating: 'MEDIUM',
      plannedStart: '2026-03-02',
      plannedEnd: '2026-04-30',
      actualStart: '2026-03-02',
      actualEnd: '2026-05-06',
      reportIssuedAt: '2026-05-06',
      budgetHours: 190,
      budgetAmount: 2280000,
      lead: 'senior',
      manager: 'manager',
      partner: 'partner',
      opinion: 'SATISFACTORY',
      executiveSummary: 'The fixed asset register was materially reconciled to the general ledger. Minor tagging exceptions were accepted by management and will be addressed during the annual verification cycle.',
      members: [
        ['partner', 'PARTNER', 8],
        ['manager', 'MANAGER', 28],
        ['senior', 'LEAD', 76],
        ['junior', 'JUNIOR', 70],
      ],
      stakeholders: [
        { name: users.reviewer.displayName, email: users.reviewer.email, title: 'Chief Financial Officer', organisation: 'Baraka Holdings', role: 'Sponsor', isPrimary: true },
        { name: 'Anne Wairimu', email: 'anne.wairimu@barakaholdings.example', title: 'Fixed Assets Accountant', organisation: 'Baraka Holdings', role: 'Auditee' },
      ],
      milestones: [
        ['Planning memorandum approved', 'PLANNING', '2026-03-06', '2026-03-05'],
        ['Programme approved', 'PROGRAMME', '2026-03-13', '2026-03-13'],
        ['Physical verification complete', 'FIELDWORK', '2026-04-10', '2026-04-12'],
        ['Draft report issued', 'REPORTING', '2026-04-24', '2026-04-25'],
        ['Final report issued', 'REPORTING', '2026-05-06', '2026-05-06'],
        ['Engagement closed', 'CLOSED', '2026-05-08', '2026-05-08'],
      ],
      history: [
        [null, 'PLANNING', '2026-03-02', 'Engagement opened from external audit management letter follow-up.'],
        ['PLANNING', 'RISK_ASSESSMENT', '2026-03-05'],
        ['RISK_ASSESSMENT', 'PROGRAMME', '2026-03-10'],
        ['PROGRAMME', 'FIELDWORK', '2026-03-13'],
        ['FIELDWORK', 'REVIEW', '2026-04-12'],
        ['REVIEW', 'REPORTING', '2026-04-25'],
        ['REPORTING', 'CLOSED', '2026-05-08', 'Final report issued and minor issue risk-accepted.'],
      ],
      programTitle: 'Fixed assets verification audit programme',
      programStatus: 'COMPLETED',
      approvedBy: 'manager',
      approvedAt: '2026-03-13',
      completedSteps: ['P.1', 'P.2', 'RA.1', 'RA.2', 'B.1', 'B.2', 'B.3', 'R.1'],
      findings: [
        {
          reference: 'F-01',
          title: 'Asset tags missing on low-value branch equipment',
          severity: 'LOW',
          status: 'RISK_ACCEPTED',
          entity: 'BH-SS-FIN',
          process: 'PRC-FA',
          risk: 'R-018',
          control: 'C-020',
          condition: 'Twelve low-value assets at three branches were present but did not have readable asset tags.',
          criteria: 'Fixed Asset Procedure FA-02 requires every asset on the register to carry a readable barcode tag.',
          cause: 'Branch relocations damaged or removed tags and there is no quarterly spot-check process.',
          impact: 'Minor risk of misidentification during future verification exercises.',
          recommendation: 'Retag the identified assets and include barcode readability in the annual verification checklist.',
          managementResponse: 'Risk accepted due to low value; retagging will be completed during the annual count.',
          rootCause: 'PROCESS',
          category: 'Asset safeguarding',
          actionOwner: 'reviewer',
          dueDate: '2026-07-31',
          agreedAt: '2026-04-29',
          closedAt: '2026-05-06',
          raisedBy: 'junior',
          createdAt: '2026-04-13',
          history: [[null, 'DRAFT', '2026-04-13', 'junior'], ['DRAFT', 'MANAGEMENT_REVIEW', '2026-04-25', 'manager'], ['MANAGEMENT_REVIEW', 'RISK_ACCEPTED', '2026-04-29', 'reviewer', 'Accepted as low value with annual count follow-up.']],
          recommendations: [{ text: 'Retag the twelve identified branch assets during the annual physical count.', priority: 'LOW', status: 'AGREED', dueDate: '2026-07-31' }],
        },
      ],
    },
  ];

  for (const item of portfolioEngagements) {
    const engagement = await upsertEngagement(tenantId, item.auditNumber, {
      title: item.title,
      type: item.type,
      entityId: entities.get(item.entity),
      objectives: item.objectives,
      scope: item.scope,
      outOfScope: item.outOfScope ?? null,
      background: item.background,
      periodStart: day(item.periodStart),
      periodEnd: day(item.periodEnd),
      stage: item.stage,
      status: item.status,
      riskRating: item.riskRating,
      plannedStart: day(item.plannedStart),
      plannedEnd: day(item.plannedEnd),
      actualStart: item.actualStart ? d(item.actualStart) : null,
      actualEnd: item.actualEnd ? d(item.actualEnd) : null,
      budgetHours: item.budgetHours,
      budgetAmount: item.budgetAmount,
      leadId: users[item.lead].id,
      managerId: users[item.manager].id,
      partnerId: users[item.partner].id,
      opinion: item.opinion,
      executiveSummary: item.executiveSummary ?? null,
      reportIssuedAt: item.reportIssuedAt ? d(item.reportIssuedAt) : null,
      metadata: { demoPortfolio: true },
      deletedAt: null,
    });
    await addMembers(tenantId, engagement.id, users, item.members);
    for (const stakeholder of item.stakeholders) {
      await ensure(prisma.engagementStakeholder, { engagementId: engagement.id, name: stakeholder.name }, {
        tenantId,
        email: stakeholder.email,
        title: stakeholder.title,
        organisation: stakeholder.organisation,
        role: stakeholder.role,
        isPrimary: stakeholder.isPrimary ?? false,
      });
    }
    await addMilestones(tenantId, engagement.id, item.milestones);
    await addStageHistory(tenantId, engagement.id, users[item.manager].id, item.history);
    const completed = new Set(item.completedSteps);
    const inProgress = new Set(item.inProgressSteps ?? []);
    await instantiateProgram(
      tenantId,
      engagement.id,
      item.programTitle,
      DEMO_ENGAGEMENT_PROGRAM,
      null,
      item.programStatus,
      item.approvedBy ? users[item.approvedBy].id : null,
      item.approvedAt ?? null,
      risks,
      controls,
      (ref) => ({
        assigneeId: users[item.lead].id,
        status: completed.has(ref) ? 'COMPLETED' : inProgress.has(ref) ? 'IN_PROGRESS' : 'NOT_STARTED',
      }),
    );
    if (item.findings?.length) {
      await seedFindings(tenantId, engagement.id, users, entities, processes, risks, controls, new Map<string, string>(), item.findings);
    }
  }

  // Link plan items to engagements
  await prisma.auditPlanItem.update({ where: { id: planItems.get('P2P')! }, data: { engagementId: p2p.id, status: 'IN_PROGRESS' } });
  await prisma.auditPlanItem.update({ where: { id: planItems.get('UAM')! }, data: { engagementId: uam.id, status: 'IN_PROGRESS' } });

  // ---------------------------------------------------------------- Collaboration
  const tasks: [string, UserHandle, UserHandle, string | null, 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT', 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED', number, string?, string?][] = [
    ['Address open review note on B.3.1 (call-back quantification)', 'junior', 'senior', p2p.id, 'HIGH', 'TODO', 2, 'Workpaper', p2pWps.get('B.3.1')],
    ['Complete segregation of duties matrix (C.1) using the ERP role extract', 'junior', 'senior', p2p.id, 'MEDIUM', 'IN_PROGRESS', 6, 'Workpaper', p2pWps.get('C.1')],
    ['Review B.2.2 duplicate payment analytics', 'manager', 'senior', p2p.id, 'MEDIUM', 'TODO', 3, 'Workpaper', p2pWps.get('B.2.2')],
    ['Follow up DR-003 delegation of authority matrix with Procurement', 'junior', 'senior', p2p.id, 'LOW', 'DONE', -1],
    ['Draft planning memorandum for the user access management review', 'senior', 'manager', uam.id, 'HIGH', 'TODO', 9],
    ['Prepare Q3 internal audit status report for the Audit Committee', 'cae', 'cae', null, 'HIGH', 'TODO', 20],
    ['Obtain KYC population from Retail Banking ahead of Q4 review', 'manager', 'cae', null, 'MEDIUM', 'BLOCKED', 25],
  ];
  for (const [title, assignee, creator, engagementId, priority, status, dueIn, targetType, targetId] of tasks) {
    await ensure(prisma.task, { tenantId, title }, {
      engagementId, targetType: targetType ?? null, targetId: targetId ?? null, assigneeId: users[assignee].id, createdById: users[creator].id,
      dueDate: daysFromNow(dueIn), priority, status, completedAt: status === 'DONE' ? daysFromNow(-2) : null,
    });
  }

  const comments: [string, string, UserHandle, string, boolean, string][] = [
    ['Finding', p2pFindings.get('F-02')!, 'senior', 'Recovered KES 850,000 confirmed by AP on 2 September; remaining KES 420,000 is with the vendor. Updating the impact wording before management review closes.', true, '2026-09-02'],
    ['Finding', p2pFindings.get('F-02')!, 'manager', 'Agree with HIGH. Please make sure the population reconciliation reference is in B.2.2 before this goes to the CFO.', true, '2026-09-02'],
    ['Finding', p2pFindings.get('F-03')!, 'owner', 'IT has confirmed CR-2026-311 is scheduled for the October release. The August change log review is signed and filed.', false, '2026-08-28'],
    ['Workpaper', p2pWps.get('B.3.1')!, 'senior', 'The 8 changes without call-back total KES 61m of payments in the period. Please add the schedule as E-008 once received.', true, '2026-09-01'],
    ['Engagement', p2p.id, 'manager', 'Fieldwork status: 5 of 9 programme steps complete, 3 findings drafted. Closing meeting pencilled for 18 September.', true, '2026-09-03'],
    ['Engagement', uam.id, 'manager', 'Kick-off with the Head of IT confirmed for 14 September. Please have the planning memo ready by the 11th.', true, '2026-09-03'],
  ];
  for (const [targetType, targetId, author, body, isInternal, at] of comments) {
    await ensure(prisma.comment, { targetId, body }, { tenantId, targetType, authorId: users[author].id, isInternal, mentions: [], createdAt: d(at) });
  }

  const notifications: [UserHandle, string, string, string, string, boolean, number][] = [
    ['junior', 'review_note.raised', 'Review note raised on B.3.1', 'Faith Njeri raised a HIGH priority review note on workpaper B.3.1 Vendor master change review test.', `/engagements/${p2p.id}/workpapers/${p2pWps.get('B.3.1')}`, false, -2],
    ['junior', 'task.assigned', 'Task assigned: address open review note on B.3.1', 'Due in 2 days.', '/tasks', false, -2],
    ['senior', 'workpaper.prepared', 'Workpaper B.4.1 marked prepared', 'Brian Kiptoo marked B.4.1 Interview: Head of Accounts Payable as prepared and ready for review.', `/engagements/${p2p.id}/workpapers/${p2pWps.get('B.4.1')}`, false, -2],
    ['manager', 'finding.submitted', 'Finding F-02 submitted for management review', 'IA-2026-001 F-02 Duplicate invoice report not reviewed and duplicate payments made (HIGH).', `/findings/${p2pFindings.get('F-02')}`, true, -2],
    ['owner', 'finding.management_review', 'Finding F-02 requires your response', 'Please provide a management response, action owner and target date for IA-2026-001 F-02.', `/findings/${p2pFindings.get('F-02')}`, false, -2],
    ['owner', 'request.reminder', 'Document request DR-003 due in 5 days', 'Signed delegation of authority matrix and emergency purchase approvals.', `/requests`, false, -2],
    ['cae', 'plan.item_started', 'Engagement IA-2026-002 created', 'User access management review has started planning; kick-off scheduled for 14 September.', `/engagements/${uam.id}`, true, -2],
    ['committee', 'finding.repeat', 'Repeat finding raised', 'IA-2026-001 F-03 repeats the root cause of IA-2025-014 F-03 (segregation of duties over master data).', `/findings/${p2pFindings.get('F-03')}`, false, -6],
  ];
  for (const [user, type, title, body, link, read, daysAgo] of notifications) {
    await ensure(prisma.notification, { userId: users[user].id, title }, {
      tenantId, type, body, link, channel: 'IN_APP', payload: {}, sentAt: daysFromNow(daysAgo), readAt: read ? daysFromNow(daysAgo + 1) : null, createdAt: daysFromNow(daysAgo),
    });
  }

  const trail: [UserHandle, string, string, string, string, Data | null, Data | null][] = [
    ['manager', 'engagement.created', 'Engagement', p2p.id, '2026-07-15', null, { auditNumber: 'IA-2026-001', title: 'Procure-to-pay process review' }],
    ['manager', 'engagement.stage_changed', 'Engagement', p2p.id, '2026-08-03', { stage: 'PROGRAMME' }, { stage: 'FIELDWORK' }],
    ['manager', 'program.approved', 'AuditProgram', p2pProgram.program.id, '2026-08-01', { status: 'PENDING_APPROVAL' }, { status: 'APPROVED' }],
    ['manager', 'workpaper.signed_off', 'Workpaper', p2pWps.get('B.1.1')!, '2026-08-12', { status: 'REVIEWED', isLocked: false }, { status: 'SIGNED_OFF', isLocked: true }],
    ['senior', 'finding.status_changed', 'Finding', p2pFindings.get('F-02')!, '2026-09-01', { status: 'DRAFT' }, { status: 'MANAGEMENT_REVIEW' }],
    ['owner', 'finding.status_changed', 'Finding', p2pFindings.get('F-03')!, '2026-08-28', { status: 'MANAGEMENT_REVIEW' }, { status: 'AGREED' }],
    ['junior', 'request.transition', 'DocumentRequest', dr1.id, '2026-08-13', { status: 'SUBMITTED' }, { status: 'ACCEPTED' }],
    ['owner', 'document.uploaded', 'Document', docIds.get('erp-role-extract')!, '2026-09-02', null, { fileName: 'ERP_role_assignments_Procurement_AP.xlsx' }],
    ['manager', 'engagement.created', 'Engagement', uam.id, '2026-09-01', null, { auditNumber: 'IA-2026-002', title: 'User access management review' }],
    ['admin', 'user.login', 'User', users.admin.id, '2026-09-03', null, { method: 'LOCAL' }],
  ];
  for (const [actor, action, targetType, targetId, at, before, after] of trail) {
    await ensureOnce(prisma.auditTrail, { tenantId, action, targetType, targetId }, {
      actorId: users[actor].id, actorEmail: users[actor].email, before: before ?? Prisma.JsonNull, after: after ?? Prisma.JsonNull, metadata: { source: 'seed' }, ipAddress: '127.0.0.1', userAgent: 'seed', requestId: `seed-${targetType.toLowerCase()}-${action}`, occurredAt: d(at),
    });
  }

  // ---------------------------------------------------------------- Time and availability
  const weekStart = day('2026-08-31');
  const sheet = await prisma.timesheet.upsert({
    where: { userId_weekStart: { userId: users.senior.id, weekStart } },
    update: {},
    create: { tenantId, userId: users.senior.id, weekStart, status: 'OPEN', totalHours: 0 },
  });
  const entries: [string, string, string | null, number, string][] = [
    ['2026-08-31', 'AUD-FW', p2p.id, 8, 'Duplicate payment analytics and review notes'],
    ['2026-09-01', 'AUD-FW', p2p.id, 6, 'Interview with Head of AP; B.3.1 review'],
    ['2026-09-01', 'ADM', null, 2, 'Team meeting and timesheet admin'],
    ['2026-09-02', 'AUD-FW', p2p.id, 7, 'Finding F-02 drafting and evidence'],
    ['2026-09-02', 'AUD-PL', uam.id, 1, 'Kick-off preparation for IA-2026-002'],
  ];
  let total = 0;
  for (const [date, code, engagementId, hours, notes] of entries) {
    await ensure(prisma.timeEntry, { timesheetId: sheet.id, date: day(date), chargeCodeId: chargeCodes.get(code)! }, { tenantId, engagementId, hours, notes });
    total += hours;
  }
  await prisma.timesheet.update({ where: { id: sheet.id }, data: { totalHours: total } });

  const priorWeek = day('2026-08-24');
  const juniorSheet = await prisma.timesheet.upsert({
    where: { userId_weekStart: { userId: users.junior.id, weekStart: priorWeek } },
    update: {},
    create: { tenantId, userId: users.junior.id, weekStart: priorWeek, status: 'SUBMITTED', totalHours: 40, submittedAt: d('2026-08-28') },
  });
  for (let i = 0; i < 5; i++) {
    const date = new Date(priorWeek.getTime() + i * 86_400_000);
    await ensure(prisma.timeEntry, { timesheetId: juniorSheet.id, date, chargeCodeId: chargeCodes.get('AUD-FW')! }, { tenantId, engagementId: p2p.id, hours: 8, notes: 'P2P fieldwork testing' });
  }
  await ensure(prisma.staffAvailability, { userId: users.junior.id, type: 'LEAVE', startDate: day('2026-09-21') }, { tenantId, endDate: day('2026-09-25'), hoursPerDay: 8, note: 'Annual leave' });
  await ensure(prisma.staffAvailability, { userId: users.senior.id, type: 'TRAINING', startDate: day('2026-10-07') }, { tenantId, endDate: day('2026-10-08'), hoursPerDay: 8, note: 'IIA data analytics course' });

  // ---------------------------------------------------------------- Risk radar and monitoring
  await ensure(prisma.riskSignal, { tenantId, title: 'CBK circular on outsourcing and third-party risk management' }, {
    source: 'regulator', summary: 'Central Bank of Kenya requires banks to maintain a register of critical outsourced services with annual assurance by 31 March 2027.', url: 'https://www.centralbank.go.ke/', publishedAt: d('2026-08-18'), relevanceScore: 0.92, status: 'LINKED', riskId: risks.get('R-020'), metadata: { jurisdiction: 'KE' },
  });
  await ensure(prisma.riskSignal, { tenantId, title: 'Regional bank reports payment diversion fraud through vendor bank detail changes' }, {
    source: 'news', summary: 'A regional lender disclosed losses of USD 1.1m from fraudulent supplier bank account changes processed without call-back verification.', publishedAt: d('2026-08-27'), relevanceScore: 0.88, status: 'REVIEWED', riskId: risks.get('R-003'), metadata: { jurisdiction: 'EA' },
  });
  await ensure(prisma.riskSignal, { tenantId, title: 'ODPC enforcement notice on customer data retention' }, {
    source: 'regulator', summary: 'Office of the Data Protection Commissioner issued enforcement notices to two financial institutions over retention of customer KYC data beyond the statutory period.', publishedAt: d('2026-09-01'), relevanceScore: 0.61, status: 'NEW', metadata: { jurisdiction: 'KE' },
  });
  const dupRule = await prisma.monitoringRule.upsert({
    where: { tenantId_code: { tenantId, code: 'MR-001' } },
    update: {},
    create: { tenantId, code: 'MR-001', name: 'Duplicate vendor payments', description: 'Same vendor, amount and normalised invoice number within 90 days.', ruleType: 'duplicate_payment', definition: { windowDays: 90, normaliseInvoiceNumber: true, minAmount: 50000 }, severity: 'HIGH', isActive: true, lastRunAt: daysFromNow(-1) },
  });
  const weekendRule = await prisma.monitoringRule.upsert({
    where: { tenantId_code: { tenantId, code: 'MR-002' } },
    update: {},
    create: { tenantId, code: 'MR-002', name: 'Weekend and public holiday journal postings', description: 'Manual journals posted outside business days above KES 1m.', ruleType: 'weekend_posting', definition: { minAmount: 1000000, calendar: 'KE' }, severity: 'MEDIUM', isActive: true, lastRunAt: daysFromNow(-1) },
  });
  await ensure(prisma.monitoringAlert, { ruleId: dupRule.id, title: 'Possible duplicate payment to Kilimani Office Supplies Ltd' }, {
    tenantId, detail: { vendor: 'Kilimani Office Supplies Ltd', invoices: ['INV-88213', 'INV88213'], amount: 486000, daysApart: 12 }, amount: 486000, status: 'OPEN', assigneeId: users.senior.id, detectedAt: daysFromNow(-1),
  });
  await ensure(prisma.monitoringAlert, { ruleId: weekendRule.id, title: 'Manual journal of KES 4.2m posted on Sunday 30 August 2026' }, {
    tenantId, detail: { journal: 'GJ-2026-07731', postedBy: 'fwanjala', account: '1890 Suspense', amount: 4200000 }, amount: 4200000, status: 'INVESTIGATING', assigneeId: users.junior.id, detectedAt: daysFromNow(-3),
  });

  // ---------------------------------------------------------------- Summary
  const counts: [string, number][] = [];
  const models = [
    'tenant', 'user', 'role', 'permission', 'rolePermission', 'framework', 'frameworkReference', 'workpaperTemplate',
    'riskCategory', 'scoringModel', 'chargeCode', 'auditEntity', 'process', 'risk', 'riskAssessment', 'control', 'riskControl',
    'controlTest', 'libraryItem', 'libraryItemFrameworkRef', 'auditPlan', 'auditPlanItem', 'managementRequest', 'engagement',
    'engagementMember', 'engagementStakeholder', 'engagementMilestone', 'engagementStageHistory', 'auditProgram', 'auditProgramStep',
    'workpaper', 'workpaperVersion', 'reviewNote', 'review', 'document', 'documentVersion', 'evidence', 'finding', 'recommendation',
    'findingStatusHistory', 'documentRequest', 'task', 'comment', 'notification', 'approval', 'auditTrail', 'timesheet', 'timeEntry',
    'staffAvailability', 'riskSignal', 'monitoringRule', 'monitoringAlert',
  ] as const;
  for (const m of models) {
    const delegate = (prisma as unknown as Record<string, { count(): Promise<number> }>)[m];
    counts.push([m, await delegate.count()]);
  }
  const width = Math.max(...counts.map(([m]) => m.length));
  console.log('\nSeed summary');
  console.log(`${'model'.padEnd(width)}  rows`);
  console.log(`${'-'.repeat(width)}  ----`);
  for (const [m, n] of counts) console.log(`${m.padEnd(width)}  ${String(n).padStart(4)}`);
  console.log(`\nDemo login: admin@bdo-ea.com / ${PASSWORD} (all seeded users share this password)`);
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
