import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@auditsphere/db';
import { TenantContext } from '../tenancy/tenant-context';
import { createTenantClient, TenantClient, TenantTx } from './tenant-extension';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly tenantClients = new Map<string, TenantClient>();
  private connected = false;

  constructor(private readonly ctx: TenantContext) {
    super({
      log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.connected = true;
    } catch (err) {
      // Do not crash boot: /ready reports the database state and the app can be
      // inspected (Swagger, health) without a database.
      this.logger.error(`Database connection failed: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  get isConnected() {
    return this.connected;
  }

  /** Returns a client whose every query is scoped to `tenantId`. */
  forTenant(tenantId: string): TenantClient {
    let client = this.tenantClients.get(tenantId);
    if (!client) {
      client = createTenantClient(this as unknown as PrismaClient, tenantId);
      this.tenantClients.set(tenantId, client);
    }
    return client;
  }

  /**
   * Tenant-scoped client for the current request context. (Named `scoped`
   * rather than `tenant` because `PrismaClient.tenant` is the Tenant model
   * delegate.)
   */
  scoped(): TenantClient {
    return this.forTenant(this.ctx.tenantId);
  }

  /**
   * Interactive transaction on the tenant-scoped client. Sets
   * `app.tenant_id` for the transaction so Postgres RLS policies apply too.
   */
  async transaction<T>(fn: (tx: TenantTx) => Promise<T>, tenantId?: string): Promise<T> {
    const tid = tenantId ?? this.ctx.tenantId;
    if (!UUID_RE.test(tid)) throw new Error('Invalid tenant id');
    const client = this.forTenant(tid);
    return client.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT set_config('app.tenant_id', ${tid}, true)`);
      return fn(tx as unknown as TenantTx);
    });
  }

  async ping(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      this.connected = true;
      return true;
    } catch {
      this.connected = false;
      return false;
    }
  }
}
