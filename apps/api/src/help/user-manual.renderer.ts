import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import { AlignmentType, Document, Footer, Header, HeadingLevel, ImageRun, Packer, PageNumber, Paragraph, TextRun } from 'docx';
import { apiRoot } from '../config/repo-root';
import { MANUAL_CHAPTERS, MANUAL_DATE, MANUAL_TITLE, MANUAL_VERSION, ManualSection } from './user-manual.content';

export const MANUAL_FORMATS = ['pdf', 'docx', 'md'] as const;
export type ManualFormat = typeof MANUAL_FORMATS[number];
export const MANUAL_MIME: Record<ManualFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  md: 'text/markdown; charset=utf-8',
};
export const MANUAL_FIGURES = {
  'engagement-profile': 'Engagement profile: select an auditable entity and document objectives and scope. Demonstration, not a saved engagement.',
  'finding-response': 'Management response: external owner details are present; Set due date identifies the outstanding agreement requirement. Demonstration data.',
};
type Figures = Record<keyof typeof MANUAL_FIGURES, Buffer>;
const edition = `Version ${MANUAL_VERSION} | ${MANUAL_DATE}`;

function lines(section: ManualSection) {
  return [...(section.paragraphs ?? []), ...(section.steps ?? []).map((step, i) => `${i + 1}. ${step}`), ...(section.bullets ?? []).map((bullet) => `- ${bullet}`)];
}

export function manualMarkdown() {
  return [
    `# ${MANUAL_TITLE}`, edition, 'BDO internal use | Application operating guide',
    '## Contents', ...MANUAL_CHAPTERS.map((chapter, i) => `${i + 1}. ${chapter.title}`),
    ...MANUAL_CHAPTERS.flatMap((chapter, i) => [
      `## ${i + 1}. ${chapter.title}`,
      ...chapter.sections.flatMap((section) => [
        `### ${section.heading}`, ...lines(section),
        ...(section.figure ? [`Illustration (included in PDF and Word): ${MANUAL_FIGURES[section.figure]}`] : []),
      ]),
    ]), '',
  ].join('\n\n');
}

// PNG IHDR dimensions preserve the supplied artwork and screenshot proportions.
function dimensions(png: Buffer, maxWidth: number, maxHeight: number) {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: width * scale, height: height * scale };
}

async function pdf(logo: Buffer, figures: Figures): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 86, bottom: 62, left: 48, right: 48 }, bufferPages: true, info: { Title: MANUAL_TITLE, Author: 'BDO AuditSphere', Subject: edition, Keywords: 'AuditSphere, user manual, internal audit' } });
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const left = 48;
  const width = doc.page.width - left * 2;
  const room = (height: number) => { if (doc.y + height > doc.page.height - 62) doc.addPage(); };
  const body = (text: string) => {
    doc.font('Helvetica').fontSize(10).fillColor('#333F48');
    room(doc.heightOfString(text, { width, lineGap: 3 }) + 10);
    doc.text(text, left, doc.y, { width, lineGap: 3 });
    doc.moveDown(0.7);
  };

  doc.image(logo, -15, -16, { width: 295 });
  doc.font('Helvetica-Bold').fontSize(34).fillColor('#283583').text('BDO AuditSphere', left, 239, { width });
  doc.fontSize(26).fillColor('#333F48').text('User manual', left, 288, { width });
  doc.moveTo(left, 344).lineTo(doc.page.width - left, 344).strokeColor('#E81A3B').lineWidth(3).stroke();
  doc.font('Helvetica').fontSize(12).text('Practical guidance for audit teams, management,\ncommittee viewers and administrators.', left, 374, { width, lineGap: 5 });
  doc.fontSize(11).text(edition, left, 479, { width });
  doc.fontSize(10).fillColor('#59636C').text(`${MANUAL_CHAPTERS.length} chapters | Illustrated workflows | Troubleshooting\n\nBDO internal use\nApplication operating guide, not a substitute for approved methodology.`, left, 527, { width, lineGap: 4 });

  doc.addPage();
  const chapterPages: number[] = [];
  MANUAL_CHAPTERS.forEach((chapter, index) => {
    doc.addPage();
    chapterPages.push(doc.bufferedPageRange().count);
    doc.addNamedDestination(`chapter-${index + 1}`);
    doc.outline.addItem(`${index + 1}. ${chapter.title}`);
    doc.font('Helvetica-Bold').fontSize(21).fillColor('#283583').text(`${index + 1}. ${chapter.title}`, left, doc.y, { width, lineGap: 2 });
    doc.moveDown(0.8);
    for (const section of chapter.sections) {
      room(92);
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#333F48').text(section.heading, left, doc.y, { width });
      doc.moveDown(0.45);
      for (const text of lines(section)) body(text);
      if (section.figure) {
        const data = figures[section.figure];
        const size = dimensions(data, width, 260);
        room(size.height + 52);
        const y = doc.y;
        doc.image(data, left + (width - size.width) / 2, y, size);
        doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#59636C').text(MANUAL_FIGURES[section.figure], left, y + size.height + 8, { width, lineGap: 2 });
        doc.moveDown(0.8);
      }
    }
  });

  doc.switchToPage(1);
  doc.font('Helvetica-Bold').fontSize(23).fillColor('#283583').text('Contents', left, 90);
  doc.font('Helvetica').fontSize(10).fillColor('#59636C').text('Select a chapter, or use the PDF bookmarks.', left, 127);
  let y = 161;
  MANUAL_CHAPTERS.forEach((chapter, index) => {
    doc.font('Helvetica').fontSize(10).fillColor('#333F48').text(`${index + 1}. ${chapter.title}`, left, y, { width: width - 40, goTo: `chapter-${index + 1}`, lineBreak: false });
    doc.text(String(chapterPages[index]), left + width - 32, y, { width: 32, align: 'right', lineBreak: false });
    y += 23;
  });

  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index++) {
    doc.switchToPage(index);
    if (index > 0) {
      doc.image(logo, 14, -13, { width: 145 });
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#333F48').text('AuditSphere | User manual', 147, 33, { lineBreak: false });
      doc.moveTo(left, 63).lineTo(doc.page.width - left, 63).strokeColor('#E81A3B').lineWidth(1.5).stroke();
    }
    doc.font('Helvetica').fontSize(8).fillColor('#59636C').text(`BDO AuditSphere | User manual v${MANUAL_VERSION}`, left, doc.page.height - 32, { lineBreak: false });
    doc.text(`${index + 1} / ${range.count}`, doc.page.width - 95, doc.page.height - 32, { lineBreak: false });
  }
  doc.end();
  return finished;
}

async function word(logo: Buffer, figures: Figures) {
  const children: Paragraph[] = [
    new Paragraph({ text: MANUAL_TITLE, heading: HeadingLevel.TITLE, spacing: { before: 1800, after: 360 } }),
    new Paragraph({ text: edition, spacing: { after: 240 } }),
    new Paragraph('Practical guidance for audit teams, management, committee viewers and administrators.'),
    new Paragraph('BDO internal use | Application operating guide, not a substitute for approved methodology.'),
    new Paragraph({ text: 'Contents', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }),
    ...MANUAL_CHAPTERS.map((chapter, i) => new Paragraph({ text: `${i + 1}. ${chapter.title}`, spacing: { after: 120 } })),
  ];
  for (const [index, chapter] of MANUAL_CHAPTERS.entries()) {
    children.push(new Paragraph({ text: `${index + 1}. ${chapter.title}`, heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
    for (const section of chapter.sections) {
      children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_2, keepNext: true }));
      children.push(...lines(section).map((text) => new Paragraph({ text, spacing: { after: 140, line: 288 }, keepLines: true })));
      if (section.figure) {
        const data = figures[section.figure];
        children.push(new Paragraph({ keepNext: true, children: [new ImageRun({ type: 'png', data, transformation: dimensions(data, 580, 330), altText: { name: section.figure, title: section.heading, description: MANUAL_FIGURES[section.figure] } })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: MANUAL_FIGURES[section.figure], italics: true, size: 18 })], spacing: { after: 200 } }));
      }
    }
  }
  return Packer.toBuffer(new Document({
    creator: 'BDO AuditSphere', title: MANUAL_TITLE, description: edition,
    styles: { default: {
      document: { run: { font: 'Arial', size: 21, color: '333F48' } },
      title: { run: { font: 'Arial', size: 56, color: '283583', bold: true } },
      heading1: { run: { color: '283583', size: 36, bold: true }, paragraph: { spacing: { before: 240, after: 240 }, keepNext: true } },
      heading2: { run: { color: '333F48', size: 26, bold: true }, paragraph: { spacing: { before: 220, after: 140 }, keepNext: true } },
    } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1600, bottom: 1000, left: 960, right: 960, header: 120, footer: 400 } } },
      headers: { default: new Header({ children: [new Paragraph({ children: [new ImageRun({ type: 'png', data: logo, transformation: dimensions(logo, 130, 85), altText: { title: 'BDO', name: 'BDO', description: 'BDO logo' } }), new TextRun({ text: 'AuditSphere | User manual', bold: true })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `BDO AuditSphere | v${MANUAL_VERSION} | `, size: 16 }), new TextRun({ children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: 16 })] })] }) },
      children,
    }],
  }));
}

export async function renderUserManual(format: ManualFormat): Promise<Buffer> {
  if (format === 'md') return Buffer.from(manualMarkdown(), 'utf8');
  const assets = join(apiRoot(), 'assets');
  const logo = await readFile(join(assets, 'bdo-color.png'));
  const figures: Figures = {
    'engagement-profile': await readFile(join(assets, 'manual', 'engagement-profile.png')),
    'finding-response': await readFile(join(assets, 'manual', 'finding-response.png')),
  };
  return format === 'pdf' ? pdf(logo, figures) : word(logo, figures);
}
