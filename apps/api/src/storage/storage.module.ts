import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { LocalStorageDriver } from './local.driver';
import { S3StorageDriver } from './s3.driver';
import { STORAGE_DRIVER } from './storage.driver';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_DRIVER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        config.storage.driver === 's3' ? new S3StorageDriver(config) : new LocalStorageDriver(config),
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
