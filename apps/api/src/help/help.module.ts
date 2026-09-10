import { Controller, Get, Header, Injectable, Module, Query, StreamableFile } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { MANUAL_VERSION } from './user-manual.content';
import { MANUAL_FORMATS, MANUAL_MIME, ManualFormat, renderUserManual } from './user-manual.renderer';

export class ManualQueryDto {
  @ApiPropertyOptional({ enum: MANUAL_FORMATS, default: 'pdf' })
  @IsOptional()
  @IsIn(MANUAL_FORMATS)
  format?: ManualFormat;
}

@Injectable()
export class UserManualService {
  private readonly files = new Map<ManualFormat, Promise<Buffer>>();

  constructor(private readonly audit: AuditTrailService) {}

  async download(format: ManualFormat = 'pdf') {
    let file = this.files.get(format);
    if (!file) {
      file = renderUserManual(format).catch((error: unknown) => { this.files.delete(format); throw error; });
      this.files.set(format, file);
    }
    const buffer = await file;
    const filename = `BDO-AuditSphere-User-Manual-v${MANUAL_VERSION}.${format}`;
    await this.audit.record({ action: 'manual.downloaded', targetType: 'UserManual', metadata: { format, version: MANUAL_VERSION, filename } });
    return new StreamableFile(buffer, { type: MANUAL_MIME[format], disposition: `attachment; filename="${filename}"`, length: buffer.length });
  }
}

@ApiTags('help')
@ApiCookieAuth('as_access')
@Controller('help')
export class HelpController {
  constructor(private readonly manual: UserManualService) {}

  // The global JWT guard protects this non-client-specific guide for all signed-in users.
  @Get('user-manual')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Download the user manual (authenticated; no administrator or report-export permission required)' })
  download(@Query() query: ManualQueryDto) { return this.manual.download(query.format); }
}

@Module({ controllers: [HelpController], providers: [UserManualService] })
export class HelpModule {}
