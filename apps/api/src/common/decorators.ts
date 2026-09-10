import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';

export const IS_PUBLIC_KEY = 'auditsphere:isPublic';
export const REQUIRE_PERMISSION_KEY = 'auditsphere:requirePermission';
export const ALLOW_DURING_PASSWORD_CHANGE_KEY = 'auditsphere:allowDuringPasswordChange';
export const ALLOW_DURING_MFA_ENROLMENT_KEY = 'auditsphere:allowDuringMfaEnrolment';

/** Opt a route out of the global JWT guard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Allow a signed-in user with a temporary password to call this route. */
export const AllowDuringPasswordChange = () => SetMetadata(ALLOW_DURING_PASSWORD_CHANGE_KEY, true);

/** Allow a signed-in local user who still has to enrol MFA to call this route. */
export const AllowDuringMfaEnrolment = () => SetMetadata(ALLOW_DURING_MFA_ENROLMENT_KEY, true);

/** Require ANY of the given permission keys. */
export const RequirePermission = (...keys: string[]) => SetMetadata(REQUIRE_PERMISSION_KEY, keys);

export const CurrentUser = createParamDecorator((data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  const user = req.user as AuthUser | undefined;
  return data && user ? user[data] : user;
});
