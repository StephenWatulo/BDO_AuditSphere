import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Prisma, User } from '@auditsphere/db';
import { authenticator } from 'otplib';
import { v4 as uuidv4 } from 'uuid';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { decrypt, encrypt, randomRecoveryCode, randomToken, sha256 } from '../common/crypto';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, IssuedTokens, LoginResult, RequestMeta } from './auth.types';
import { LoginDto } from './dto/auth.dto';
import { hashPassword, verifyPassword } from './password';
import { TokenService } from './token.service';
import { UserAccessService } from './user-access.service';

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;
const RECOVERY_CODE_COUNT = 8;
const GENERIC_LOGIN_ERROR = 'Invalid email or password';

authenticator.options = { window: 1 };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly userAccess: UserAccessService,
    private readonly audit: AuditTrailService,
    private readonly config: AppConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // Local login
  // ---------------------------------------------------------------------------

  async login(dto: LoginDto, meta: RequestMeta): Promise<LoginResult> {
    const user = await this.findLoginUser(dto.email, dto.tenantSlug);
    const now = new Date();

    if (!user || user.authProvider !== 'LOCAL' || !user.passwordHash) {
      // Burn comparable time so user enumeration by timing is harder.
      await verifyPassword('$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', dto.password);
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED' || !user.tenant.isActive) {
      await this.audit.record({
        tenantId: user.tenantId,
        actorId: user.id,
        actorEmail: user.email,
        action: 'auth.login_denied',
        targetType: 'User',
        targetId: user.id,
        metadata: { reason: 'status', status: user.status },
      });
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    if (user.lockedUntil && user.lockedUntil > now) {
      await this.audit.record({
        tenantId: user.tenantId,
        actorId: user.id,
        actorEmail: user.email,
        action: 'auth.login_locked',
        targetType: 'User',
        targetId: user.id,
        metadata: { lockedUntil: user.lockedUntil },
      });
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const ok = await verifyPassword(user.passwordHash, dto.password);
    if (!ok) {
      await this.registerFailedLogin(user, now);
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: now,
        status: user.status === 'INVITED' ? 'ACTIVE' : user.status,
      },
    });
    this.userAccess.invalidate(user.id);

    if (user.mfaEnabled) {
      const mfaToken = this.tokens.signMfa({ sub: user.id, tid: user.tenantId });
      await this.audit.record({
        tenantId: user.tenantId,
        actorId: user.id,
        actorEmail: user.email,
        action: 'auth.mfa_challenged',
        targetType: 'User',
        targetId: user.id,
      });
      return { kind: 'mfa', mfaToken };
    }

    const session = await this.issueSession(user.id, meta, 'password');
    return { kind: 'session', ...session };
  }

  private async findLoginUser(email: string, tenantSlug?: string) {
    const where: Prisma.UserWhereInput = {
      email: { equals: email, mode: 'insensitive' },
      deletedAt: null,
      ...(tenantSlug ? { tenant: { slug: tenantSlug } } : {}),
    };
    return this.prisma.user.findFirst({
      where,
      include: { tenant: { select: { id: true, slug: true, isActive: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async registerFailedLogin(user: User, now: Date) {
    const count = user.failedLoginCount + 1;
    const lock = count >= MAX_FAILED_LOGINS;
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: lock ? 0 : count,
        lockedUntil: lock ? new Date(now.getTime() + LOCKOUT_MINUTES * 60_000) : user.lockedUntil,
      },
    });
    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      actorEmail: user.email,
      action: lock ? 'auth.account_locked' : 'auth.login_failed',
      targetType: 'User',
      targetId: user.id,
      metadata: { failedLoginCount: count, locked: lock },
    });
  }

  // ---------------------------------------------------------------------------
  // MFA
  // ---------------------------------------------------------------------------

  async verifyMfa(mfaToken: string, code: string, meta: RequestMeta): Promise<{ user: AuthUser; tokens: IssuedTokens }> {
    const claims = this.tokens.verifyMfa(mfaToken);
    const user = await this.prisma.user.findFirst({ where: { id: claims.sub, deletedAt: null } });
    if (!user || !user.mfaEnabled || !user.mfaSecretEnc) throw new UnauthorizedException('MFA is not enabled');

    const ok = await this.checkMfaCode(user, code);
    if (!ok) {
      await this.audit.record({
        tenantId: user.tenantId,
        actorId: user.id,
        actorEmail: user.email,
        action: 'auth.mfa_failed',
        targetType: 'User',
        targetId: user.id,
      });
      throw new UnauthorizedException('Invalid verification code');
    }
    return this.issueSession(user.id, meta, 'mfa');
  }

  /** Validates a TOTP code or consumes a recovery code. */
  private async checkMfaCode(user: User, code: string): Promise<boolean> {
    const normalized = code.replace(/\s+/g, '').toUpperCase();
    if (/^\d{6}$/.test(normalized) && user.mfaSecretEnc) {
      const secret = decrypt(user.mfaSecretEnc, this.config.encryptionKey);
      if (authenticator.check(normalized, secret)) return true;
    }
    // Recovery codes are stored as argon2 hashes; consume on match.
    for (const hashed of user.mfaRecoveryCodes) {
      if (await verifyPassword(hashed, normalized)) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { mfaRecoveryCodes: user.mfaRecoveryCodes.filter((h) => h !== hashed) },
        });
        await this.audit.record({
          tenantId: user.tenantId,
          actorId: user.id,
          actorEmail: user.email,
          action: 'auth.recovery_code_used',
          targetType: 'User',
          targetId: user.id,
          metadata: { remaining: user.mfaRecoveryCodes.length - 1 },
        });
        return true;
      }
    }
    return false;
  }

  async mfaSetup(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.prisma.user.findFirstOrThrow({ where: { id: userId, deletedAt: null } });
    if (user.mfaEnabled) throw new BadRequestException('MFA is already enabled; disable it before re-enrolling');
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecretEnc: encrypt(secret, this.config.encryptionKey) },
    });
    await this.audit.record({ action: 'auth.mfa_setup_started', targetType: 'User', targetId: userId });
    return { secret, otpauthUrl: authenticator.keyuri(user.email, 'BDO AuditSphere', secret) };
  }

  async mfaEnable(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const user = await this.prisma.user.findFirstOrThrow({ where: { id: userId, deletedAt: null } });
    if (user.mfaEnabled) throw new BadRequestException('MFA is already enabled');
    if (!user.mfaSecretEnc) throw new BadRequestException('Run MFA setup first');
    const secret = decrypt(user.mfaSecretEnc, this.config.encryptionKey);
    if (!authenticator.check(code.replace(/\s+/g, ''), secret)) throw new BadRequestException('Invalid verification code');

    const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () => randomRecoveryCode());
    const hashes = await Promise.all(recoveryCodes.map((c) => hashPassword(c)));
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, mfaRecoveryCodes: hashes },
    });
    this.userAccess.invalidate(userId);
    await this.audit.record({ action: 'auth.mfa_enabled', targetType: 'User', targetId: userId });
    return { recoveryCodes };
  }

  async mfaDisable(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findFirstOrThrow({ where: { id: userId, deletedAt: null } });
    if (!user.mfaEnabled) throw new BadRequestException('MFA is not enabled');
    const ok = await this.checkMfaCode(user, code);
    if (!ok) throw new BadRequestException('Invalid verification code');
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecretEnc: null, mfaRecoveryCodes: [] },
    });
    this.userAccess.invalidate(userId);
    await this.audit.record({ action: 'auth.mfa_disabled', targetType: 'User', targetId: userId });
  }

  // ---------------------------------------------------------------------------
  // Sessions and refresh tokens
  // ---------------------------------------------------------------------------

  async issueSession(
    userId: string,
    meta: RequestMeta,
    method: string,
    family?: string,
  ): Promise<{ user: AuthUser; tokens: IssuedTokens }> {
    const user = await this.userAccess.load(userId, { fresh: true });
    if (!user) throw new UnauthorizedException('User not found');

    const refresh = randomToken(48);
    await this.prisma.refreshToken.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        tokenHash: sha256(refresh),
        family: family ?? uuidv4(),
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ip ?? null,
        expiresAt: new Date(Date.now() + this.config.jwt.refreshTtlMs),
      },
    });
    const access = this.tokens.signAccess({ sub: user.id, tid: user.tenantId, email: user.email, roles: user.roles });

    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      actorEmail: user.email,
      action: 'auth.login',
      targetType: 'User',
      targetId: user.id,
      metadata: { method },
    });
    return { user, tokens: { access, refresh } };
  }

  async refresh(rawToken: string | undefined, meta: RequestMeta): Promise<{ user: AuthUser; tokens: IssuedTokens }> {
    if (!rawToken) throw new UnauthorizedException('No refresh token');
    const tokenHash = sha256(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!existing) throw new UnauthorizedException('Invalid refresh token');

    const now = new Date();
    if (existing.revokedAt) {
      // Reuse of a rotated token: someone replayed it. Kill the whole family.
      await this.prisma.refreshToken.updateMany({
        where: { family: existing.family, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.audit.record({
        tenantId: existing.tenantId,
        actorId: existing.userId,
        action: 'auth.refresh_reuse_detected',
        targetType: 'RefreshToken',
        targetId: existing.id,
        metadata: { family: existing.family },
      });
      throw new UnauthorizedException('Refresh token reuse detected; session revoked');
    }
    if (existing.expiresAt <= now) throw new UnauthorizedException('Refresh token expired');

    const user = await this.userAccess.load(existing.userId, { fresh: true });
    if (!user || user.status !== 'ACTIVE' || !user.tenant.isActive) throw new UnauthorizedException('Session is no longer valid');

    const nextRaw = randomToken(48);
    const next = await this.prisma.refreshToken.create({
      data: {
        tenantId: existing.tenantId,
        userId: existing.userId,
        tokenHash: sha256(nextRaw),
        family: existing.family,
        userAgent: meta.userAgent ?? existing.userAgent,
        ipAddress: meta.ip ?? existing.ipAddress,
        expiresAt: new Date(now.getTime() + this.config.jwt.refreshTtlMs),
      },
    });
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: now, replacedBy: next.id },
    });
    const access = this.tokens.signAccess({ sub: user.id, tid: user.tenantId, email: user.email, roles: user.roles });
    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      actorEmail: user.email,
      action: 'auth.refresh',
      targetType: 'RefreshToken',
      targetId: next.id,
    });
    return { user, tokens: { access, refresh: nextRaw } };
  }

  async logout(rawToken: string | undefined, actor: AuthUser | undefined): Promise<void> {
    if (rawToken) {
      const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
      if (existing && !existing.revokedAt) {
        await this.prisma.refreshToken.updateMany({
          where: { family: existing.family, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      if (existing) {
        await this.audit.record({
          tenantId: existing.tenantId,
          actorId: existing.userId,
          actorEmail: actor?.email ?? null,
          action: 'auth.logout',
          targetType: 'User',
          targetId: existing.userId,
        });
        return;
      }
    }
    if (actor) {
      await this.audit.record({ action: 'auth.logout', targetType: 'User', targetId: actor.id });
    }
  }

  async revokeAllSessions(userId: string, exceptRawToken?: string) {
    const keepFamily = exceptRawToken
      ? (await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(exceptRawToken) } }))?.family
      : undefined;
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null, ...(keepFamily ? { family: { not: keepFamily } } : {}) },
      data: { revokedAt: new Date() },
    });
  }

  // ---------------------------------------------------------------------------
  // Password
  // ---------------------------------------------------------------------------

  async changePassword(userId: string, currentPassword: string, newPassword: string, currentRefreshToken?: string) {
    const user = await this.prisma.user.findFirstOrThrow({ where: { id: userId, deletedAt: null } });
    if (user.authProvider !== 'LOCAL') throw new BadRequestException('Password is managed by your identity provider');
    const ok = await verifyPassword(user.passwordHash, currentPassword);
    if (!ok) throw new BadRequestException('Current password is incorrect');
    if (currentPassword === newPassword) throw new BadRequestException('New password must differ from the current one');
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword), failedLoginCount: 0, lockedUntil: null },
    });
    await this.revokeAllSessions(userId, currentRefreshToken);
    await this.audit.record({ action: 'auth.password_changed', targetType: 'User', targetId: userId });
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.userAccess.load(userId);
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }
}
