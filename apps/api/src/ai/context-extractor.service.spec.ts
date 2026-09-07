import PDFDocument from 'pdfkit';
import { ContextExtractorService, MAX_CONTEXT_BYTES, MAX_CONTEXT_CHARACTERS } from './context-extractor.service';
import { renderReport } from '../reports/report-renderer';

jest.setTimeout(90000);
const marker = 'Invoice approvals require two independent reviewers.';
const report = { title: 'Synthetic context policy', generatedAt: new Date('2026-09-06'), sections: [{ heading: 'Approval threshold', body: marker }], table: { columns: ['Policy'], rows: [[marker]] } };

describe('ContextExtractorService', () => {
  const extractor = new ContextExtractorService();
  it.each(['pdf', 'docx', 'xlsx'] as const)('extracts real %s document text', async (format) => {
    const buffer = await renderReport(report, format);
    const result = await extractor.extract({ originalname: `policy.${format}`, buffer });
    expect(result.text).toContain(marker);
    expect(result.truncated).toBe(false);
  });

  it.each(['txt', 'csv', 'md'])('extracts %s text without changing its content', async (extension) => {
    const result = await extractor.extract({ originalname: `policy.${extension}`, buffer: Buffer.from(marker) });
    expect(result.text).toBe(marker);
  });

  it('marks long context as an excerpt', async () => {
    const result = await extractor.extract({ originalname: 'long.txt', buffer: Buffer.from('x'.repeat(MAX_CONTEXT_CHARACTERS + 100)) });
    expect(result.text).toHaveLength(MAX_CONTEXT_CHARACTERS);
    expect(result.truncated).toBe(true);
  });

  it('rejects empty, oversized and unsupported files before extraction', async () => {
    await expect(extractor.extract({ originalname: 'empty.txt', buffer: Buffer.alloc(0) })).rejects.toThrow('empty');
    await expect(extractor.extract({ originalname: 'large.txt', buffer: Buffer.alloc(MAX_CONTEXT_BYTES + 1) })).rejects.toThrow('10 MB');
    await expect(extractor.extract({ originalname: 'unsafe.exe', buffer: Buffer.from(marker) })).rejects.toThrow('Supported context files');
  });

  it('rejects corrupt PDFs and binary text files', async () => {
    await expect(extractor.extract({ originalname: 'broken.pdf', buffer: Buffer.from(marker) })).rejects.toThrow('valid PDF');
    await expect(extractor.extract({ originalname: 'binary.txt', buffer: Buffer.from([0, 1, 2]) })).rejects.toThrow('binary data');
  });

  it('explains when a PDF contains no extractable text', async () => {
    const pdf = new PDFDocument();
    const chunks: Buffer[] = [];
    const buffer = new Promise<Buffer>((resolve) => { pdf.on('data', (chunk) => chunks.push(chunk)); pdf.on('end', () => resolve(Buffer.concat(chunks))); });
    pdf.end();
    await expect(extractor.extract({ originalname: 'blank.pdf', buffer: await buffer })).rejects.toThrow('OCR');
  });
});
