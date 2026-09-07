import { BadRequestException, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { RoleKey } from '@auditsphere/db';
import { ROLE_KEYS, ROLE_LABELS } from '@auditsphere/shared';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { AuthUser, IssuedTokens, RequestMeta } from './auth.types';
import { TokenService } from './token.service';

type Oidc = typeof import('openid-client');

const DEFAULT_ENTRA_ROLE: RoleKey = 'BUSINESS_OWNER';

interface EntraClaims {
  sub?: string;
  oid?: string;
  tid?: string;
  email?: string;
  preferred_username?: string;
  upn?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
}

/**
 * Microsoft Entra ID sign-in via OpenID Connect authorization code flow with
 * PKCE, implemented on openid-client v6. The library is ESM-only, so it is
 * loaded lazily on first use (Node >= 22 can `require` ESM without top-level
 * await, and lazy loading keeps unit tests free of it).
 */
@Injectable()
export class EntraService {
  private readonly logger = new Logger(EntraService.name);
  private oidc?: Oidc;
  private configuration?: import('openid-client').Configuration;

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly auth: AuthService,
    private readonly audit: AuditTrailService,
  ) {}

  get isConfigured(): boolean {
    return this.config.entra.configured;
  }

  private assertConfigured() {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'Microsoft Entra ID sign-in is not configured. Set ENTRA_TENANT_ID, ENTRA_CLIENT_ID and ENTRA_CLIENT_SECRET.',
      );
    }
  }

  private async lib(): Promise<Oidc> {
    if (!this.oidc) this.oidc = await import('openid-client');
    return this.oidc;
  }

  private async getConfiguration() {
    if (this.configuration) return this.configuration;
    const oidc = await this.lib();
    const { tenantId, clientId, clientSecret } = this.config.entra;
    const issuer = new URL(`https://login.microsoftonline.com/${tenantId}/v2.0`);
    this.configuration = await oidc.discovery(issuer, clientId, clientSecret);
    return this.configuration;
  }

  /** Builds the authorize URL and the signed state cookie value. */
  async start(returnTo?: string): Promise<{ url: string; stateCookie: string }> {
    this.assertConfigured();
    const oidc = await this.lib();
    const configuration = await this.getConfiguration();

    const verifier = oidc.randomPKCECodeVerifier();
    const challenge = await oidc.calculatePKCECodeChallenge(verifier);
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const safeReturnTo = sanitizeReturnTo(returnTo);

    const url = oidc.buildAuthorizationUrl(configuration, {
      redirect_uri: this.config.entra.redirectUri,
      scope: 'openid profile email offline_access',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      nonce,
      response_mode: 'query',
    });
    const stateCookie = this.tokens.signEntraState({ state, verifier, nonce, returnTo: safeReturnTo });
    return { url: url.href, stateCookie };
  }

  /** Exchanges the code, provisions the user and issues a session. */
  async callback(
    currentUrl: string,
    stateCookie: string | undefined,
    meta: RequestMeta,
  ): Promise<{ user: AuthUser; tokens: IssuedTokens; returnTo: string }> {
    this.assertConfigured();
    if (!stateCookie) throw new UnauthorizedException('Missing sign-in state; start the sign-in again');
    const state = this.tokens.verifyEntraState(stateCookie);
    const oidc = await this.lib();
    const configuration = await this.getConfiguration();

    let claims: EntraClaims;
    try {
      const tokenSet = await oidc.authorizationCodeGrant(configuration, new URL(currentUrl), {
        pkceCodeVerifier: state.verifier,
        expectedState: state.state,
        expectedNonce: state.nonce,
        idTokenExpected: true,
      });
      claims = (tokenSet.claims() ?? {}) as EntraClaims;
    } catch (err) {
      this.logger.warn(`Entra token exchange failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Microsoft sign-in failed');
    }

    const email = (claims.email ?? claims.preferred_username ?? claims.upn ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) throw new UnauthorizedException('Microsoft account has no usable email claim');
    const externalId = claims.oid ?? claims.sub ?? null;

    const user = await this.provisionUser({
      email,
      externalId,
      displayName: claims.name ?? email,
      firstName: claims.given_name ?? null,
      lastName: claims.family_name ?? null,
    });

    const session = await this.auth.issueSession(user.id, meta, 'entra');
    return { ...session, returnTo: state.returnTo };
  }

  private async provisionUser(input: {
    email: string;
    externalId: string | null;
    displayName: string;
    firstName: string | null;
    lastName: string | null;
  }) {
    const tenant = await this.resolveTenant();
    const existing = await this.prisma.user.findFirst({
      where: { tenantId: tenant.id, email: { equals: input.email, mode: 'insensitive' }, deletedAt: null },
    });
    const now = new Date();

    if (existing) {
      if (existing.status === 'SUSPENDED' || existing.status === 'DEACTIVATED') {
        throw new UnauthorizedException('Your account is not active');
      }
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          authProvider: 'ENTRA_ID',
          externalId: input.externalId ?? existing.externalId,
          status: 'ACTIVE',
          lastLoginAt: now,
          failedLoginCount: 0,
          lockedUntil: null,
          displayName: existing.displayName || input.displayName,
          firstName: existing.firstName ?? input.firstName,
          lastName: existing.lastName ?? input.lastName,
        },
      });
      return updated;
    }

    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const roleKey = normaliseRole(settings.entraDefaultRole) ?? DEFAULT_ENTRA_ROLE;
    const role = await this.prisma.role.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: roleKey } },
      update: {},
      create: { tenantId: tenant.id, key: roleKey, name: ROLE_LABELS[roleKey], isSystem: true },
    });
    const created = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: input.email,
        displayName: input.displayName,
        firstName: input.firstName,
        lastName: input.lastName,
        authProvider: 'ENTRA_ID',
        externalId: input.externalId,
        status: 'ACTIVE',
        lastLoginAt: now,
        roles: { create: { tenantId: tenant.id, roleId: role.id } },
      },
    });
    await this.audit.record({
      tenantId: tenant.id,
      actorId: created.id,
      actorEmail: created.email,
      action: 'user.provisioned',
      targetType: 'User',
      targetId: created.id,
      after: { email: created.email, role: roleKey, provider: 'ENTRA_ID' },
    });
    return created;
  }

  /**
   * Picks the tenant whose `settings.entraTenantId` matches ENTRA_TENANT_ID, or the
   * single active tenant when only one exists.
   */
  private async resolveTenant() {
    const byDirectory = await this.prisma.tenant.findFirst({
      where: { isActive: true, settings: { path: ['entraTenantId'], equals: this.config.entra.tenantId } },
    });
    if (byDirectory) return byDirectory;
    const active = await this.prisma.tenant.findMany({ where: { isActive: true }, take: 2 });
    if (active.length === 1) return active[0];
    throw new BadRequestException(
      'Cannot determine which tenant this Microsoft directory belongs to; set settings.entraTenantId on the tenant',
    );
  }
}

function normaliseRole(value: unknown): RoleKey | undefined {
  return typeof value === 'string' && (ROLE_KEYS as readonly string[]).includes(value) ? (value as RoleKey) : undefined;
}

/** Only relative paths on the web app are honoured; anything else falls back to `/`. */
export function sanitizeReturnTo(value: string | undefined): string {
  if (!value) return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  if (/[\r\n]/.test(value)) return '/';
  return value;
}
