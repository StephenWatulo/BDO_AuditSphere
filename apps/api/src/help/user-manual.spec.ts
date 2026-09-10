import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import JSZip from 'jszip';
import { IS_PUBLIC_KEY } from '../common/decorators';
import { HelpController, ManualQueryDto, UserManualService } from './help.module';
import { MANUAL_CHAPTERS, MANUAL_TITLE, MANUAL_VERSION } from './user-manual.content';
import { manualMarkdown, renderUserManual } from './user-manual.renderer';

jest.setTimeout(30000);

describe('AuditSphere user manual', () => {
  it('covers the working modules, ownership, closure and implementation limits in detail', () => {
    const text = manualMarkdown();
    expect(MANUAL_CHAPTERS).toHaveLength(24);
    expect(text.split(/\s+/).length).toBeGreaterThan(6000);
    for (const term of ['AI Sphere', 'Audit trail', 'Client portal', 'Set due date', 'independent', '10,000', '12,000', '50 MB', '10 MB', 'no implemented scheduled connector/rule execution engine', 'Closure does not require every finding to be Closed or Risk accepted']) expect(text).toContain(term);
    expect(text).not.toContain('Admin123!');
  });

  it('renders a complete PDF with bookmarks, linked contents and embedded branding/illustrations', async () => {
    const buffer = await renderUserManual('pdf');
    const source = buffer.toString('latin1');
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(source.trimEnd().endsWith('%%EOF')).toBe(true);
    expect((source.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThanOrEqual(26);
    expect(source).toContain('/Outlines');
    expect(source).toContain('/GoTo');
    expect(source).toContain('/Subtype /Image');
    expect(source).toContain('chapter-24');
  }, 90000);

  it('renders Word with every chapter, accessible image descriptions and page numbering', async () => {
    const zip = await JSZip.loadAsync(await renderUserManual('docx'));
    const document = await zip.file('word/document.xml')!.async('string');
    expect(document).toContain(MANUAL_TITLE);
    for (const chapter of MANUAL_CHAPTERS) expect(document).toContain(chapter.title);
    expect(document).toContain('finding-response');
    expect(document).toContain('engagement-profile');
    expect(await zip.file('word/header1.xml')!.async('string')).toContain('BDO logo');
    expect(await zip.file('word/footer1.xml')!.async('string')).toContain('NUMPAGES');
  });

  it('supports only documented formats and defaults to PDF', async () => {
    expect(await validate(plainToInstance(ManualQueryDto, {}))).toEqual([]);
    for (const format of ['pdf', 'docx', 'md']) expect(await validate(plainToInstance(ManualQueryDto, { format }))).toEqual([]);
    expect(await validate(plainToInstance(ManualQueryDto, { format: '../secret' }))).not.toHaveLength(0);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, HelpController)).not.toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, HelpController.prototype.download)).not.toBe(true);
  });

  it('returns correct attachment metadata and audits each authenticated download', async () => {
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new UserManualService(audit as never);
    for (let attempt = 0; attempt < 2; attempt++) {
      const file = await service.download('md');
      expect(file.getHeaders()).toEqual({ type: 'text/markdown; charset=utf-8', disposition: `attachment; filename="BDO-AuditSphere-User-Manual-v${MANUAL_VERSION}.md"`, length: Buffer.byteLength(manualMarkdown()) });
    }
    expect(audit.record).toHaveBeenCalledTimes(2);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'manual.downloaded', targetType: 'UserManual', metadata: expect.objectContaining({ version: MANUAL_VERSION, format: 'md' }) }));
  });
});
