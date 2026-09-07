import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../config/app-config.service';
import { AccessTokenClaims, EntraStateClaims, MfaTokenClaims } from './auth.types';

const MFA_TTL_SECONDS = 5 * 60;
const ENTRA_STATE_TTL_SECONDS = 10 * 60;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  signAccess(claims: AccessTokenClaims): string {
    return this.jwt.sign(claims, {
      secret: this.config.jwt.accessSecret,
      expiresIn: Math.floor(this.config.jwt.accessTtlMs / 1000),
      issuer: 'auditsphere',
      audience: 'auditsphere-api',
    });
  }

  verifyAccess(token: string): AccessTokenClaims {
    const claims = this.jwt.verify<AccessTokenClaims>(token, {
      secret: this.config.jwt.accessSecret,
      issuer: 'auditsphere',
      audience: 'auditsphere-api',
    });
    if (claims.purpose) throw new UnauthorizedException('Invalid token type');
    return claims;
  }

  signMfa(claims: Omit<MfaTokenClaims, 'purpose'>): string {
    return this.jwt.sign(
      { ...claims, purpose: 'mfa' },
      { secret: this.config.jwt.accessSecret, expiresIn: MFA_TTL_SECONDS, issuer: 'auditsphere' },
    );
  }

  verifyMfa(token: string): MfaTokenClaims {
    let claims: MfaTokenClaims;
    try {
      claims = this.jwt.verify<MfaTokenClaims>(token, { secret: this.config.jwt.accessSecret, issuer: 'auditsphere' });
    } catch {
      throw new UnauthorizedException('MFA challenge expired, sign in again');
    }
    if (claims.purpose !== 'mfa') throw new UnauthorizedException('Invalid MFA token');
    return claims;
  }

  signEntraState(claims: Omit<EntraStateClaims, 'purpose'>): string {
    return this.jwt.sign(
      { ...claims, purpose: 'entra' },
      { secret: this.config.jwt.accessSecret, expiresIn: ENTRA_STATE_TTL_SECONDS, issuer: 'auditsphere' },
    );
  }

  verifyEntraState(token: string): EntraStateClaims {
    let claims: EntraStateClaims;
    try {
      claims = this.jwt.verify<EntraStateClaims>(token, { secret: this.config.jwt.accessSecret, issuer: 'auditsphere' });
    } catch {
      throw new UnauthorizedException('Sign-in session expired, start again');
    }
    if (claims.purpose !== 'entra') throw new UnauthorizedException('Invalid sign-in state');
    return claims;
  }
}
