import { RisksService } from '../risks/risks.service';
import { ControlsService } from './controls.service';

describe('Risk-control response contract', () => {
  const risk = { id: 'risk-1', code: 'R-001', title: 'Payment risk', rating: 'MEDIUM' };
  const summary = { id: 'control-1', code: 'C-001', title: 'Payment approval', effectiveness: 'EFFECTIVE' };
  const link = { tenantId: 'tenant-1', controlId: summary.id, riskId: risk.id, risk };
  const control = { ...summary, risks: [link], tests: [{ id: 'test-1' }], _count: { tests: 1, findings: 0 } };
  const db = {
    control: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
    risk: { findFirst: jest.fn(), count: jest.fn() },
    riskControl: { deleteMany: jest.fn(), createMany: jest.fn() },
  };
  const prisma = { scoped: jest.fn(() => db), transaction: jest.fn(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)) };
  const audit = { record: jest.fn() };
  const service = new ControlsService(prisma as never, { tenantId: 'tenant-1' } as never, audit as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.scoped.mockReturnValue(db);
    prisma.transaction.mockImplementation(async (fn) => fn(db));
    db.control.findFirst.mockResolvedValue(control);
    db.control.findMany.mockResolvedValue([control]);
    db.control.count.mockResolvedValue(1);
    db.control.create.mockResolvedValue(control);
    db.control.update.mockResolvedValue(control);
    db.risk.count.mockResolvedValue(1);
  });

  it('returns flat summaries with real risk IDs on paginated lists, without mutating join rows', async () => {
    const result = await service.list({ page: 2, pageSize: 5 });
    expect(result).toEqual({ items: [{ ...control, risks: [risk] }], total: 1, page: 2, pageSize: 5 });
    expect(control.risks).toEqual([link]);
    expect(db.control.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 5, take: 5, where: { deletedAt: null } }));
  });

  it('keeps tests and metadata on detail responses while flattening risk links', async () => {
    expect(await service.get(summary.id)).toEqual({ ...control, risks: [risk] });
    expect(db.control.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: summary.id, deletedAt: null } }));
  });

  it('returns an empty array for an unlinked control and rejects an unavailable control', async () => {
    db.control.findFirst.mockResolvedValueOnce({ ...control, risks: [] }).mockResolvedValueOnce(null);
    expect((await service.get(summary.id)).risks).toEqual([]);
    await expect(service.get('unavailable')).rejects.toThrow('Control not found');
  });

  it('uses the same summary contract when creating or editing a control', async () => {
    expect((await service.create({ code: summary.code, title: summary.title, riskIds: [risk.id] })).risks).toEqual([risk]);
    expect((await service.update(summary.id, { title: 'Edited control' })).risks).toEqual([risk]);
  });

  it('validates and deduplicates risk IDs before replacing links, then returns the refreshed summaries', async () => {
    expect((await service.setRisks(summary.id, { riskIds: [risk.id, risk.id] })).risks).toEqual([risk]);
    expect(db.risk.count).toHaveBeenCalledWith({ where: { id: { in: [risk.id] }, deletedAt: null } });
    expect(db.riskControl.createMany).toHaveBeenCalledWith({ data: [{ tenantId: 'tenant-1', riskId: risk.id, controlId: summary.id }] });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'control.risks_set', before: { riskIds: [risk.id] }, after: { riskIds: [risk.id] } }));
  });

  it('does not delete existing links when a requested risk is missing or outside the scoped tenant', async () => {
    db.risk.count.mockResolvedValue(0);
    await expect(service.setRisks(summary.id, { riskIds: ['unavailable'] })).rejects.toThrow('One or more risks were not found');
    expect(prisma.transaction).not.toHaveBeenCalled();
    expect(db.riskControl.deleteMany).not.toHaveBeenCalled();
  });

  it('returns the updated links rather than stale links after a PATCH containing riskIds', async () => {
    db.control.findFirst.mockResolvedValueOnce(control).mockResolvedValueOnce(control).mockResolvedValueOnce({ ...control, risks: [] });
    const result = await service.update(summary.id, { riskIds: [] });
    expect(result.risks).toEqual([]);
    expect(db.riskControl.deleteMany).toHaveBeenCalledWith({ where: { controlId: summary.id } });
    expect(db.riskControl.createMany).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'control.updated', after: result }));
  });

  it('returns flat linked controls when opening the reciprocal risk detail', async () => {
    const raw = { ...risk, controls: [{ tenantId: 'tenant-1', riskId: risk.id, controlId: summary.id, control: summary }], assessments: [] };
    db.risk.findFirst.mockResolvedValue(raw);
    const risks = new RisksService(prisma as never, {} as never, audit as never);
    expect(await risks.get(risk.id)).toEqual({ ...raw, controls: [summary] });
    expect(raw.controls[0].control).toEqual(summary);
  });
});
