import { EXCEPTION_REGISTER_COLUMNS, EXCEPTION_REGISTER_TITLE, type AssistantContent } from '@auditsphere/shared';
import { AuditContext, AuditRecord, field, recordsOf } from './audit-context.types';
import { missingTransactionValue as missing, TransactionIssueCode, TransactionReview } from './evidence-analysis';

const CRITERIA: Record<TransactionIssueCode, { requirement: string; impact: string; followUp: string }> = {
  reference: { requirement: 'Retain a unique transaction reference linking the entry to supporting evidence.', impact: 'Potential inability to trace or validate the transaction, including duplicate or unsupported processing.', followUp: 'Obtain the original transaction identifier and reconcile the entry to the source-system population and supporting documents.' },
  approver: { requirement: 'Approval evidence identifies the approver and supports authority under the applicable delegation matrix.', impact: 'Potential unauthorised expenditure or payments outside delegated authority; actual loss is not established.', followUp: 'Obtain the attributable approval workflow log or signed approval identifying the approver. Verify their authority for the transaction amount and date against the applicable delegation matrix; investigate and corroborate any breach.' },
  approvalDate: { requirement: 'Retain a dated approval that can be compared with commitment.', impact: 'Potential retrospective or unauthorised approval; the timing of authorisation cannot be established.', followUp: 'Obtain the original approval timestamp or dated signed record and compare it with the source commitment timestamp.' },
  commitmentDate: { requirement: 'Retain the commitment date needed to test whether authorisation occurred beforehand.', impact: 'Potential commitment before authorisation; timing cannot be tested from the supplied row.', followUp: 'Obtain the purchase-order release, contract or commitment timestamp and compare it with the approval record.' },
  lateApproval: { requirement: 'Obtain authorised approval before procurement commitment.', impact: 'Potential unauthorised commitment and retrospective approval; verify the dates and applicable exceptions before concluding a breach.', followUp: 'Confirm the approval and commitment timestamps from original system logs. Investigate retrospective approval, verify any permitted exception and approver authority, and consider expanding the sample if corroborated.' },
  ambiguousDate: { requirement: 'Retain unambiguous, valid approval and commitment timestamps.', impact: 'Potential undetected timing exceptions because the supplied date values cannot reliably establish the event sequence.', followUp: 'Confirm the date format and timezone with the source-system owner, obtain valid ISO dates or original timestamps, then repeat the approval-timing test.' },
};

function transactionControl(context: AuditContext, row: TransactionReview): AuditRecord | undefined {
  const controls = recordsOf(context, 'Control');
  if (!missing(row.controlReference)) {
    const match = controls.filter((c) => [c.source.recordId, field(c, 'code'), field(c, 'title')].some((value) => value.toLowerCase() === row.controlReference.toLowerCase()));
    return match.length === 1 ? match[0] : undefined;
  }
  const document = context.records.find((r) => r.source.id === row.sourceId);
  const workpaperIds = recordsOf(context, 'Evidence').filter((e) => field(e, 'documentId') === document?.source.recordId).map((e) => field(e, 'workpaperId'));
  const ids = recordsOf(context, 'Workpaper').filter((w) => workpaperIds.includes(w.source.recordId)).map((w) => field(w, 'controlId')).filter(Boolean);
  const target = context.records.find((r) => r.source.id === context.target);
  if (target?.source.kind === 'Control') ids.push(target.source.recordId);
  else if (target && ['Workpaper', 'Finding', 'Procedure'].includes(target.source.kind) && field(target, 'controlId')) ids.push(field(target, 'controlId'));
  const unique = [...new Set(ids)];
  return unique.length === 1 ? controls.find((c) => c.source.recordId === unique[0]) : undefined;
}

export function transactionExceptionRegister(context: AuditContext, transactions: TransactionReview[]) {
  const exceptions: AssistantContent['exceptions'] = [];
  const register: AssistantContent['sections'][number] = {
    title: EXCEPTION_REGISTER_TITLE, columns: [...EXCEPTION_REGISTER_COLUMNS], rows: [],
    items: [{ text: transactions.length ? 'Potential transactional exceptions and evidence gaps, subject to auditor corroboration. Amounts are source-reported transaction values, not quantified losses; repeated amounts across exceptions must not be totalled. Severity is source-reported where supplied, otherwise UNRATED. Confirm the applicable control requirement.' : 'No structured transaction rows were identified in the readable excerpts. Review original documents or supply a transaction listing; no absence-of-exceptions conclusion is made.', basis: 'assessment', sourceIds: [] }],
  };
  for (const row of transactions) {
    const control = transactionControl(context, row);
    const risks = control ? recordsOf(context, 'Risk').filter((r) => context.links.some((l) => l.from === r.source.id && l.to === control.source.id && l.relationship === 'mitigated by')) : [];
    const source = context.records.find((r) => r.source.id === row.sourceId)!;
    const ids = [row.sourceId, ...(control ? [control.source.id] : []), ...risks.slice(0, 3).map((r) => r.source.id)];
    const transaction = missing(row.reference) ? `unreferenced transaction (${row.location})` : `transaction ${row.reference}`;
    const supplier = missing(row.supplier) ? 'the supplier/vendor not identified in the source' : row.supplier;
    const value = row.amount === 'Not supplied' ? 'with amount not supplied' : `amounting to ${row.amount}`;
    const subject = `${supplier} ${value} (${transaction})`;
    const observed = `${source.source.label}, ${row.location}. Reference: ${missing(row.reference) ? 'not supplied' : row.reference}; supplier/vendor: ${missing(row.supplier) ? 'not supplied' : row.supplier}; amount: ${row.amount}; approver: ${missing(row.approver) ? 'not identified' : row.approver}; approval date: ${missing(row.approvalDate) ? 'not supplied' : row.approvalDate}; commitment date: ${missing(row.commitmentDate) ? 'not supplied' : row.commitmentDate}.${missing(row.evidenceObserved) ? '' : ` Source-stated evidence: ${row.evidenceObserved}`}`;
    for (const issue of row.issueDetails) {
      if (exceptions.length === 100) break;
      const criterion = CRITERIA[issue.code];
      const observation = {
        reference: `Exception: The transaction for ${subject} could not be traced to its original record because the supplied evidence did not include a transaction reference.`,
        approver: `Exception: Approval authority could not be confirmed for ${subject} because the supplied approval evidence did not identify the approver.`,
        approvalDate: `Exception: Approval timing could not be confirmed for ${subject} because the supplied evidence did not include an approval date.`,
        commitmentDate: `Exception: Approval before commitment could not be confirmed for ${subject} because the supplied evidence did not include the commitment date.`,
        lateApproval: `Exception: Approval for ${subject} was recorded on ${row.approvalDate}, after the commitment date of ${row.commitmentDate}. Confirm both dates and the applicable requirement before concluding a control breach.`,
        ambiguousDate: `Exception: Approval timing could not be confirmed for ${subject} because the supplied date format is ambiguous or invalid (approval: ${row.approvalDate || 'not supplied'}; commitment: ${row.commitmentDate || 'not supplied'}).`,
      }[issue.code];
      const requirement = !missing(row.controlRequirement) ? `Source-stated requirement: ${row.controlRequirement}` : control ? `Recorded control ${control.source.label}: ${field(control, 'description') || 'description not supplied'}. Review criterion, applicability to confirm: ${criterion.requirement}` : `${missing(row.controlReference) ? '' : `Unresolved control reference ${row.controlReference}. `}Review criterion (policy/control requirement to confirm): ${criterion.requirement}`;
      const impact = `${criterion.impact}${risks.length ? ` Linked risk: ${risks.slice(0, 3).map((r) => r.source.label).join('; ')}.` : ' Risk linkage requires confirmation.'}`;
      const severity = row.severity.trim().toUpperCase();
      const rating = (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(severity) ? severity : 'UNRATED') as AssistantContent['exceptions'][number]['severity'];
      const reference = `EX-${String(exceptions.length + 1).padStart(3, '0')}`;
      exceptions.push({ reference, observation, risk: impact, severity: rating, status: 'potential', sourceIds: ids });
      register.rows.push({ cells: [reference, missing(row.reference) ? 'Not supplied' : row.reference, missing(row.supplier) ? 'Not supplied' : row.supplier, row.amount, requirement, observed, observation, impact, rating === 'UNRATED' ? 'UNRATED - auditor assessment required' : `${rating} (source-reported; confirm)`, criterion.followUp], basis: 'assessment', sourceIds: ids });
    }
  }
  if (transactions.length && !exceptions.length) register.items.push({ text: 'No rule-detected transactional exceptions were identified in the parsed rows. Approval authority, authenticity, policy applicability and population completeness still require auditor validation.', basis: 'assessment', sourceIds: [...new Set(transactions.map((r) => r.sourceId))] });
  if (exceptions.length === 100) register.items.push({ text: 'Register limited to 100 exceptions. Narrow the source data and review remaining transactions separately.', basis: 'missing', sourceIds: [] });
  return { register, exceptions };
}
