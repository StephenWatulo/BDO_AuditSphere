import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@auditsphere/db';
import { REQUIRE_PERMISSION_KEY } from '../common/decorators';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';

describe('Monitoring alert details', () => {
  const alert = {
    id: 'alert-1', title: 'Duplicate invoice', ruleId: 'rule-1', status: 'OPEN',
    amount: new Prisma.Decimal('486000.25'), detail: { invoices: ['INV-1', 'INV1'], daysApart: 12 },
    rule: { id: 'rule-1', code: 'MR-001', name: 'Duplicate payments', severity: 'HIGH', description: 'Duplicate payment check', connector: null },
    assignee: { id: 'user-1', displayName: 'Reviewer' },
  };
  const db = { monitoringAlert: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() } };
  const prisma = { scoped: jest.fn(() => db) };
  const audit = { record: jest.fn() };
  const service = new MonitoringService(prisma as never, {} as never, audit as never);
  beforeEach(() => {
    jest.clearAllMocks();
    db.monitoringAlert.findFirst.mockResolvedValue(alert);
    db.monitoringAlert.findMany.mockResolvedValue([alert]);
    db.monitoringAlert.count.mockResolvedValue(1);
    db.monitoringAlert.update.mockResolvedValue(alert);
  });

  it('loads the complete alert using the tenant-scoped client without mutating it', async () => {
    const result = await service.getAlert('alert-1');
    expect(prisma.scoped).toHaveBeenCalled();
    expect(db.monitoringAlert.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'alert-1' } }));
    expect(result).toMatchObject({ detail: alert.detail, rule: alert.rule, amount: '486000.25' });
    expect(db.monitoringAlert.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
  it('selects rule details and connector metadata, not connector credentials', async () => {
    await service.getAlert('alert-1');
    const include = db.monitoringAlert.findFirst.mock.calls[0][0].include;
    expect(include.rule.select.description).toBe(true);
    expect(include.rule.select.connector.select).toEqual({ id: true, name: true, type: true, lastRunAt: true, lastStatus: true });
  });
  it('returns not found for an alert outside the scoped result set', async () => {
    db.monitoringAlert.findFirst.mockResolvedValue(null);
    await expect(service.getAlert('other-tenant-alert')).rejects.toBeInstanceOf(NotFoundException);
  });
  it.each([null, new Prisma.Decimal(0)])('preserves missing and zero amounts (%s)', async (amount) => {
    db.monitoringAlert.findFirst.mockResolvedValue({ ...alert, amount });
    expect((await service.getAlert('alert-1')).amount).toBe(amount === null ? null : '0');
  });
  it('returns consistent monetary values in the list and update responses', async () => {
    expect((await service.listAlerts({ page: 2, pageSize: 10, sort: 'amount:asc' }, { id: 'user-1' } as never)).items[0].amount).toBe('486000.25');
    expect(db.monitoringAlert.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10, orderBy: { amount: 'asc' } }));
    expect((await service.updateAlert('alert-1', { assigneeId: null })).amount).toBe('486000.25');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'monitoring_alert.updated' }));
  });
  it('requires read permission to open and manage permission to update', () => {
    expect(Reflect.getMetadata(REQUIRE_PERMISSION_KEY, MonitoringController.prototype.alert)).toEqual(['monitoring:read']);
    expect(Reflect.getMetadata(REQUIRE_PERMISSION_KEY, MonitoringController.prototype.updateAlert)).toEqual(['monitoring:manage']);
  });
});
