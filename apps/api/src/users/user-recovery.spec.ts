import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('administrator account recovery', () => {
  const targetId = '22222222-2222-4222-8222-222222222222';
  const db = {
    user: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const prisma = {
    scoped: jest.fn(() => db),
    refreshToken: { updateMany: jest.fn() },
  };
  const ctx = { userId: '11111111-1111-4111-8111-111111111111', tenantId: 'tenant-1' };
  const audit = { record: jest.fn() };
  const access = { invalidate: jest.fn() };
  const service = new UsersService(prisma as never, ctx as never, audit as never, access as never);

  beforeEach(() => {
    jest.clearAllMocks();
    db.user.findFirst.mockResolvedValue({
      id: targetId,
      authProvider: 'LOCAL',
      preferences: { theme: 'dark' },
      deletedAt: null,
    });
    db.user.update.mockResolvedValue({ id: targetId });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });
  });

  it('issues a temporary password, forces replacement and revokes sessions', async () => {
    const result = await service.resetPassword(targetId);
    expect(result.temporaryPassword).toHaveLength(14);
    expect(db.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: targetId },
      data: expect.objectContaining({ preferences: { theme: 'dark', mustChangePassword: true } }),
    }));
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: targetId, revokedAt: null } }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.password_reset', targetId }));
  });

  it('clears MFA material and revokes sessions', async () => {
    await service.resetMfa(targetId);
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: targetId },
      data: { mfaEnabled: false, mfaSecretEnc: null, mfaRecoveryCodes: [] },
    });
    expect(access.invalidate).toHaveBeenCalledWith(targetId);
  });

  it('does not let an administrator bypass recovery controls for their own account', async () => {
    await expect(service.resetPassword(ctx.userId)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.resetMfa(ctx.userId)).rejects.toBeInstanceOf(BadRequestException);
  });
});

