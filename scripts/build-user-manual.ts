import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MANUAL_CHAPTERS, MANUAL_VERSION } from '../apps/api/src/help/user-manual.content';
import { manualMarkdown, renderUserManual } from '../apps/api/src/help/user-manual.renderer';

async function main() {
  const root = process.cwd();
  const output = join(root, '.local-dev', 'user-manual');
  await mkdir(output, { recursive: true });
  const markdown = manualMarkdown();
  await writeFile(join(root, 'docs', 'user-manual.md'), markdown);
  for (const format of ['pdf', 'docx', 'md'] as const) {
    const buffer = await renderUserManual(format);
    const path = join(output, `BDO-AuditSphere-User-Manual-v${MANUAL_VERSION}.${format}`);
    await writeFile(path, buffer);
    console.log(`${format.toUpperCase()}: ${buffer.length} bytes, ${path}`);
  }
  console.log(`${MANUAL_CHAPTERS.length} chapters; ${markdown.split(/\s+/).length} words. Markdown generated at docs/user-manual.md.`);
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
