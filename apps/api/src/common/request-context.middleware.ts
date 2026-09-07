import type { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { TenantContext } from '../tenancy/tenant-context';

const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * Assigns a request id (honouring an incoming `x-request-id` when well formed),
 * echoes it on the response and opens the AsyncLocalStorage context that the
 * rest of the pipeline reads from.
 */
export function requestContextMiddleware(ctx: TenantContext) {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.headers['x-request-id'];
    const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
    const requestId = candidate && REQUEST_ID_RE.test(candidate) ? candidate : uuidv4();
    req.headers['x-request-id'] = requestId;
    (req as Request & { id?: string }).id = requestId;
    res.setHeader('x-request-id', requestId);

    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()) || req.ip || req.socket.remoteAddress || undefined;

    ctx.run(
      {
        requestId,
        ip,
        userAgent: req.headers['user-agent'],
        roles: [],
        permissions: [],
      },
      () => next(),
    );
  };
}
