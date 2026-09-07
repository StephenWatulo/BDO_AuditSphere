import { Controller, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CurrentUser } from '../common/decorators';
import { paginate, PaginationDto } from '../common/pagination';
import { ToBoolean } from '../common/utils';
import { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

export class NotificationQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Only unread notifications' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  unread?: boolean;
}

@ApiTags('notifications')
@ApiCookieAuth('as_access')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'My notifications' })
  async list(@CurrentUser() user: AuthUser, @Query() query: NotificationQueryDto) {
    const db = this.prisma.scoped();
    const where = { userId: user.id, ...(query.unread ? { readAt: null } : {}) };
    const result = await paginate(
      query,
      () => db.notification.count({ where }),
      (p) => db.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...p }),
    );
    const unreadCount = await db.notification.count({ where: { userId: user.id, readAt: null } });
    return { ...result, unreadCount };
  }

  @Post(':id/read')
  @HttpCode(204)
  @ApiOperation({ summary: 'Mark one notification as read' })
  async markRead(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const db = this.prisma.scoped();
    const result = await db.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
    if (result.count === 0) {
      const exists = await db.notification.count({ where: { id, userId: user.id } });
      if (!exists) throw new NotFoundException('Notification not found');
    }
  }

  @Post('read-all')
  @HttpCode(204)
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  async markAllRead(@CurrentUser() user: AuthUser) {
    await this.prisma.scoped().notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  }
}
