import type { Readable } from 'node:stream';

export interface PresignedUpload {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface PresignedDownload {
  url: string;
  expiresAt: Date;
}

export interface ObjectStat {
  sizeBytes: number;
  checksumSha256?: string;
}

export interface StorageDriver {
  readonly name: 'local' | 's3';
  init(): Promise<void>;
  healthCheck(): Promise<boolean>;
  presignUpload(input: { key: string; documentId: string; mimeType: string; sizeBytes: number }): Promise<PresignedUpload>;
  presignDownload(input: { key: string; documentId: string; fileName: string; mimeType: string }): Promise<PresignedDownload>;
  putObject(key: string, body: Buffer, mimeType: string): Promise<void>;
  getObject(key: string): Promise<Readable>;
  deleteObject(key: string): Promise<void>;
  stat(key: string): Promise<ObjectStat | null>;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');
export const PRESIGN_TTL_SECONDS = 300;

const KEY_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}$/i;

/** Storage keys are `<tenantId>/<uuid>`; anything else is rejected to prevent traversal. */
export function assertValidKey(key: string): void {
  if (!KEY_RE.test(key)) throw new Error(`Invalid storage key: ${key}`);
}
