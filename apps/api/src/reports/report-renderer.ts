import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import { AlignmentType, Document, Footer, Header, HeadingLevel, ImageRun, Packer, PageNumber, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { Workbook } from 'exceljs';
import { apiRoot } from '../config/repo-root';
import type { ReportFormat } from './reports.dto';

export interface ReportDocument {
  title: string;
  generatedAt: Date;
  subtitle?: string;
  sections: { heading: string; body: string }[];
  table?: { columns: string[]; rows: (string | number)[][] };
}

export const REPORT_MIME: Record<ReportFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
};

function reportMeta(report: ReportDocument) {
  return ['BDO AuditSphere | Confidential', report.subtitle, `Generated ${report.generatedAt.toISOString().replace('T', ' ').slice(0, 19)} UTC`].filter(Boolean).join('\n');
}

async function pdf(report: ReportDocument, logo: Buffer): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', layout: report.table ? 'landscape' : 'portrait', margins: { top: 96, bottom: 52, left: 40, right: 40 }, bufferPages: true, info: { Title: report.title, Author: 'BDO AuditSphere' } });
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const width = doc.page.width - 80;
  const room = (height: number) => { if (doc.y + height > doc.page.height - 52) doc.addPage(); };
  doc.fillColor('#333F48').font('Helvetica-Bold').fontSize(20).text(report.title, { width });
  doc.moveDown(0.5).font('Helvetica').fontSize(9).fillColor('#59636C').text(reportMeta(report), { width });
  doc.moveDown();
  for (const section of report.sections) {
    room(60);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#283583').text(section.heading, { width });
    doc.moveDown(0.4).font('Helvetica').fontSize(10).fillColor('#333F48').text(section.body || 'Not recorded', { width, lineGap: 3 });
    doc.moveDown();
  }
  if (report.table) {
    const { columns, rows } = report.table;
    const weights = columns.map((c) => /title|finding|engagement|entity/i.test(c) && !/audit/i.test(c) ? 2 : 1);
    const widths = weights.map((w) => width * w / weights.reduce((a, b) => a + b, 0));
    const rowHeight = (cells: (string | number)[]) => Math.max(...cells.map((value, i) => doc.heightOfString(String(value), { width: widths[i] - 12 })), 12) + 14;
    const drawRow = (cells: (string | number)[], header: boolean, index = 0) => {
      doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
      const height = rowHeight(cells);
      const top = doc.y;
      doc.rect(40, top, width, height).fill(header ? '#283583' : index % 2 ? '#F2F4F5' : '#FFFFFF');
      let x = 40;
      cells.forEach((value, i) => {
        doc.fillColor(header ? '#FFFFFF' : '#333F48').text(String(value), x + 6, top + 7, { width: widths[i] - 12, lineGap: 0 });
        x += widths[i];
      });
      doc.x = 40;
      doc.y = top + height;
    };
    room(70);
    drawRow(columns, true);
    rows.forEach((row, i) => {
      doc.font('Helvetica').fontSize(8);
      if (doc.y + rowHeight(row) > doc.page.height - 52) { doc.addPage(); drawRow(columns, true); }
      drawRow(row, false, i);
    });
    if (!rows.length) doc.moveDown().fillColor('#333F48').text('No matching records.');
  }
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    // The supplied artwork includes clear space; preserve it and its original proportions.
    doc.image(logo, 4, -4, { width: 166.8 });
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#333F48').text('AuditSphere', 142, 48, { lineBreak: false });
    doc.moveTo(40, 82).lineTo(doc.page.width - 40, 82).strokeColor('#E81A3B').lineWidth(2).stroke();
    doc.font('Helvetica').fontSize(8).fillColor('#59636C').text('Confidential | BDO AuditSphere', 40, doc.page.height - 30, { lineBreak: false });
    doc.text(`${i + 1} / ${range.count}`, doc.page.width - 90, doc.page.height - 30, { lineBreak: false });
  }
  doc.end();
  return finished;
}

async function word(report: ReportDocument, logo: Buffer) {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: report.title, heading: HeadingLevel.TITLE }),
    ...reportMeta(report).split('\n').map((text) => new Paragraph({ text, spacing: { after: 100 } })),
  ];
  for (const section of report.sections) {
    children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1, keepNext: true }));
    children.push(...section.body.split('\n').map((text) => new Paragraph({ text, spacing: { after: 120 } })));
  }
  if (report.table) {
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [report.table.columns, ...report.table.rows].map((row, i) => new TableRow({
        tableHeader: i === 0,
        children: row.map((value) => new TableCell({
          shading: { fill: i === 0 ? '283583' : i % 2 ? 'F2F4F5' : 'FFFFFF' },
          children: [new Paragraph({ children: [new TextRun({ text: String(value), bold: i === 0, color: i === 0 ? 'FFFFFF' : '333F48', size: 18 })] })],
        })),
      })),
    }));
  }
  return Packer.toBuffer(new Document({
    creator: 'BDO AuditSphere', title: report.title,
    styles: { default: { document: { run: { font: 'Arial', size: 22, color: '333F48' } }, heading1: { run: { color: '283583', size: 28 } } } },
    sections: [{
      properties: { page: { margin: { top: 2400, header: 360, bottom: 1000, left: 900, right: 900 } } },
      headers: { default: new Header({ children: [new Paragraph({ children: [new ImageRun({ type: 'png', data: logo, transformation: { width: 134, height: 87 }, altText: { title: 'BDO', description: 'BDO logo', name: 'BDO' } }), new TextRun({ text: 'AuditSphere', bold: true })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun('Confidential | BDO AuditSphere | '), new TextRun({ children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES] })] })] }) },
      children,
    }],
  }));
}

function sheetRows(report: ReportDocument): (string | number)[][] {
  return report.table ? [report.table.columns, ...report.table.rows] : [['Section', 'Content'], ...report.sections.map((s) => [s.heading, s.body])];
}

export async function renderReport(report: ReportDocument, format: ReportFormat): Promise<Buffer> {
  if (format === 'md') {
    return Buffer.from([`# ${report.title}`, reportMeta(report), ...report.sections.flatMap((s) => [`## ${s.heading}`, s.body]), ...(report.table ? sheetRows(report).map((r) => r.join(' | ')) : [])].join('\n\n'));
  }
  if (format === 'csv') {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Report');
    // CSV has no cell types. Neutralise spreadsheet formulas while preserving quoting/newlines.
    // eslint-disable-next-line no-control-regex -- Ignore leading control characters when detecting CSV formulas.
    const formula = /^[\s\u0000-\u001f]*[=+@-]/;
    sheet.addRows(sheetRows(report).map((row) => row.map((value) => typeof value === 'string' && formula.test(value) ? `'${value}` : value)));
    return Buffer.concat([Buffer.from('\uFEFF'), Buffer.from(await workbook.csv.writeBuffer())]);
  }
  const logo = await readFile(join(apiRoot(), 'assets', 'bdo-color.png'));
  if (format === 'pdf') return pdf(report, logo);
  if (format === 'docx') return word(report, logo);
  const workbook = new Workbook();
  workbook.creator = 'BDO AuditSphere';
  workbook.created = report.generatedAt;
  const cover = workbook.addWorksheet('Report details');
  cover.getColumn(1).width = 28;
  cover.getColumn(2).width = 90;
  cover.addImage(workbook.addImage({ base64: `data:image/png;base64,${logo.toString('base64')}`, extension: 'png' }), { tl: { col: 0, row: 0 }, ext: { width: 200, height: 130 } });
  cover.getCell('A8').value = report.title;
  cover.getCell('A8').font = { bold: true, size: 16, color: { argb: 'FF283583' } };
  cover.mergeCells('A8:B8');
  cover.getCell('A9').value = 'Generated (UTC)';
  cover.getCell('B9').value = report.generatedAt.toISOString();
  cover.getCell('A10').value = 'Classification';
  cover.getCell('B10').value = 'Confidential';
  if (report.subtitle) { cover.getCell('A11').value = 'Selection'; cover.getCell('B11').value = report.subtitle; }
  const sheet = workbook.addWorksheet('Data', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.addRows(sheetRows(report));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF283583' } };
  sheet.columns.forEach((column, i) => { column.width = /title|finding|engagement|content/i.test(String(sheet.getRow(1).getCell(i + 1).value)) ? 55 : 24; });
  sheet.eachRow((row) => { row.alignment = { vertical: 'top', wrapText: true }; });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: sheet.columnCount } };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
