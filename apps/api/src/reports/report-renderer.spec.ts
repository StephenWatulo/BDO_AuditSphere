import { Workbook } from 'exceljs';
import JSZip from 'jszip';
import { ReportDocument, renderReport } from './report-renderer';
import { reportRows } from './reports.service';

jest.setTimeout(30000);

const report: ReportDocument = {
  title: 'Audit report export test', generatedAt: new Date('2026-09-05T12:00:00Z'),
  sections: [{ heading: 'Management response', body: 'Controls will be reviewed.\nThe owner will provide evidence.' }],
  table: { columns: ['Reference', 'Finding', 'Count'], rows: [['001', 'A "quoted", multiline\nfinding', 42], ['002', '=HYPERLINK("https://example.invalid")', 1], ['003', ' @SUM(1,1)', -5]] },
};

describe('report file exports', () => {
  it('generates a multi-page PDF containing the logo and final page', async () => {
    const buffer = await renderReport({ ...report, table: { columns: report.table!.columns, rows: Array.from({ length: 150 }, (_, i) => [String(i), `Finding ${i}`, i]) } }, 'pdf');
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    const source = buffer.toString('latin1');
    expect((source.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(2);
    expect(source).toContain('/Subtype /Image');
    expect(source.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('generates a Word document with text, a branded header and page numbering', async () => {
    const zip = await JSZip.loadAsync(await renderReport(report, 'docx'));
    const document = await zip.file('word/document.xml')!.async('string');
    expect(document).toContain('Management response');
    expect(document).toContain('The owner will provide evidence.');
    const header = await zip.file('word/header1.xml')!.async('string');
    expect(header).toContain('BDO logo');
    expect(Object.keys(zip.files).some((name) => name.startsWith('word/media/') && name.endsWith('.png'))).toBe(true);
    expect(await zip.file('word/footer1.xml')!.async('string')).toContain('NUMPAGES');
  });

  it('generates Excel with all rows, typed numbers, literal formulas and frozen headers', async () => {
    const workbook = new Workbook();
    await workbook.xlsx.load(await renderReport(report, 'xlsx') as unknown as import('exceljs').Buffer);
    const data = workbook.getWorksheet('Data')!;
    expect(data.rowCount).toBe(4);
    expect(data.getCell('A2').value).toBe('001');
    expect(data.getCell('B3').value).toBe(report.table!.rows[1][1]);
    expect(data.getCell('B3').type).not.toBe(6);
    expect(data.getCell('C2').value).toBe(42);
    expect(data.views[0].state).toBe('frozen');
    expect(workbook.getWorksheet('Report details')!.getImages()).toHaveLength(1);
  });

  it('quotes CSV values and neutralises formulas without changing numeric values', async () => {
    const csv = (await renderReport(report, 'csv')).toString('utf8');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"A ""quoted"", multiline\nfinding"');
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("' @SUM");
    expect(csv).toContain(',-5');
  });

  it('exports every match regardless of the page being viewed', async () => {
    const find = jest.fn(async ({ skip, take }: { skip: number; take: number }) => Array.from({ length: take }, (_, i) => skip + i));
    const page = await reportRows({ page: 2, pageSize: 25 }, async () => 251, find, true);
    expect(page.items).toHaveLength(251);
    expect(find).toHaveBeenCalledWith({ skip: 0, take: 251 });
    await expect(reportRows({}, async () => 10001, find, true)).rejects.toThrow('Narrow the report filters');
  });
});
