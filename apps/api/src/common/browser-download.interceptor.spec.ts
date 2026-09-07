import { ExecutionContext, StreamableFile } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { BrowserDownloadInterceptor } from './browser-download.interceptor';

function fixture(mode?: string) {
  const response = { vary: jest.fn(), setHeader: jest.fn(), removeHeader: jest.fn() };
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { 'x-download-mode': mode } }),
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
  const run = (data: unknown) => lastValueFrom(new BrowserDownloadInterceptor().intercept(context, { handle: () => of(data) }));
  return { response, run };
}

describe('BrowserDownloadInterceptor', () => {
  it('preserves the stream and filename while avoiding a named network attachment in browser mode', async () => {
    const { response, run } = fixture('browser');
    const buffer = Buffer.from('%PDF-1.3\nTest bytes\n%%EOF');
    const file = new StreamableFile(buffer, { type: 'application/pdf', disposition: 'attachment; filename="report.pdf"', length: buffer.length });
    const result = await run(file) as StreamableFile;
    expect(result.getStream()).toBe(file.getStream());
    expect(result.errorHandler).toBe(file.errorHandler);
    expect(result.errorLogger).toBe(file.errorLogger);
    expect(result.getHeaders()).toEqual({ type: 'application/pdf', length: buffer.length, disposition: undefined });
    expect(response.setHeader).toHaveBeenCalledWith('X-Download-Disposition', 'attachment; filename="report.pdf"');
    expect(response.removeHeader).toHaveBeenCalledWith('Content-Disposition');
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
    expect(response.vary).toHaveBeenCalledWith('X-Download-Mode');
    expect(file.getHeaders().type).toBe('application/pdf');
    const chunks: Buffer[] = [];
    for await (const chunk of result.getStream()) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks)).toEqual(buffer);
  });

  it('keeps direct download headers unchanged', async () => {
    const { response, run } = fixture();
    const file = new StreamableFile(Buffer.from('data'), { disposition: 'attachment; filename="report.csv"' });
    expect(await run(file)).toBe(file);
    expect(response.setHeader).not.toHaveBeenCalled();
    expect(response.vary).toHaveBeenCalledWith('X-Download-Mode');
  });

  it('does not alter JSON responses', async () => {
    const { response, run } = fixture('browser');
    const data = { id: 'document', status: 'uploaded' };
    expect(await run(data)).toBe(data);
    expect(response.setHeader).not.toHaveBeenCalled();
    expect(response.vary).not.toHaveBeenCalled();
  });
});
