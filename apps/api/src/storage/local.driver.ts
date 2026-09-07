import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Readable } from 'node:stream';
import { AppConfigService } from '../config/app-config.service';
import {
  assertValidKey,
  ObjectStat,
  PRESIGN_TTL_SECONDS,
  PresignedDownload,
  PresignedUpload,
  StorageDriver,
} from './storage.driver';

/**
 * Filesystem driver for local development. Uploads and downloads go through the
 * API (`PUT/GET /documents/:id/content`) so no object store is needed.
 */
@Injectable()
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local' as const;
  private readonly logger = new Logger(LocalStorageDriver.name);
  private readonly root: string;

  constructor(private readonly config: AppConfigService) {
    this.root = config.storage.localDir;
  }

  async init(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    this.logger.log(`Local storage at ${this.root}`);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await access(this.root);
      return true;
    } catch {
      return false;
    }
  }

  private path(key: string): string {
    assertValidKey(key);
    return join(this.root, ...key.split('/'));
  }

  private contentUrl(documentId: string): string {
    return `${this.config.api.baseUrl}/api/v1/documents/${documentId}/content`;
  }

  async presignUpload(input: { key: string; documentId: string; mimeType: string; sizeBytes: number }): Promise<PresignedUpload> {
    assertValidKey(input.key);
    return {
      url: this.contentUrl(input.documentId),
      method: 'PUT',
      headers: { 'Content-Type': input.mimeType || 'application/octet-stream' },
      expiresAt: new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000),
    };
  }

  async presignDownload(input: { key: string; documentId: string }): Promise<PresignedDownload> {
    assertValidKey(input.key);
    return { url: this.contentUrl(input.documentId), expiresAt: new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000) };
  }

  async putObject(key: string, body: Buffer): Promise<void> {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body);
  }

  async getObject(key: string): Promise<Readable> {
    const p = this.path(key);
    await access(p);
    return createReadStream(p);
  }

  async deleteObject(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }

  async stat(key: string): Promise<ObjectStat | null> {
    const p = this.path(key);
    try {
      const s = await stat(p);
      const checksum = await new Promise<string>((resolve, reject) => {
        const h = createHash('sha256');
        createReadStream(p)
          .on('data', (chunk) => h.update(chunk))
          .on('end', () => resolve(h.digest('hex')))
          .on('error', reject);
      });
      return { sizeBytes: s.size, checksumSha256: checksum };
    } catch {
      return null;
    }
  }
}
