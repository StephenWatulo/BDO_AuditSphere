import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { ObjectStat, PresignedDownload, PresignedUpload, STORAGE_DRIVER, StorageDriver } from './storage.driver';

/** Facade over the configured driver so domain code never sees driver details. */
@Injectable()
export class StorageService implements OnModuleInit {
  private initialised = false;

  constructor(@Inject(STORAGE_DRIVER) private readonly driver: StorageDriver) {}

  async onModuleInit() {
    try {
      await this.driver.init();
      this.initialised = true;
    } catch {
      this.initialised = false;
    }
  }

  get driverName() {
    return this.driver.name;
  }
  get isLocal() {
    return this.driver.name === 'local';
  }
  get isInitialised() {
    return this.initialised;
  }

  healthCheck(): Promise<boolean> {
    return this.driver.healthCheck();
  }
  presignUpload(input: { key: string; documentId: string; mimeType: string; sizeBytes: number }): Promise<PresignedUpload> {
    return this.driver.presignUpload(input);
  }
  presignDownload(input: { key: string; documentId: string; fileName: string; mimeType: string }): Promise<PresignedDownload> {
    return this.driver.presignDownload(input);
  }
  putObject(key: string, body: Buffer, mimeType: string): Promise<void> {
    return this.driver.putObject(key, body, mimeType);
  }
  getObject(key: string): Promise<Readable> {
    return this.driver.getObject(key);
  }
  deleteObject(key: string): Promise<void> {
    return this.driver.deleteObject(key);
  }
  stat(key: string): Promise<ObjectStat | null> {
    return this.driver.stat(key);
  }
}
