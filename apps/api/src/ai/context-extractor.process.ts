import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { Workbook } from 'exceljs';

class ContextReadError extends Error {}

async function extract(input: { extension: string; maxCharacters: number; buffer: Buffer }) {
  const { extension, maxCharacters, buffer } = input;
  let text = '';
  let truncated = false;
  if (extension === '.pdf') {
    if (!buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new ContextReadError('The file is not a valid PDF.');
    const parser = new PDFParse({ data: new Uint8Array(buffer), isEvalSupported: false });
    try {
      const result = await parser.getText({ first: 50 });
      text = result.pages.filter((page) => page.text.trim()).map((page) => `[Page ${page.num}]\n${page.text}`).join('\n\n');
      truncated = result.total > 50;
    } finally { await parser.destroy(); }
  } else if (extension === '.docx') {
    text = (await mammoth.extractRawText({ buffer })).value;
  } else if (extension === '.xlsx') {
    const workbook = new Workbook();
    await workbook.xlsx.load(buffer as unknown as import('exceljs').Buffer);
    for (const sheet of workbook.worksheets) {
      if (text.length > maxCharacters) { truncated = true; break; }
      text += `[Worksheet: ${sheet.name}]\n`;
      sheet.eachRow((row) => {
        if (text.length > maxCharacters) { truncated = true; return; }
        const cells: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => cells.push(cell.text));
        text += cells.join('\t') + '\n';
      });
    }
    if (!workbook.worksheets.some((sheet) => sheet.actualRowCount > 0)) text = '';
  } else {
    const encoding = buffer[0] === 0xff && buffer[1] === 0xfe ? 'utf-16le' : buffer[0] === 0xfe && buffer[1] === 0xff ? 'utf-16be' : 'utf-8';
    text = new TextDecoder(encoding, { fatal: true }).decode(buffer);
    if (text.includes('\0')) throw new ContextReadError('The file contains binary data, not readable text.');
  }
  text = text.replace(/\0/g, '').trim();
  if (!text) throw new ContextReadError('No readable text was found. Scanned PDFs need OCR before upload.');
  return { text: text.slice(0, maxCharacters), truncated: truncated || text.length > maxCharacters };
}

process.once('message', (input: { extension: string; maxCharacters: number; buffer: Buffer }) => {
  void extract(input).then((result) => process.send?.({ result })).catch((error: Error) => {
    process.send?.({ error: error instanceof ContextReadError ? error.message : error.name === 'PasswordException' ? 'Password-protected PDFs must be unlocked before upload.' : 'The document could not be read. Use an unlocked, text-based PDF, DOCX, XLSX or text file.' });
  }).finally(() => process.disconnect());
});
