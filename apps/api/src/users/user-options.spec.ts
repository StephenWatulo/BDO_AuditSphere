import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { REQUIRE_PERMISSION_KEY } from '../common/decorators';
import { UsersController } from './users.controller';
import { UserOptionsQueryDto } from './users.dto';
import { UsersService } from './users.service';

describe('Assignment directory', () => {
  const row = { id: 'user-1', displayName: 'Action owner', email: 'owner@example.test', avatarUrl: null, jobTitle: null };
  const db = { user: { count: jest.fn(), findMany: jest.fn() } };
  const prisma = { scoped: jest.fn(() => db) };
  const service = new UsersService(prisma as never, {} as never, {} as never, {} as never);
  beforeEach(() => { jest.clearAllMocks(); db.user.count.mockResolvedValue(1); db.user.findMany.mockResolvedValue([row]); });

  it('uses the tenant-scoped client and excludes inactive or deleted users', async () => {
    expect((await service.options({})).items).toEqual([row]);
    expect(prisma.scoped).toHaveBeenCalled();
    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'ACTIVE', deletedAt: null } }));
  });
  it('returns only assignment contact fields, not administrative information', async () => {
    await service.options({});
    expect(db.user.findMany.mock.calls[0][0].select).toEqual({ id: true, displayName: true, email: true, avatarUrl: true, jobTitle: true });
  });
  it('supports name/email search, role filtering and bounded pagination', async () => {
    await service.options({ q: 'Lydia', role: 'MANAGEMENT_REVIEWER', page: 2, pageSize: 20 });
    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20, where: expect.objectContaining({ roles: { some: { role: { key: 'MANAGEMENT_REVIEWER' } } }, OR: [{ email: { contains: 'Lydia', mode: 'insensitive' } }, { displayName: { contains: 'Lydia', mode: 'insensitive' } }] }) }));
  });
  it('does not permit callers to override the active-user restriction', async () => {
    const query = plainToInstance(UserOptionsQueryDto, { status: 'SUSPENDED' });
    expect(await validate(query, { whitelist: true, forbidNonWhitelisted: false })).toEqual([]);
    expect(query).not.toHaveProperty('status');
    await service.options(query);
    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'ACTIVE', deletedAt: null } }));
  });
  it('allows finding responders to use options without exposing the admin directory', () => {
    expect(Reflect.getMetadata(REQUIRE_PERMISSION_KEY, UsersController.prototype.options)).toEqual(['user:read', 'finding:respond']);
    expect(Reflect.getMetadata(REQUIRE_PERMISSION_KEY, UsersController.prototype.list)).toEqual(['user:read']);
    expect(Reflect.getMetadata(REQUIRE_PERMISSION_KEY, UsersController.prototype.get)).toEqual(['user:read']);
  });
});
