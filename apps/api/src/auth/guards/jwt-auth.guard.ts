import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  ALLOW_DURING_MFA_ENROLMENT_KEY,
  ALLOW_DURING_PASSWORD_CHANGE_KEY,
  IS_PUBLIC_KEY,
} from '../../common/decorators';
import { TenantContext } from '../../tenancy/tenant-context';
import { AccessTokenClaims } from '../auth.types';
import { extractAccessToken } from '../cookies';
import { TokenService } from '../token.service';
import { UserAccessService } from '../user-access.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly userAccess: UserAccessService,
    private readonly ctx: TenantContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    const allowDuringPasswordChange = this.reflector.getAllAndOverride<boolean>(ALLOW_DURING_PASSWORD_CHANGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const allowDuringMfaEnrolment = this.reflector.getAllAndOverride<boolean>(ALLOW_DURING_MFA_ENROLMENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const token = extractAccessToken(req);

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Authentication required');
    }

    let claims: AccessTokenClaims;
    try {
      claims = this.tokens.verifyAccess(token);
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException('Session is invalid or has expired');
    }

    const user = await this.userAccess.load(claims.sub);
    if (!user || user.status !== 'ACTIVE' || !user.tenant.isActive || user.tenantId !== claims.tid) {
      if (isPublic) return true;
      throw new UnauthorizedException('Session is no longer valid');
    }

    req.user = user;
    this.ctx.bindUser(user);
    if (!isPublic && user.mustChangePassword && !allowDuringPasswordChange) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'You must replace the temporary password before continuing',
      });
    }
    if (!isPublic && user.mfaRequiredToEnrol && !allowDuringMfaEnrolment) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'MFA_ENROLMENT_REQUIRED',
        message: 'You must enrol two-step verification before continuing',
      });
    }
    return true;
  }
}
