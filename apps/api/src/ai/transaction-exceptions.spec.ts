import { AssistantContentSchema, EXCEPTION_REGISTER_COLUMNS, EXCEPTION_REGISTER_TITLE } from '@auditsphere/shared';
import { AiFeature } from './ai.dto';
import { AuditContext } from './audit-context.types';
import { reviewTransactions } from './evidence-analysis';
import { reviewAudit } from './audit-review.engine';
import { validateProviderDraft } from './audit-provider';

function context(text: string, fileName = 'transactions.csv'): AuditContext {
  return { warnings: [], links: [], records: [{ source: { id: 'S1', kind: 'Document', recordId: 'd1', label: fileName, excerpt: text, truncated: false }, fields: { id: 'd1', fileName, extractedText: text } }] };
}
const request = { feature: AiFeature.EvidenceSummary, prompt: 'Review transaction evidence and generate an exception register.' };
const review = (text: string, filename?: string) => reviewAudit(request, context(text, filename));
const table = (result: Awaited<ReturnType<typeof review>>) => result.sections.find((s) => s.title === EXCEPTION_REGISTER_TITLE)!;
const sample = 'Transaction Reference,Supplier/Vendor,Amount (KES),Approver,Approval Date,Commitment Date\nPO-006,Supplier F,650000,,2026-08-09,2026-08-10';

describe('Transaction-level exception register', () => {
  it('generates the exact ten columns and a specific Supplier F / KES 650,000 exception', async () => {
    const result = await review(sample); const register = table(result); const row = register.rows[0];
    expect(register.columns).toEqual(EXCEPTION_REGISTER_COLUMNS);
    expect(row.cells.slice(0, 4)).toEqual(['EX-001', 'PO-006', 'Supplier F', 'KES 650,000']);
    expect(row.cells[4]).toContain('delegation matrix'); expect(row.cells[5]).toContain('transactions.csv, row 2');
    expect(row.cells[6]).toContain('Approval authority could not be confirmed for Supplier F amounting to KES 650,000');
    expect(row.cells[6]).toContain('did not identify the approver');
    expect(row.cells[7]).toContain('actual loss is not established'); expect(row.cells[8]).toContain('UNRATED');
    expect(row.cells[9]).toContain('Verify their authority for the transaction amount and date');
    expect(row.sourceIds).toEqual(['S1']); expect(result.exceptions[0].observation).toBe(row.cells[6]);
    expect(AssistantContentSchema.safeParse(result).success).toBe(true);
  });
  it('keeps individual amounts/currencies and quoted supplier names without floating-point rounding', async () => {
    const result = await review('Invoice Number,Vendor,Amount,Currency,Approver,Approval Date,PO Date\nINV-1,"Alpha, Ltd",650000,KES,,2026-08-09,2026-08-10\nINV-2,Beta,-1234567.8901,USD,,2026-08-09,2026-08-10\nINV-3,Gamma,0,EUR,,2026-08-09,2026-08-10');
    expect(table(result).rows.map((r) => r.cells.slice(2, 4))).toEqual([['Alpha, Ltd', 'KES 650,000'], ['Beta', 'USD -1,234,567.8901'], ['Gamma', 'EUR 0']]);
  });
  it('does not infer currency, supplier or amount from the tenant or neighbouring rows', async () => {
    const result = await review('PO Number,Supplier,Amount,Approver,Approval Date,Commitment Date\nPO-1,Known,650000,,2026-08-09,2026-08-10\nPO-2,,,,2026-08-09,2026-08-10');
    expect(table(result).rows[0].cells[3]).toBe('650,000 (currency not supplied)');
    expect(table(result).rows[1].cells.slice(1, 4)).toEqual(['PO-2', 'Not supplied', 'Not supplied']);
    expect(table(result).rows[1].cells[6]).toContain('amount not supplied');
  });
  it('generates register rows when an approval column or a transaction-reference column is absent', async () => {
    const result = await review('Supplier,Amount,Currency\nSupplier F,650000,KES');
    expect(table(result).rows).toHaveLength(4);
    expect(table(result).rows.every((r) => r.cells[1] === 'Not supplied')).toBe(true);
    expect(table(result).rows.some((r) => r.cells[6].includes('did not identify the approver'))).toBe(true);
  });
  it('distinguishes worksheet/page locations and handles Markdown table separators', async () => {
    const xlsx = await review('[Worksheet: Jan]\nPO Number\tSupplier\tAmount (USD)\tApprover\tApproval Date\tPO Date\nP1\tOne\t10\t\t2026-01-01\t2026-01-02\n[Worksheet: Feb]\nPO Number\tSupplier\tAmount (USD)\tApprover\tApproval Date\tPO Date\nP2\tTwo\t20\t\t2026-02-01\t2026-02-02', 'transactions.xlsx');
    expect(table(xlsx).rows.map((r) => r.cells[5])).toEqual([expect.stringContaining('[Worksheet: Jan] row 2'), expect.stringContaining('[Worksheet: Feb] row 2')]);
    const markdown = await review('[Page 2]\n| PO Number | Supplier | Amount (KES) | Approver | Approval Date | PO Date |\n| --- | --- | --- | --- | --- | --- |\n| P3 | Three | 650000 | | 2026-08-09 | 2026-08-10 |', 'extracted-table.md');
    expect(table(markdown).rows).toHaveLength(1); expect(table(markdown).rows[0].cells[5]).toContain('[Page 2] row 3');
  });
  it('does not turn a quoted CSV tab into a delimiter or produce exceptions for totals', async () => {
    const parsed = await reviewTransactions(context('PO Number,Supplier,Amount,Approver,Approval Date,Commitment Date\nPO-1,"A\tLtd",500,Jane,2026-08-09,2026-08-10\nTotal,,500,,,') );
    expect(parsed.rows).toHaveLength(1); expect(parsed.rows[0].supplier).toBe('A\tLtd'); expect(parsed.rows[0].issues).toEqual([]);
  });
  it('links only the relevant control and retains source-reported severity with a caveat', async () => {
    const ctx = context('PO Number,Supplier,Amount,Currency,Approver,Approval Date,PO Date,Control Reference,Severity\nP1,F,650000,KES,,2026-08-09,2026-08-10,C-2,High');
    ctx.records.push(...['C-1', 'C-2'].map((code, i) => ({ source: { id: `S${i + 2}`, kind: 'Control' as const, recordId: `c${i + 1}`, label: code, excerpt: '', truncated: false }, fields: { id: `c${i + 1}`, code, title: `${code} approval`, description: `${code} approvals require delegated authority.` } })));
    const row = table(await reviewAudit(request, ctx)).rows[0];
    expect(row.cells[4]).toContain('Recorded control C-2'); expect(row.sourceIds).toEqual(['S1', 'S3']); expect(row.cells[8]).toBe('HIGH (source-reported; confirm)');
    ctx.records[0].fields.extractedText = String(ctx.records[0].fields.extractedText).replace('C-2,High', 'C-99,High');
    expect(table(await reviewAudit(request, ctx)).rows[0].cells[4]).toContain('Unresolved control reference C-99');
  });
  it('retains source-stated criteria/observations without inventing their confirmation', async () => {
    const result = await review('Reference,Supplier,Amount,Currency,Approver,Approval Date,PO Date,Control Requirement,Evidence Observed\nP1,F,650000,KES,,2026-08-09,2026-08-10,Policy AP 4.2 requires approval,Unsigned approval printout');
    expect(table(result).rows[0].cells[4]).toBe('Source-stated requirement: Policy AP 4.2 requires approval');
    expect(table(result).rows[0].cells[5]).toContain('Unsigned approval printout');
  });
  it('does not manufacture exceptions for clean rows or nontransactional documents', async () => {
    for (const input of ['Procurement approvals require two reviewers.', sample.replace('650000,,', '650000,Jane,')]) {
      const result = await review(input); expect(table(result).rows).toEqual([]); expect(result.evidenceAssessment.status).toBe('PARTIALLY_SUFFICIENT');
    }
  });
  it('caps registers at 100 distinct IDs and discloses the limit', async () => {
    const result = await review('Reference,Supplier,Amount,Currency\n' + Array.from({ length: 80 }, (_, i) => `P-${i},Vendor ${i},100,KES`).join('\n'));
    expect(table(result).rows).toHaveLength(100); expect(new Set(table(result).rows.map((r) => r.cells[0])).size).toBe(100);
    expect(table(result).items.some((i) => i.text.includes('limited to 100'))).toBe(true); expect(AssistantContentSchema.safeParse(result).success).toBe(true);
  });
  it('preserves deterministic register rows if a model removes them or rewrites their values', async () => {
    const ctx = context(sample); const baseline = await reviewAudit(request, ctx);
    for (const remove of [true, false]) {
      const draft = structuredClone(baseline);
      if (remove) table(draft).rows = []; else table(draft).rows[0].cells[3] = 'KES 1';
      const result = validateProviderDraft(draft, baseline, ctx);
      expect(table(result).rows).toEqual(table(baseline).rows);
    }
  });
  it('requires the exact register columns and rejects invented additional transaction facts', async () => {
    const ctx = context(sample); const baseline = await reviewAudit(request, ctx);
    const invalid = structuredClone(baseline); table(invalid).columns[3] = 'Value';
    expect(() => validateProviderDraft(invalid, baseline, ctx)).toThrow('invalid exception register');
    for (const [index, value] of [[1, 'INVENTED-99'], [2, 'Invented Vendor'], [3, 'KES 9999999']] as const) {
      const draft = structuredClone(baseline); const row = structuredClone(table(draft).rows[0]); row.cells[0] = 'EX-999'; row.cells[index] = value; table(draft).rows.push(row);
      expect(() => validateProviderDraft(draft, baseline, ctx)).toThrow('invented');
    }
  });
  it('accepts source-anchored model register rows from narrative documents and synchronises exception IDs', async () => {
    const ctx = context('Invoice PO-006 for Supplier F amounted to KES 650,000. Approval authority could not be confirmed because the approval record did not identify the approver.', 'invoice-review.pdf');
    const baseline = await reviewAudit(request, ctx); const draft = structuredClone(baseline);
    const source = table(await review(sample)).rows[0]; source.cells[0] = 'EX-055'; source.cells[5] = 'invoice-review.pdf: Approval record did not identify an approver.';
    table(draft).rows = [source];
    const result = validateProviderDraft(draft, baseline, ctx);
    expect(table(result).rows[0].cells[0]).toBe('EX-001'); expect(result.exceptions[0].reference).toBe('EX-001'); expect(result.exceptions[0].status).toBe('potential');
  });
});
