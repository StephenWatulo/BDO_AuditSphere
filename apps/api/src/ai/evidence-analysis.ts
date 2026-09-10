import { Readable } from 'node:stream';
import { Workbook } from 'exceljs';
import type { AssistantContent } from '@auditsphere/shared';
import { AuditContext, field, recordsOf } from './audit-context.types';

export type TransactionIssueCode = 'reference' | 'approver' | 'approvalDate' | 'commitmentDate' | 'lateApproval' | 'ambiguousDate';
export interface TransactionIssue { code: TransactionIssueCode; message: string }
export interface TransactionReview {
  sourceId: string; row: number; location: string; reference: string; supplier: string; amount: string;
  approver: string; approvalDate: string; commitmentDate: string; controlReference: string;
  controlRequirement: string; evidenceObserved: string; severity: string;
  issues: string[]; issueDetails: TransactionIssue[];
}
const normalized = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export const missingTransactionValue = (s: string) => !s.trim() || /^(?:n\/?a|none|null|missing|not available|not provided|not identified|pending|-)$/i.test(s.trim());
const missing = missingTransactionValue;
const isoDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/.test(s)) return null;
  const date = new Date(s);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === s.slice(0, 10) ? date.getTime() : null;
};
const aliases = {
  reference: ['transactionid', 'transactionref', 'transactionreference', 'reference', 'ponumber', 'poref', 'poreference', 'purchaseorder', 'purchaseordernumber', 'invoicenumber', 'invoiceref', 'invoicereference', 'invoice', 'paymentreference'],
  supplier: ['supplier', 'suppliername', 'vendor', 'vendorname', 'suppliervendor'],
  approver: ['approver', 'approvedby', 'approvername'],
  approvalDate: ['approvaldate', 'approvedat', 'approveddate'],
  commitmentDate: ['commitmentdate', 'podate', 'orderdate', 'purchaseorderdate'],
  amount: ['amount', 'transactionamount', 'invoiceamount', 'paymentamount', 'totalamount', 'grossamount', 'invoicevalue', 'value'],
  currency: ['currency', 'currencycode', 'ccy'],
  controlReference: ['control', 'controlcode', 'controlid', 'controlreference'],
  controlRequirement: ['controlrequirement', 'approvalrequirement', 'policyrequirement', 'criteria'],
  evidenceObserved: ['evidence', 'evidenceobserved', 'approvalevidence', 'supportingevidence', 'observation'],
  severity: ['severity', 'riskseverity'],
};

function amountHeader(header: string) {
  const match = header.trim().match(/^(.*?)\s*(?:\(([A-Z]{3})\)|\[([A-Z]{3})\]|\s([A-Z]{3}))$/);
  return match && aliases.amount.includes(normalized(match[1])) ? { name: normalized(match[1]), currency: match[2] ?? match[3] ?? match[4] } : { name: normalized(header), currency: '' };
}

/** Preserve recorded decimal precision and currency; never infer currency from the tenant. */
function recordedAmount(raw: string, currency: string) {
  if (missing(raw)) return 'Not supplied';
  const formatted = /^[+-]?\d+(?:\.\d+)?$/.test(raw) ? raw.replace(/\d+/, (whole) => whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')) : raw;
  if (/[A-Za-z$\u00a3\u20ac]/.test(raw)) return currency && !raw.toUpperCase().includes(currency.toUpperCase()) ? `${formatted} (currency field: ${currency}; reconcile)` : formatted;
  return currency ? `${currency} ${formatted}` : `${formatted} (currency not supplied)`;
}

/** CSV and tab-separated spreadsheet excerpts are parsed by ExcelJS, not split on commas. */
export async function reviewTransactions(context: AuditContext): Promise<{ rows: TransactionReview[]; warnings: string[] }> {
  const rows: TransactionReview[] = [];
  const warnings: string[] = [];
  for (const doc of recordsOf(context, 'Document')) {
    const text = field(doc, 'extractedText');
    if (!text) continue;
    const chunks = text.split(/^(\[(?:Worksheet:.*|Page \d+)\])[\t ]*$/m);
    let location = '';
    for (const chunk of chunks) {
      if (/^\[(?:Worksheet:.*|Page \d+)\]$/.test(chunk)) { location = chunk; continue; }
      if (!chunk.trim() || !/[,\t|]/.test(chunk)) continue;
      try {
        const book = new Workbook();
        const delimiter = /\.csv$/i.test(field(doc, 'fileName')) ? ',' : chunk.includes('\t') ? '\t' : /^\s*\|.*\|/m.test(chunk) ? '|' : ',';
        const sheet = await book.csv.read(Readable.from([chunk.trim()]), { map: (value: string) => value, parserOptions: { delimiter, ignoreEmpty: true } });
        let headers: string[] = []; let headerRow = 0; let currencyHeader = '';
        for (let i = 1; i <= Math.min(sheet.rowCount, 50); i++) {
          const candidate: string[] = [];
          sheet.getRow(i).eachCell({ includeEmpty: true }, (cell, index) => { candidate[index] = amountHeader(cell.text).name; });
          const has = (key: keyof typeof aliases) => candidate.some((h) => aliases[key].includes(h));
          if ((has('reference') && (has('supplier') || has('amount') || has('approver') || has('approvalDate') || has('commitmentDate'))) || (has('supplier') && has('amount'))) {
            headers = candidate; headerRow = i;
            const col = candidate.findIndex((h) => aliases.amount.includes(h));
            currencyHeader = col > 0 ? amountHeader(sheet.getRow(i).getCell(col).text).currency : '';
            break;
          }
        }
        if (!headerRow) continue;
        if (sheet.rowCount > headerRow + 200) warnings.push(`${doc.source.label} ${location}: transaction checks were limited to 200 rows.`);
        for (let i = headerRow + 1; i <= Math.min(sheet.rowCount, headerRow + 200); i++) {
          const get = (key: keyof typeof aliases) => { const col = headers.findIndex((h) => aliases[key].includes(h)); return col < 1 ? '' : sheet.getRow(i).getCell(col).text.trim(); };
          const reference = get('reference'); const approver = get('approver'); const approvalDate = get('approvalDate'); const commitmentDate = get('commitmentDate');
          const supplier = get('supplier'); const amount = get('amount');
          if ([reference, supplier, amount, approver, approvalDate, commitmentDate].every((v) => !v || /^:?-{3,}:?$/.test(v))) continue;
          if (/^(?:total|subtotal|grand total)$/i.test(reference) && missing(supplier)) continue;
          if (aliases.reference.includes(normalized(reference)) && aliases.supplier.includes(normalized(supplier))) continue;
          const issueDetails: TransactionIssue[] = [];
          const issue = (code: TransactionIssueCode, message: string) => issueDetails.push({ code, message });
          if (missing(reference)) issue('reference', 'Transaction reference is missing; the row cannot be tied to a transaction.');
          if (missing(approver)) issue('approver', 'Approver is not identified in the supplied transaction row.');
          if (missing(approvalDate)) issue('approvalDate', 'Approval date is not provided.');
          if (missing(commitmentDate)) issue('commitmentDate', 'Commitment date is not provided; approval timing cannot be tested.');
          const approved = isoDate(approvalDate); const committed = isoDate(commitmentDate);
          if (approved !== null && committed !== null && approved > committed) issue('lateApproval', 'Recorded approval date is after the commitment date. Confirm the date fields and investigate retrospective approval.');
          if ((!missing(approvalDate) && approved === null) || (!missing(commitmentDate) && committed === null)) issue('ambiguousDate', 'Date format is ambiguous or invalid; supply ISO dates before testing approval timing.');
          const currency = missing(get('currency')) ? currencyHeader : get('currency');
          rows.push({ sourceId: doc.source.id, row: i, location: `${location ? `${location} ` : ''}row ${i}`, reference, supplier, amount: recordedAmount(amount, currency), approver, approvalDate, commitmentDate, controlReference: get('controlReference'), controlRequirement: get('controlRequirement'), evidenceObserved: get('evidenceObserved'), severity: get('severity'), issues: issueDetails.map((e) => e.message), issueDetails });
        }
      } catch { warnings.push(`${doc.source.label}: tabular text could not be parsed; no transaction-level assurance was obtained.`); }
    }
  }
  return { rows, warnings };
}

export function assessEvidence(context: AuditContext, transactions: TransactionReview[]): AssistantContent['evidenceAssessment'] {
  const evidence = recordsOf(context, 'Evidence');
  const docs = recordsOf(context, 'Document');
  const relevant = [...evidence, ...docs];
  const refs = relevant.map((r) => r.source.id);
  const hasText = docs.some((d) => field(d, 'extractedText'));
  const checks: AssistantContent['evidenceAssessment']['checks'] = [
    { label: 'Required documents', result: hasText ? 'not_verified' : 'missing', detail: hasText ? 'Readable sources are available, but availability does not establish completeness against the audit objective.' : 'No readable source documents were retrieved.', sourceIds: refs },
    { label: 'Dates available', result: transactions.length ? transactions.every((r) => isoDate(r.approvalDate) !== null && isoDate(r.commitmentDate) !== null) ? 'present' : 'missing' : 'not_verified', detail: transactions.length ? 'Checked supplied approval and commitment date columns; source authenticity is not independently verified.' : 'Transaction-level approval and commitment dates have not been established.', sourceIds: refs },
    { label: 'Approver identified', result: transactions.length ? transactions.every((r) => !missing(r.approver)) ? 'present' : 'missing' : 'not_verified', detail: 'An approver name is not proof of authority. Reconcile to the applicable delegation matrix.', sourceIds: refs },
    { label: 'Signature or system approval', result: 'not_verified', detail: 'Inspect signed originals or attributable, timestamped system audit logs. A spreadsheet assertion alone is not approval evidence.', sourceIds: refs },
    { label: 'Transaction linkage', result: transactions.length ? transactions.every((r) => !missing(r.reference)) ? 'present' : 'missing' : evidence.some((e) => field(e, 'workpaperId')) ? 'present' : 'not_verified', detail: 'Confirm that each source relates to the sampled transaction and the control under review.', sourceIds: refs },
  ];
  const workpapers = recordsOf(context, 'Workpaper');
  const tests = recordsOf(context, 'ControlTest');
  // Report an existing independent review assessment, never infer sufficiency from a clean spreadsheet.
  const recordedSufficient = !context.warnings.length && workpapers.length > 0 && evidence.length > 0 &&
    workpapers.every((wp) => ['REVIEWED', 'SIGNED_OFF'].includes(field(wp, 'status')) && field(wp, 'preparedById') && field(wp, 'reviewedById') && field(wp, 'preparedById') !== field(wp, 'reviewedById') && field(wp, 'reviewedAt') && ['objective', 'procedure', 'testPerformed', 'results', 'conclusion'].every((key) => field(wp, key).trim().length >= 20) && evidence.some((e) => field(e, 'workpaperId') === wp.source.recordId) && tests.some((t) => field(t, 'workpaperId') === wp.source.recordId && Number(t.fields.sampleSize) > 0 && Number(t.fields.populationSize) >= Number(t.fields.sampleSize) && field(t, 'periodStart') && field(t, 'periodEnd'))) &&
    evidence.every((e) => e.fields.isSufficient === true && field(e, 'obtainedFrom') && field(e, 'obtainedAt') && docs.some((d) => d.source.recordId === field(e, 'documentId') && field(d, 'extractedText') && field(d, 'checksumSha256') && !d.source.truncated)) &&
    docs.every((d) => evidence.some((e) => field(e, 'documentId') === d.source.recordId)) && !transactions.some((r) => r.issues.length);
  const status = recordedSufficient ? 'SUFFICIENT' : !relevant.length || (!hasText && !evidence.length) ? 'INSUFFICIENT' : 'PARTIALLY_SUFFICIENT';
  return { status, rationale: status === 'SUFFICIENT' ? 'Sufficient for the documented test scope according to the recorded independent human review and linked evidence assessments. This reports an existing assessment, not a new AI assurance opinion. Reconfirm source authenticity, approval authority and coverage before relying on it; sufficiency does not mean the control is effective.' : status === 'INSUFFICIENT' ? 'There is insufficient reviewable evidence to support a control conclusion.' : 'Some evidence or recorded evidence metadata is available. Authenticity, completeness, authority and coverage still require auditor validation; no control effectiveness opinion is concluded.', sourceIds: recordedSufficient ? [...refs, ...workpapers.map((w) => w.source.id), ...tests.map((t) => t.source.id)] : refs, checks };
}
