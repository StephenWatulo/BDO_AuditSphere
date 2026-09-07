import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { ChildProcess, fork, ForkOptions } from 'node:child_process';

export const MAX_CONTEXT_BYTES = 10 * 1024 * 1024;
export const MAX_CONTEXT_CHARACTERS = 12000;
export const MAX_CONTEXT_DOCUMENTS = 5;
const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain', '.csv': 'text/csv', '.md': 'text/markdown',
};

@Injectable()
export class ContextExtractorService {
  private active = 0;

  async extract(file: { originalname: string; buffer: Buffer }) {
    const extension = extname(file.originalname).toLowerCase();
    const mimeType = MIME_TYPES[extension];
    if (!mimeType) throw new BadRequestException('Supported context files: PDF, DOCX, XLSX, TXT, CSV and MD.');
    if (!file.buffer?.length) throw new BadRequestException('File is empty.');
    if (file.buffer.length > MAX_CONTEXT_BYTES) throw new BadRequestException('Context documents must be 10 MB or smaller.');
    if (this.active >= 2) throw new ServiceUnavailableException('Document processing is busy. Please try again shortly.');
    this.active++;
    let worker: ChildProcess | undefined;
    let timer: NodeJS.Timeout | undefined;
    try {
      const compiled = join(__dirname, 'context-extractor.process.js');
      const compiledExists = existsSync(compiled);
      // Native document parsers run outside the API process, with bounded time and heap.
      const options: ForkOptions & { windowsHide: boolean } = {
        execArgv: ['--max-old-space-size=256', ...(compiledExists ? [] : ['-r', require.resolve('ts-node/register/transpile-only')])],
        serialization: 'advanced',
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        windowsHide: true,
      };
      worker = fork(compiledExists ? compiled : join(__dirname, 'context-extractor.process.ts'), [], options);
      const result = await new Promise<{ text: string; truncated: boolean }>((resolve, reject) => {
        timer = setTimeout(() => reject(new BadRequestException('Document processing timed out. Try a smaller document.')), 60000);
        worker!.once('message', (message: { result?: { text: string; truncated: boolean }; error?: string }) => {
          if (message.result) resolve(message.result);
          else reject(new BadRequestException(message.error ?? 'Document text could not be extracted.'));
        });
        worker!.once('error', () => reject(new BadRequestException('The document could not be processed within the allowed limits.')));
        worker!.once('exit', (code) => reject(new BadRequestException(`Document processing stopped (${code}). Try a smaller document.`)));
        worker!.send({ extension, buffer: file.buffer, maxCharacters: MAX_CONTEXT_CHARACTERS }, (error) => {
          if (error) reject(new BadRequestException('Document processing could not start. Please try again.'));
        });
      });
      return { ...result, mimeType };
    } finally {
      if (timer) clearTimeout(timer);
      worker?.kill();
      this.active--;
    }
  }
}
