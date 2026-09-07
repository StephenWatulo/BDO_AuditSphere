import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import type { Request, Response } from 'express';
import { map } from 'rxjs';

@Injectable()
export class BrowserDownloadInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    return next.handle().pipe(map((data: unknown) => {
      if (!(data instanceof StreamableFile)) return data;
      response.vary('X-Download-Mode');
      if (request.headers['x-download-mode'] === 'browser') {
        // Download managers can consume attachment responses before fetch receives
        // them. The app applies the filename after receiving the unchanged bytes.
        const { type, disposition, length } = data.getHeaders();
        if (disposition) response.setHeader('X-Download-Disposition', disposition);
        response.removeHeader('Content-Disposition');
        response.setHeader('Cache-Control', 'private, no-store');
        return new StreamableFile(data.getStream(), { type, length })
          .setErrorHandler(data.errorHandler)
          .setErrorLogger(data.errorLogger);
      }
      return data;
    }));
  }
}
