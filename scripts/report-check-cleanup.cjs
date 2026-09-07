require('dotenv/config');
const { TenantContext } = require('../apps/api/dist/tenancy/tenant-context');
const { PrismaService } = require('../apps/api/dist/prisma/prisma.service');
const { AuditTrailService } = require('../apps/api/dist/audit-trail/audit-trail.service');

// The app retains engagements; hide only this check's synthetic fixture after its uploads are removed.
exports.archiveTestEngagement = async (engagement, actor) => {
  const ctx = new TenantContext();
  const prisma = new PrismaService(ctx);
  try {
    await ctx.runAs({ tenantId: actor.tenantId, userId: actor.id, email: actor.email }, async () => {
      const result = await prisma.scoped().engagement.updateMany({
        where: { id: engagement.id, title: engagement.title, scope: 'Synthetic test documents only', deletedAt: null, reportDocumentId: null },
        data: { deletedAt: new Date() },
      });
      if (result.count !== 1) throw new Error('The synthetic engagement could not be archived safely');
      await new AuditTrailService(prisma, ctx).record({ action: 'engagement.test_archived', targetType: 'Engagement', targetId: engagement.id, metadata: { reason: 'Report and document browser verification completed' } });
    });
  } finally { await prisma.$disconnect(); }
};
