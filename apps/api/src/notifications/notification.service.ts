import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@auditsphere/db';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenancy/tenant-context';
import { MailService } from './mail.service';

export interface NotifyInput {
  type: string;
  title: string;
  body?: string;
  link?: string;
  payload?: Record<string, unknown>;
  /** Required when called outside a request (jobs). */
  tenantId?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: TenantContext,
    private readonly mail: MailService,
    private readonly config: AppConfigService,
  ) {}

  async notify(userId: string | null | undefined, input: NotifyInput): Promise<void> {
    if (!userId) return;
    const tenantId = input.tenantId ?? this.ctx.tenantIdOrNull;
    if (!tenantId) {
      this.logger.warn(`Notification ${input.type} dropped: no tenant`);
      return;
    }
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
      select: { id: true, email: true, displayName: true, status: true },
    });
    if (!user || user.status === 'DEACTIVATED') return;

    const notification = await this.prisma.notification.create({
      data: {
        tenantId,
        userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        channel: 'IN_APP',
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
      },
    });

    if (this.mail.enabled && user.email) {
      const link = input.link ? `${this.config.api.webBaseUrl}${input.link}` : this.config.api.webBaseUrl;
      const sent = await this.mail.send({
        to: user.email,
        subject: `[AuditSphere] ${input.title}`,
        text: `${input.body ?? input.title}\n\nOpen: ${link}`,
        html: `<p>${escapeHtml(input.body ?? input.title)}</p><p><a href="${link}">Open in AuditSphere</a></p>`,
      });
      if (sent) {
        await this.prisma.notification.update({ where: { id: notification.id }, data: { sentAt: new Date() } });
      }
    }
  }

  async notifyMany(userIds: Array<string | null | undefined>, input: NotifyInput): Promise<void> {
    const unique = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
    await Promise.all(unique.map((id) => this.notify(id, input)));
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}
