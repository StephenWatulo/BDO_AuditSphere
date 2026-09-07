import { PrismaClient } from '@auditsphere/db';

/** Models whose `tenantId` is mandatory. Every query is filtered by it. */
export const TENANT_MODELS: ReadonlySet<string> = new Set([
  'User',
  'Role',
  'UserRole',
  'RefreshToken',
  'AuditEntity',
  'Process',
  'RiskCategory',
  'ScoringModel',
  'Risk',
  'RiskAssessment',
  'Control',
  'RiskControl',
  'ControlTest',
  'AuditPlan',
  'AuditPlanItem',
  'ManagementRequest',
  'Engagement',
  'EngagementMember',
  'EngagementStakeholder',
  'EngagementMilestone',
  'EngagementStageHistory',
  'AuditProgram',
  'AuditProgramStep',
  'Workpaper',
  'WorkpaperVersion',
  'ReviewNote',
  'Review',
  'Document',
  'DocumentVersion',
  'Evidence',
  'Finding',
  'Recommendation',
  'FindingStatusHistory',
  'DocumentRequest',
  'Task',
  'Comment',
  'Notification',
  'Approval',
  'AuditTrail',
  'ChargeCode',
  'Timesheet',
  'TimeEntry',
  'StaffAvailability',
  'AiInteraction',
  'RiskSignal',
  'DataConnector',
  'MonitoringRule',
  'MonitoringAlert',
]);

/** Models with a nullable `tenantId` where null means shared/global content. */
export const SHARED_MODELS: ReadonlySet<string> = new Set(['LibraryItem', 'WorkpaperTemplate']);

/** Models with no tenant column at all. */
export const GLOBAL_MODELS: ReadonlySet<string> = new Set([
  'Tenant',
  'Permission',
  'RolePermission',
  'Framework',
  'FrameworkReference',
  'LibraryItemFrameworkRef',
]);

const READ_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);
const WHERE_WRITE_OPS = new Set(['update', 'updateMany', 'updateManyAndReturn', 'delete', 'deleteMany']);
const CREATE_OPS = new Set(['create', 'createMany', 'createManyAndReturn']);

type AnyArgs = Record<string, any>;

function scopedWhere(model: string, where: AnyArgs | undefined, tenantId: string): AnyArgs {
  const base: AnyArgs = where ? { ...where } : {};
  if (SHARED_MODELS.has(model)) {
    const scope = { OR: [{ tenantId }, { tenantId: null }] };
    const and = Array.isArray(base.AND) ? base.AND : base.AND ? [base.AND] : [];
    return { ...base, AND: [...and, scope] };
  }
  return { ...base, tenantId };
}

function scopedData(data: AnyArgs | AnyArgs[] | undefined, tenantId: string): AnyArgs | AnyArgs[] | undefined {
  if (data === undefined) return data;
  if (Array.isArray(data)) return data.map((d) => ({ ...d, tenantId }));
  // Prisma rejects mixing a scalar FK with a nested relation write for the same relation.
  if (data.tenant !== undefined) return data;
  return { ...data, tenantId };
}

/**
 * Pure function that rewrites Prisma query args so that every operation on a
 * tenant-owned model is confined to `tenantId`. Exported for unit testing and
 * used by the `$allModels.$allOperations` query extension.
 */
export function applyTenantScope(model: string, operation: string, args: AnyArgs | undefined, tenantId: string): AnyArgs {
  const a: AnyArgs = args ? { ...args } : {};
  if (GLOBAL_MODELS.has(model)) return a;
  if (!TENANT_MODELS.has(model) && !SHARED_MODELS.has(model)) return a;

  if (READ_OPS.has(operation) || WHERE_WRITE_OPS.has(operation)) {
    a.where = scopedWhere(model, a.where, tenantId);
    return a;
  }
  if (CREATE_OPS.has(operation)) {
    a.data = scopedData(a.data, tenantId);
    return a;
  }
  if (operation === 'upsert') {
    a.where = scopedWhere(model, a.where, tenantId);
    a.create = scopedData(a.create, tenantId);
    return a;
  }
  return a;
}

export function createTenantClient(base: PrismaClient, tenantId: string) {
  return base.$extends({
    name: `tenant:${tenantId}`,
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return query(applyTenantScope(model, operation, args as AnyArgs, tenantId) as typeof args);
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof createTenantClient>;
export type TenantTx = Omit<TenantClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>;
