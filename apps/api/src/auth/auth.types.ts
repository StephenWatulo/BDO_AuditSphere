import type { AuthProvider, RoleKey, UserStatus } from '@auditsphere/db';

/** The `user` shape from the API contract, plus what guards need. */
export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  authProvider: AuthProvider;
  mfaEnabled: boolean;
  /** True for audit-function users who have not enrolled in MFA yet. */
  mfaRequiredToEnrol: boolean;
  roles: RoleKey[];
  permissions: string[];
  tenant: { id: string; slug: string; name: string; isActive: boolean };
}

export interface AccessTokenClaims {
  sub: string;
  tid: string;
  email: string;
  roles: RoleKey[];
  purpose?: undefined;
}

export interface MfaTokenClaims {
  sub: string;
  tid: string;
  purpose: 'mfa';
}

export interface EntraStateClaims {
  purpose: 'entra';
  state: string;
  verifier: string;
  nonce: string;
  returnTo: string;
}

export interface IssuedTokens {
  access: string;
  refresh: string;
}

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

export type LoginResult =
  | { kind: 'session'; user: AuthUser; tokens: IssuedTokens }
  | { kind: 'mfa'; mfaToken: string };
