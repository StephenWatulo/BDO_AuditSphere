import { UnauthorizedException } from '@nestjs/common';
import { AuthService, LOCKOUT_MINUTES, MAX_FAILED_LOGINS } from './auth.service';
import { hashPassword } from './password';

const TENANT = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

function makeUser(over: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    tenantId: TENANT,
    email: 'admin@bdo-ea.com',
    displayName: 'Admin',
    status: 'ACTIVE',
    authProvider: 'LOCAL',
    passwordHash: 'set-in-beforeAll',
    mfaEnabled: false,
    mfaSecretEnc: null,
    mfaRecoveryCodes: [] as string[],
    failedLoginCount: 0,
    lockedUntil: null as Date | null,
    deletedAt: null,
    preferences: {},
    tenant: { id: TENANT, slug: 'bdo-ea', isActive: true },
    ...over,
  };
}

describe('AuthService', () => {
  let passwordHash: string;
  let prisma: any;
  let tokens: any;
  let userAccess: any;
  let audit: any;
  let config: any;
  let service: AuthService;
  const meta = { ip: '127.0.0.1', userAgent: 'jest' };

  beforeAll(async () => {
    passwordHash = await hashPassword('Admin123!');
  });

  beforeEach(() => {
    prisma = {
      user: { findFirst: jest.fn(), update: jest.fn(async (args: any) => ({ id: args.where.id, ...args.data })), findFirstOrThrow: jest.fn() },
      refreshToken: { create: jest.fn(async (args: any) => ({ id: 'rt-new', ...args.data })), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    };
    tokens = { signAccess: jest.fn(() => 'access.jwt'), signMfa: jest.fn(() => 'mfa.jwt'), verifyMfa: jest.fn() };
    userAccess = {
      load: jest.fn(async () => ({ id: USER_ID, tenantId: TENANT, email: 'admin@bdo-ea.com', roles: ['GLOBAL_ADMIN'], permissions: ['user:read'], status: 'ACTIVE', tenant: { id: TENANT, slug: 'bdo-ea', name: 'BDO', isActive: true } })),
      invalidate: jest.fn(),
    };
    audit = { record: jest.fn(async () => undefined) };
    config = { jwt: { accessTtlMs: 900_000, refreshTtlMs: 30 * 86_400_000 }, encryptionKey: Buffer.alloc(32, 1) };
    service = new AuthService(prisma, tokens, userAccess, audit, config);
  });

  it('issues a session and resets the failure counter on a correct password', async () => {
    prisma.user.findFirst.mockResolvedValue(makeUser({ passwordHash, failedLoginCount: 3 }));
    const result = await service.login({ email: 'admin@bdo-ea.com', password: 'Admin123!' }, meta);
    expect(result.kind).toBe('session');
    if (result.kind === 'session') {
      expect(result.tokens.access).toBe('access.jwt');
      expect(result.tokens.refresh).toHaveLength(64);
    }
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ failedLoginCount: 0, lockedUntil: null }) }));
    expect(prisma.refreshToken.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: USER_ID, tenantId: TENANT }) }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.login' }));
  });

  it('activates INVITED users on first successful login', async () => {
    prisma.user.findFirst.mockResolvedValue(makeUser({ passwordHash, status: 'INVITED' }));
    await service.login({ email: 'admin@bdo-ea.com', password: 'Admin123!' }, meta);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) }));
  });

  it('rejects a wrong password with a generic message and increments the counter', async () => {
    prisma.user.findFirst.mockResolvedValue(makeUser({ passwordHash, failedLoginCount: 1 }));
    const err = await service.login({ email: 'admin@bdo-ea.com', password: 'nope' }, meta).catch((e) => e);
    expect(err).toBeInstanceOf(UnauthorizedException);
    expect(err.message).toBe('Invalid email or password');
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ failedLoginCount: 2 }) }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.login_failed' }));
  });

  it(`locks the account for ${LOCKOUT_MINUTES} minutes after ${MAX_FAILED_LOGINS} failures`, async () => {
    prisma.user.findFirst.mockResolvedValue(makeUser({ passwordHash, failedLoginCount: MAX_FAILED_LOGINS - 1 }));
    const before = Date.now();
    await expect(service.login({ email: 'admin@bdo-ea.com', password: 'nope' }, meta)).rejects.toBeInstanceOf(UnauthorizedException);
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.failedLoginCount).toBe(0);
    expect(data.lockedUntil).toBeInstanceOf(Date);
    expect(data.lockedUntil.getTime() - before).toBeGreaterThanOrEqual(LOCKOUT_MINUTES * 60_000 - 1000);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.account_locked' }));
  });

  it('rejects a locked account even with the correct password', async () => {
    prisma.user.findFirst.mockResolvedValue(makeUser({ passwordHash, lockedUntil: new Date(Date.now() + 60_000) }));
    const err = await service.login({ email: 'admin@bdo-ea.com', password: 'Admin123!' }, meta).catch((e) => e);
    expect(err.message).toBe('Invalid email or password');
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.login_locked' }));
  });

  it('uses the same generic message for unknown emails and suspended users', async () => {
    prisma.user.findFirst.mockResolvedValueOnce(null);
    const unknown = await service.login({ email: 'ghost@bdo-ea.com', password: 'x' }, meta).catch((e) => e);
    prisma.user.findFirst.mockResolvedValueOnce(makeUser({ passwordHash, status: 'SUSPENDED' }));
    const suspended = await service.login({ email: 'admin@bdo-ea.com', password: 'Admin123!' }, meta).catch((e) => e);
    expect(unknown.message).toBe('Invalid email or password');
    expect(suspended.message).toBe('Invalid email or password');
  });

  it('returns an MFA challenge instead of a session when MFA is enabled', async () => {
    prisma.user.findFirst.mockResolvedValue(makeUser({ passwordHash, mfaEnabled: true, mfaSecretEnc: 'enc' }));
    const result = await service.login({ email: 'admin@bdo-ea.com', password: 'Admin123!' }, meta);
    expect(result).toEqual({ kind: 'mfa', mfaToken: 'mfa.jwt' });
    expect(tokens.signMfa).toHaveBeenCalledWith({ sub: USER_ID, tid: TENANT });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('rotates the refresh token within the same family', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({ id: 'rt-old', tenantId: TENANT, userId: USER_ID, family: 'fam-1', revokedAt: null, expiresAt: new Date(Date.now() + 1000_000), userAgent: null, ipAddress: null });
    const result = await service.refresh('raw-token', meta);
    expect(result.tokens.access).toBe('access.jwt');
    expect(prisma.refreshToken.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ family: 'fam-1' }) }));
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({ where: { id: 'rt-old' }, data: expect.objectContaining({ replacedBy: 'rt-new' }) });
  });

  it('revokes the whole family when a rotated token is replayed', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({ id: 'rt-old', tenantId: TENANT, userId: USER_ID, family: 'fam-1', revokedAt: new Date(), expiresAt: new Date(Date.now() + 1000_000) });
    await expect(service.refresh('raw-token', meta)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({ where: { family: 'fam-1', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.refresh_reuse_detected' }));
  });

  it('rejects expired and missing refresh tokens', async () => {
    await expect(service.refresh(undefined, meta)).rejects.toBeInstanceOf(UnauthorizedException);
    prisma.refreshToken.findUnique.mockResolvedValue({ id: 'rt', family: 'f', revokedAt: null, expiresAt: new Date(Date.now() - 1) });
    await expect(service.refresh('raw', meta)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('clears the bootstrap password flag after a successful password change', async () => {
    prisma.user.findFirstOrThrow.mockResolvedValue(makeUser({
      passwordHash,
      preferences: { mustChangePassword: true, timezone: 'Africa/Nairobi' },
    }));
    await service.changePassword(USER_ID, 'Admin123!', 'SaferPassword456!');
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ preferences: { timezone: 'Africa/Nairobi' } }),
    }));
    expect(userAccess.invalidate).toHaveBeenCalledWith(USER_ID);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.password_changed' }));
  });
});
