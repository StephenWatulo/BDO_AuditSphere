import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const startedAt = Date.now();

@ApiTags('operational')
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe (always 200)' })
  health() {
    return { status: 'ok', uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000), timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe: database and storage' })
  async ready() {
    const [database, storage] = await Promise.all([this.prisma.ping(), this.storage.healthCheck()]);
    const body = {
      status: database && storage ? 'ready' : 'degraded',
      checks: { database: database ? 'up' : 'down', storage: storage ? 'up' : 'down', storageDriver: this.storage.driverName },
      timestamp: new Date().toISOString(),
    };
    if (!database || !storage) throw new ServiceUnavailableException(body);
    return body;
  }
}
