import { Injectable, Logger } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

@Injectable()
export class S3StorageDriver implements StorageDriver {
  readonly name = 's3' as const;
  private readonly logger = new Logger(S3StorageDriver.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: AppConfigService) {
    const s3 = config.storage.s3;
    this.bucket = s3.bucket;
    this.client = new S3Client({
      region: s3.region,
      endpoint: s3.endpoint || undefined,
      forcePathStyle: s3.forcePathStyle,
      credentials: s3.accessKey ? { accessKeyId: s3.accessKey, secretAccessKey: s3.secretKey } : undefined,
    });
  }

  async init(): Promise<void> {
    const ok = await this.healthCheck();
    if (ok) this.logger.log(`S3 storage bucket ${this.bucket} reachable`);
    else this.logger.warn(`S3 bucket ${this.bucket} is not reachable; /ready will report storage down`);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }

  async presignUpload(input: { key: string; mimeType: string; sizeBytes: number }): Promise<PresignedUpload> {
    assertValidKey(input.key);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      ContentType: input.mimeType,
      ContentLength: input.sizeBytes,
      ServerSideEncryption: 'AES256',
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: PRESIGN_TTL_SECONDS });
    return {
      url,
      method: 'PUT',
      headers: { 'Content-Type': input.mimeType, 'x-amz-server-side-encryption': 'AES256' },
      expiresAt: new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000),
    };
  }

  async presignDownload(input: { key: string; fileName: string; mimeType: string }): Promise<PresignedDownload> {
    assertValidKey(input.key);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(input.fileName)}"`,
      ResponseContentType: input.mimeType,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: PRESIGN_TTL_SECONDS });
    return { url, expiresAt: new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000) };
  }

  async putObject(key: string, body: Buffer, mimeType: string): Promise<void> {
    assertValidKey(key);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: mimeType, ServerSideEncryption: 'AES256' }),
    );
  }

  async getObject(key: string): Promise<Readable> {
    assertValidKey(key);
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return res.Body as Readable;
  }

  async deleteObject(key: string): Promise<void> {
    assertValidKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async stat(key: string): Promise<ObjectStat | null> {
    assertValidKey(key);
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { sizeBytes: Number(res.ContentLength ?? 0) };
    } catch {
      return null;
    }
  }
}
