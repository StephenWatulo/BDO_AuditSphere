import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@auditsphere/db';
import type { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  requestId: string | null;
  guards?: { guard: string; message: string }[];
}

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = (res.getHeader('x-request-id') as string | undefined) ?? (req.headers['x-request-id'] as string) ?? null;

    const body = this.toBody(exception, requestId);
    if (body.statusCode >= 500) {
      this.logger.error(
        `${req.method} ${req.url} -> ${body.statusCode} ${(exception as Error)?.message ?? ''}`,
        (exception as Error)?.stack,
      );
    }
    if (res.headersSent) return;
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown, requestId: string | null): ErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const base: ErrorBody = {
        statusCode: status,
        error: STATUS_TEXT[status] ?? exception.name,
        message: exception.message,
        requestId,
      };
      if (typeof response === 'string') {
        base.message = response;
      } else if (response && typeof response === 'object') {
        const r = response as Record<string, unknown>;
        if (r.message !== undefined) base.message = r.message as string | string[];
        if (typeof r.error === 'string') base.error = r.error;
        if (Array.isArray(r.guards)) base.guards = r.guards as ErrorBody['guards'];
      }
      return base;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.prismaBody(exception, requestId);
    }
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: STATUS_TEXT[400],
        message: 'Invalid query or payload',
        requestId,
      };
    }
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: STATUS_TEXT[503],
        message: 'Database unavailable',
        requestId,
      };
    }
    // multer / body-parser style errors carry `status`
    const anyErr = exception as { status?: number; statusCode?: number; message?: string; type?: string };
    const status = anyErr?.status ?? anyErr?.statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return { statusCode: status, error: STATUS_TEXT[status] ?? 'Error', message: anyErr.message ?? 'Request error', requestId };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: STATUS_TEXT[500],
      message: 'Internal server error',
      requestId,
    };
  }

  private prismaBody(e: Prisma.PrismaClientKnownRequestError, requestId: string | null): ErrorBody {
    switch (e.code) {
      case 'P2002': {
        const target = (e.meta?.target as string[] | string | undefined) ?? [];
        const fields = Array.isArray(target) ? target.join(', ') : String(target);
        return {
          statusCode: 409,
          error: STATUS_TEXT[409],
          message: fields ? `A record with the same ${fields} already exists` : 'Duplicate record',
          requestId,
        };
      }
      case 'P2025':
        return { statusCode: 404, error: STATUS_TEXT[404], message: 'Record not found', requestId };
      case 'P2003':
        return {
          statusCode: 409,
          error: STATUS_TEXT[409],
          message: 'Operation violates a reference to another record',
          requestId,
        };
      default:
        return { statusCode: 500, error: STATUS_TEXT[500], message: 'Database error', requestId };
    }
  }
}
