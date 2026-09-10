import { AI_REVIEW_NOTICE, type AssistantContent, type AuditStatement, DEFAULT_THRESHOLDS, ratingFor, ThresholdsSchema } from '@auditsphere/shared';
import { AiFeature, CopilotRequestDto } from './ai.dto';
import { AuditContext, AuditRecord, field, recordsOf, sourceIds } from './audit-context.types';
import { assessEvidence, reviewTransactions } from './evidence-analysis';
import { transactionExceptionRegister } from './transaction-exceptions';

const item = (text: string, basis: AuditStatement['basis'], ...records: (AuditRecord | undefined)[]): AuditStatement => ({ text, basis, sourceIds: sourceIds(...records) });
const noExceptions = (text: string) => /\bno (?:\w+\s+){0,2}exceptions?\b|\bwithout exceptions?\b|\bnil exceptions?\b/i.test(text);
const positive = (text: string) => /\bcontrols? (?:is |are |was |were )?(?:operating )?effective\b|\bsatisfactory\b/i.test(text);
const nonemptyException = (text: string) => !!text && !noExceptions(text) && !/^(none|nil|n\/?a|not applicable|0)[.!]?$/i.test(text);
const substantive = (text: string) => text.trim().length >= 20;
const names = (records: AuditRecord[]) => records.map((r) => r.source.label).join('; ');

export async function reviewAudit(dto: CopilotRequestDto, context: AuditContext): Promise<AssistantContent> {
  const target = context.records.find((r) => r.source.id === context.target);
  const eng = recordsOf(context, 'Engagement')[0];
  const risks = recordsOf(context, 'Risk'); const controls = recordsOf(context, 'Control'); const workpapers = recordsOf(context, 'Workpaper'); const findings = recordsOf(context, 'Finding');
  const evidence = recordsOf(context, 'Evidence'); const documents = recordsOf(context, 'Document'); const tests = recordsOf(context, 'ControlTest'); const processes = recordsOf(context, 'Process');
  const transactions = await reviewTransactions(context);
  const transactional = transactionExceptionRegister(context, transactions.rows);
  const assessment = assessEvidence(context, transactions.rows);
  const subject = target?.source.label ?? 'the proposed audit area';
  const content: AssistantContent = {
    title: `Audit assistance: ${subject}`, narrative: `Read-only review of ${context.records.length} available sources. Source records and uploaded assertions are not independently verified audit evidence.`,
    sections: [], exceptions: transactional.exceptions, reviewerNotes: [], evidenceAssessment: assessment,
    ratingProposal: { impact: null, likelihood: null, score: null, rating: 'UNRATED', rationale: 'Impact and likelihood have not been established for this observation. Supply evidence and apply the approved methodology before assigning a finding rating.', sourceIds: [] },
    suggestions: [], checklist: [], caveats: [AI_REVIEW_NOTICE, 'Local rule-based audit checks are not model-based document analysis. Narrative-only exceptions, image evidence and complex causal relationships may not be detected.', 'No workpaper approvals, finding closures, report issuance or risk-rating changes are performed.', ...context.warnings, ...transactions.warnings],
  };
  const section = (title: string, items: AuditStatement[] = [], columns: string[] = [], rows: AssistantContent['sections'][number]['rows'] = []) => content.sections.push({ title: title.slice(0, 160), items, columns, rows });
  const note = (priority: 'HIGH' | 'MEDIUM' | 'LOW', area: string, comment: string, ...records: (AuditRecord | undefined)[]) => content.reviewerNotes.push({ priority, area, comment, sourceIds: sourceIds(...records) });
  const exception = (observation: string, risk: string, records: AuditRecord[], status: 'recorded' | 'potential' = 'potential', severity: AssistantContent['exceptions'][number]['severity'] = 'UNRATED') => {
    if (content.exceptions.length < 100) content.exceptions.push({ reference: `EX-${String(content.exceptions.length + 1).padStart(3, '0')}`, observation, risk, severity, status, sourceIds: sourceIds(...records) });
  };
  const riskText = risks.length ? names(risks.slice(0, 3)) : 'Potential unauthorised processing, error or fraud; confirm the relevant risk.';
  for (const test of tests) {
    if (Number(test.fields.exceptions) > 0 || field(test, 'result') === 'FAIL') exception(`${test.fields.exceptions} recorded exceptions; result ${field(test, 'result')}. ${field(test, 'conclusion')}`, riskText, [test], 'recorded');
  }
  for (const wp of workpapers) if (nonemptyException(field(wp, 'exceptions'))) exception(`Workpaper ${wp.source.label} records: ${field(wp, 'exceptions')}`, riskText, [wp], 'recorded');
  for (const e of evidence) {
    if (e.fields.isSufficient === false) exception(`Evidence ${e.source.label} is recorded as insufficient.`, riskText, [e], 'recorded');
    if (!field(e, 'obtainedFrom') || !field(e, 'obtainedAt')) note('MEDIUM', 'Evidence provenance', `Record the source and obtained date for ${e.source.label}.`, e);
  }

  // Quality checks operate on the corresponding workpaper's evidence/findings, not unrelated audit records.
  for (const wp of workpapers) {
    const wpEvidence = evidence.filter((e) => field(e, 'workpaperId') === wp.source.recordId);
    const wpFindings = findings.filter((f) => field(f, 'workpaperId') === wp.source.recordId);
    const wpTests = tests.filter((t) => field(t, 'workpaperId') === wp.source.recordId);
    const supportMissing = !wpEvidence.length || wpEvidence.some((e) => e.fields.isSufficient !== true || !documents.some((d) => d.source.recordId === field(e, 'documentId') && field(d, 'extractedText') && !d.source.truncated));
    if (!substantive(field(wp, 'objective'))) note('HIGH', 'Workpaper objective', 'State a clear test objective linked to the risk and control.', wp);
    if (!substantive(field(wp, 'procedure'))) note('HIGH', 'Procedure adequacy', 'Document the population, selection basis, test steps and exception criteria.', wp);
    else if (!/population|sample|selection|all transactions/i.test(field(wp, 'procedure')) || !/exception|deviation|fail|criteria/i.test(field(wp, 'procedure'))) note('MEDIUM', 'Procedure specificity', 'Specify the tested population, period, selection basis and deviation criteria. A lengthy procedure is not necessarily an adequate test of the objective.', wp);
    if (!field(wp, 'controlId') || !field(wp, 'riskId')) note('MEDIUM', 'Risk-control linkage', 'Confirm and link the relevant control and risk; missing links limit traceability.', wp);
    if (supportMissing) note('HIGH', 'Evidence sufficiency', 'Please provide evidence supporting the conclusion, including transaction references, period coverage and approval authority where applicable. A conclusion alone is not sufficient support.', wp, ...wpEvidence);
    if (!field(wp, 'testPerformed') || !field(wp, 'results')) note('HIGH', 'Work performed', 'Document what was actually tested and the results separately from the planned procedure.', wp);
    if (!substantive(field(wp, 'conclusion'))) note('HIGH', 'Conclusion', 'Conclude against the objective, explain exceptions and cross-reference the supporting evidence.', wp);
    if (positive(field(wp, 'conclusion')) && (supportMissing || assessment.status !== 'SUFFICIENT')) note('HIGH', 'Unsupported conclusion', 'The conclusion asserts effectiveness without sufficient recorded supporting evidence. Qualify or withdraw it pending validation; do not treat a recorded effective status as proof.', wp, ...wpEvidence);
    if (noExceptions(field(wp, 'conclusion')) && (nonemptyException(field(wp, 'exceptions')) || wpTests.some((t) => Number(t.fields.exceptions) > 0) || wpFindings.length)) note('HIGH', 'Inconsistent documentation', 'The conclusion says no exceptions, but linked exception records or findings exist. Reconcile whether they concern the same control, sample and period before finalising.', wp, ...wpFindings, ...wpTests);
    if (field(wp, 'preparedById') && field(wp, 'preparedById') === field(wp, 'reviewedById')) note('HIGH', 'Reviewer independence', 'The same user is recorded as preparer and reviewer. Arrange an independent review.', wp);
  }
  for (const finding of findings) {
    if (!substantive(field(finding, 'condition'))) note('HIGH', 'Finding condition', 'State the observed exception, population, sample, extent and supporting references.', finding);
    if (!field(finding, 'criteria') || !documents.length) note('HIGH', 'Finding criteria', 'Provide the applicable policy or control requirement, version and clause. A stated criterion is not a verified source citation.', finding);
    else note('MEDIUM', 'Criteria traceability', 'Verify that the cited policy or control requirement, version and clause support the condition. The presence of uploaded documents alone does not establish an applicable criterion.', finding);
    if (field(finding, 'cause')) note('MEDIUM', 'Cause confirmation', 'Corroborate the recorded cause through walkthroughs, interviews or analysis; use "Potential causes include..." until confirmed.', finding);
    else note('MEDIUM', 'Cause', 'Investigate and corroborate the root cause; do not infer it from the exception alone.', finding);
    if (!/\d/.test(field(finding, 'impact'))) note('MEDIUM', 'Impact quantification', 'Quantify actual or potential exposure where supportable, or explain why it cannot yet be quantified. Do not equate exposure with a proven loss.', finding);
    if (!field(finding, 'recommendation') || (!field(finding, 'actionOwnerName') && !field(finding, 'actionOwnerId')) || !field(finding, 'dueDate')) note('MEDIUM', 'Actionability', 'Specify the corrective action, accountable owner and agreed timeframe; owner and date must be confirmed by management.', finding);
    const support = evidence.filter((e) => (field(e, 'workpaperId') && field(e, 'workpaperId') === field(finding, 'workpaperId')) || context.links.some((l) => l.from === finding.source.id && l.to === e.source.id && l.relationship === 'supported by'));
    if (!support.length) note('HIGH', 'Finding evidence', 'Provide direct evidence references supporting the condition and assess whether it represents an isolated exception or wider control weakness.', finding);
  }
  const linkedRiskId = field(target, 'riskId');
  const risk = target?.source.kind === 'Risk' ? target : risks.find((r) => r.source.recordId === linkedRiskId) ?? (risks.length === 1 ? risks[0] : undefined);
  const parameters = recordsOf(context, 'UserContext').find((r) => r.source.recordId === 'draft-parameters');
  const impact = dto.impact ?? Number(risk?.fields.residualImpact);
  const likelihood = dto.likelihood ?? Number(risk?.fields.residualLikelihood);
  if (Number.isInteger(impact) && impact >= 1 && impact <= 5 && Number.isInteger(likelihood) && likelihood >= 1 && likelihood <= 5) {
    const model = recordsOf(context, 'ScoringModel')[0];
    const thresholds = ThresholdsSchema.safeParse(model?.fields.thresholds);
    const score = impact * likelihood;
    content.ratingProposal = { impact, likelihood, score, rating: ratingFor(score, thresholds.success ? thresholds.data : DEFAULT_THRESHOLDS), rationale: `${impact} impact x ${likelihood} likelihood = ${score}. ${dto.impact && dto.likelihood ? 'Factors supplied by the auditor for this draft.' : 'Factors inherited from the linked risk register; their applicability to this finding is an assumption requiring confirmation.'} ${thresholds.success ? 'Uses the configured scoring thresholds.' : 'Uses the default application thresholds (5/10/16/25); confirm the approved methodology.'} ${dto.ratingRationale || 'Impact and likelihood rationale must be corroborated with exposure, frequency and extent of exceptions.'} This is a proposal only; existing ratings are unchanged.`, sourceIds: sourceIds(dto.impact ? parameters : risk, model) };
  }

  const observed: AuditStatement[] = [];
  if (eng) observed.push(item(`Recorded audit objective: ${field(eng, 'objectives') || 'not documented'}. Recorded scope: ${field(eng, 'scope') || 'not documented'}.`, 'fact', eng));
  for (const control of controls.slice(0, 5)) observed.push(item(`Recorded control: ${control.source.label}. Requirement: ${field(control, 'description') || 'not documented'}. Its ${field(control, 'effectiveness')} status is a recorded assessment, not independent proof of effectiveness.`, 'fact', control));
  for (const doc of documents.slice(0, 5)) observed.push(item(`Source excerpt from ${doc.source.label}: ${field(doc, 'extractedText').slice(0, 500) || 'No readable text available; only metadata was retrieved.'}`, 'fact', doc));
  const supplied = recordsOf(context, 'UserContext')[0];
  if (supplied) observed.push(item(`Auditor-supplied background: ${field(supplied, 'text').slice(0, 800)}. Not independently verified.`, 'assumption', supplied));
  section('Facts and supplied context', observed.length ? observed : [item('No source-backed audit facts were supplied.', 'missing')]);
  section('Risk-control-procedure linkage', context.links.filter((l) => {
    const from = context.records.find((r) => r.source.id === l.from); return from && ['Entity', 'Process', 'Risk', 'Control', 'Procedure', 'Engagement', 'Workpaper'].includes(from.source.kind);
  }).slice(0, 30).map((l) => ({ text: `${context.records.find((r) => r.source.id === l.from)?.source.label} -> ${context.records.find((r) => r.source.id === l.to)?.source.label} (${l.relationship}).`, basis: 'fact', sourceIds: [l.from, l.to] })));

  switch (dto.feature) {
    case AiFeature.PlanningScope: {
      content.title = `Risk-based planning scope: ${subject}`;
      section('Audit objective', [item(`Assess whether controls over ${processes.length ? names(processes.slice(0, 4)) : subject} are appropriately designed and operating as intended to mitigate ${risks.length ? names(risks.slice(0, 3)) : 'the material risks to be confirmed during planning'}.`, 'recommendation', ...risks.slice(0, 3), ...controls.slice(0, 3))]);
      section('Scope', [item(`In scope: ${field(eng, 'scope') || names(processes) || 'Confirm the processes and end-to-end transaction boundaries before fieldwork.'}`, field(eng, 'scope') ? 'fact' : 'recommendation', eng, ...processes), item(`Out of scope: ${field(eng, 'outOfScope') || 'Not yet agreed; document exclusions and their effect on assurance.'}`, field(eng, 'outOfScope') ? 'fact' : 'missing', eng), item(`Period: ${field(eng, 'periodStart') || 'start not supplied'} to ${field(eng, 'periodEnd') || 'end not supplied'}.`, eng ? 'fact' : 'missing', eng), item(`Locations/business units: ${names(recordsOf(context, 'Entity')) || 'Not established; confirm legal entities, sites and systems.'}`, recordsOf(context, 'Entity').length ? 'fact' : 'missing', ...recordsOf(context, 'Entity'))]);
      section('Key risks', [], ['Risk', 'Process', 'Reason for audit focus'], risks.length ? risks.map((r) => ({ cells: [r.source.label, processes.find((p) => p.source.recordId === field(r, 'processId'))?.source.label ?? 'Process linkage not established', field(r, 'description') || `Recorded residual rating: ${field(r, 'rating')}. Validate its current basis.`], basis: 'assessment', sourceIds: [r.source.id] })) : [{ cells: ['Unauthorised transactions, duplicate processing and incomplete records', 'Confirm relevant process', 'Planning hypotheses only; validate through walkthroughs and risk assessment.'], basis: 'assumption', sourceIds: [] }]);
      section('Audit approach', ['Walk through transaction initiation, authorisation, recording and monitoring; corroborate the process description.', 'Evaluate control design against each identified risk, then test operation across the audit period.', 'Reconcile transaction populations before selecting risk-based samples; investigate each deviation and assess wider implications.', 'Use substantive testing to address residual exposures where controls cannot be relied upon.', 'Consider full-population analytics for duplicate references, approval timing, unusual users and threshold overrides; validate data completeness first.'].map((text) => item(text, 'recommendation', ...controls.slice(0, 3))));
      section('Required information request list', ['Current policies and procedures, approved versions and effective dates.', 'Delegation of authority matrix and approval workflow configuration.', 'Complete transaction population, master data and reconciliation to source-system totals.', 'Supporting transaction documents, approval logs and exception reports for the period.', 'Prior audit findings, management action plans, organisation chart and process/system change log.'].map((text) => item(text, 'recommendation')));
      break;
    }
    case AiFeature.AuditProcedures: {
      content.title = `Linked audit procedures: ${subject}`;
      const selectedControls = controls.length ? controls.slice(0, 6) : [undefined];
      if (controls.length > 6) content.caveats.push('Detailed procedures cover the first six retrieved controls. Select individual controls for the remaining procedures.');
      for (const control of selectedControls) {
        const linked = control ? context.links.filter((l) => l.to === control.source.id && l.relationship === 'mitigated by').map((l) => risks.find((r) => r.source.id === l.from)).filter((r): r is AuditRecord => !!r) : [];
        section(`Test objective: ${control?.source.label ?? 'control to be confirmed'}`, [item(`Determine whether ${control ? `${control.source.label} is implemented as described: ${field(control, 'description') || 'obtain the approved control requirement'}` : 'the selected control is appropriately designed and consistently performed throughout the period'}. Risk addressed: ${names(linked) || 'confirm and link the relevant risk before testing'}.`, 'recommendation', control, ...linked)]);
        section('Procedure', ['Obtain the complete population for the control and reconcile counts and values to the source system.', 'Define the deviation criteria and select a risk-based sample spanning the period, locations and operators; retain the selection method.', `Inspect the evidence for each selected item against the recorded control requirement${control ? ` (${control.source.label})` : ''}.`, 'Where the control concerns approvals, verify the approver against the delegation matrix and confirm approval precedes commitment using source timestamps.', 'Document transaction references, work performed, results and exceptions. Corroborate exceptions with the process owner.', 'Evaluate deviations and any expanded testing before forming a conclusion; do not generalise beyond the tested scope.'].map((text) => item(text, 'recommendation', control, ...linked)));
      }
      section('Expected evidence', ['Approved control description and applicable policy/criteria.', 'Reconciled transaction population and retained sample-selection file.', 'Original transaction records and attributable approval workflow/system logs where applicable.', 'Delegation matrix, access listings, exception explanations and corroborating documents.'].map((text) => item(text, 'recommendation')));
      const population = dto.populationSize ?? Number(tests[0]?.fields.populationSize);
      section('Sampling suggestions', [item(Number.isInteger(population) && population > 0 ? `Recorded/supplied population: ${population}. Consider 100% automated checks where reliable data is available, with targeted inspection of high-risk items and coverage across the period. A defensible sample size cannot be calculated from population alone.` : 'Population size and completeness are not established. Obtain and reconcile the population before choosing a sample.', Number.isInteger(population) && population > 0 ? 'assessment' : 'missing', tests[0]), item(`Control frequency: ${controls.map((c) => `${c.source.label}: ${field(c, 'frequency')}`).join('; ') || 'not supplied'}. Consider frequency, reliance, confidence level, tolerable/expected deviation and population stratification under the approved methodology. Record auditor-approved sample size and rationale; no statistical assurance is implied by a suggested count.`, 'recommendation', ...controls)]);
      break;
    }
    case AiFeature.EvidenceSummary:
      content.title = `Evidence review & exception analysis: ${subject}`;
      content.sections.unshift(transactional.register);
      section('Evidence completeness review', assessment.checks.map((c) => ({ text: `${c.label}: ${c.result}. ${c.detail}`, basis: c.result === 'missing' ? 'missing' : 'assessment', sourceIds: c.sourceIds })));
      section('Transaction evidence reviewed', [], ['Reference', 'Supplier', 'Amount', 'Approval', 'Commitment', 'Review result'], transactions.rows.slice(0, 80).map((r) => ({ cells: [r.reference || 'Not supplied', r.supplier || 'Not supplied', r.amount, `${r.approver || 'No approver'}; ${r.approvalDate || 'No approval date'}`, r.commitmentDate || 'Not supplied', r.issues.length ? `${r.issues.length} potential exceptions/gaps` : 'No rule-detected row exceptions; source validation remains outstanding'], basis: 'assessment', sourceIds: [r.sourceId] })));
      section('Evidence sufficiency conclusion', [item(`${assessment.status}: ${assessment.rationale}`, 'assessment', ...evidence, ...documents)]);
      section('Follow-up procedures', ['Obtain missing original documents and dates; link them to the tested transaction.', 'Confirm approval authority against the delegation matrix applicable on the transaction date.', 'Inspect attributable system approval logs or signed originals and resolve timing exceptions.', 'Assess exception causes and extend testing if the evidence suggests a wider pattern; document the expansion rationale.'].map((text) => item(text, 'recommendation')));
      break;
    case AiFeature.FindingDraft: {
      const finding = target?.source.kind === 'Finding' ? target : findings[0];
      const observation = field(finding, 'condition') || content.exceptions.map((e) => e.observation).slice(0, 3).join(' ');
      content.title = finding ? `Draft finding: ${field(finding, 'title')}` : 'Draft finding: Gaps in control performance evidence';
      section('Finding title', [item(field(finding, 'title') || (observation ? 'Gaps in documented control performance and approval evidence' : 'Finding title pending corroborated exception'), 'recommendation', finding)]);
      section('Condition', [item(observation || 'No corroborated condition is available. Document what happened, affected transactions, period and extent before raising a finding.', observation ? 'assessment' : 'missing', finding, ...context.records.filter((r) => content.exceptions.some((e) => e.sourceIds.includes(r.source.id))).slice(0, 5))]);
      section('Criteria', [item(field(finding, 'criteria') || (controls[0] ? `Recorded control requirement: ${field(controls[0], 'description') || controls[0].source.label}. Obtain the approved policy, version and exact clause.` : 'Applicable policy/control requirement and clause are not supplied; do not invent a standard or requirement.'), finding || controls[0] ? 'fact' : 'missing', finding, controls[0])]);
      section('Cause', [item(field(finding, 'cause') ? `Potential causes include the recorded explanation: ${field(finding, 'cause')}. Corroborate before describing it as the confirmed cause.` : 'Potential causes include unclear accountability, workflow configuration or evidence-retention gaps. These are investigation hypotheses, not established causes; validate through walkthroughs and analysis.', 'assumption', finding)]);
      section('Consequence / impact', [item(field(finding, 'impact') || `The identified gaps may expose the process to ${riskText}. Assess financial exposure, operational disruption, compliance implications and potential fraud; no actual loss is established from this review.`, field(finding, 'impact') ? 'fact' : 'assessment', finding, ...risks.slice(0, 3))]);
      section('Recommendation', [item(`${field(finding, 'actionOwnerName') || 'The accountable process owner (to be confirmed)'} should ${field(finding, 'recommendation') || 'establish and enforce the documented control, retain attributable evidence, and investigate identified exceptions'}. Timeframe: ${field(finding, 'dueDate') || 'propose completion within 60 days of management agreement, subject to confirmed risk priority and feasibility'}. Validate implementation through independent follow-up.`, 'recommendation', finding, ...controls.slice(0, 2))]);
      section('Risk rating proposal', [item(content.ratingProposal.rationale, 'assessment', risk), item('Management must confirm the action owner and due date. This draft does not constitute agreement or an approved finding.', 'recommendation')]);
      break;
    }
    case AiFeature.ReportSummary: {
      content.title = `Executive audit summary: ${subject}`;
      const metrics = recordsOf(context, 'Metrics')[0];
      const counts = (metrics?.fields.counts ?? []) as { severity: string; status: string; count: number }[];
      section('Executive summary', [item(`Objective: ${field(eng, 'objectives') || 'not established'}. Scope: ${field(eng, 'scope') || 'not established'}.`, eng ? 'fact' : 'missing', eng), item(`Overall opinion: ${field(eng, 'opinion') && field(eng, 'opinion') !== 'NOT_RATED' ? `the engagement records ${field(eng, 'opinion')}; this is not a new AI assurance conclusion` : 'not concluded; the authorised auditor must evaluate completed work and unresolved limitations'}.`, eng ? 'fact' : 'missing', eng), item(`Key matters reviewed: ${findings.length ? findings.slice(0, 5).map((f) => `${f.source.label} (${field(f, 'severity')}; ${field(f, 'status')})`).join('; ') : 'No finding detail is available in this context; do not interpret this as a clean audit.'}`, findings.length ? 'fact' : 'missing', ...findings.slice(0, 5))]);
      section('Dashboard', [], ['Metric', 'Result'], ['Total findings', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((severity) => ({ cells: [severity, metrics ? String(counts.filter((c) => severity === 'Total findings' || c.severity === severity).reduce((sum, c) => sum + c.count, 0)) : 'Complete counts unavailable'], basis: metrics ? 'fact' : 'missing', sourceIds: sourceIds(metrics) })));
      section('Management themes', findings.length ? Array.from(new Set(findings.map((f) => field(f, 'rootCauseCategory') || 'Cause not classified'))).map((theme) => item(`${theme}: ${findings.filter((f) => (field(f, 'rootCauseCategory') || 'Cause not classified') === theme).length} findings in the reviewed subset. Confirm theme and cause with management; subset counts may not equal the dashboard total.`, 'assessment', ...findings.filter((f) => (field(f, 'rootCauseCategory') || 'Cause not classified') === theme))) : [item('Management themes cannot be supported without finding and cause information.', 'missing')]);
      section('Management commitments and limitations', findings.map((f) => item(`${f.source.label}: ${field(f, 'actionOwnerName') || 'owner not confirmed'}; due ${field(f, 'dueDate') || 'date not agreed'}; response: ${field(f, 'managementResponse') || 'not recorded'}.`, 'fact', f)));
      break;
    }
    case AiFeature.QualityCheck:
      content.title = `Senior reviewer quality check: ${subject}`;
      if (!workpapers.length && !findings.length) note('HIGH', 'Review scope', 'Select a workpaper, finding or engagement to assess actual objectives, procedures, evidence and conclusions. Document excerpts alone do not establish file completeness.');
      section('Workpaper quality', workpapers.map((wp) => item(`${wp.source.label}: objective ${substantive(field(wp, 'objective')) ? 'documented' : 'missing/unclear'}; procedure ${substantive(field(wp, 'procedure')) ? 'documented, adequacy requires review' : 'missing/unclear'}; conclusion ${substantive(field(wp, 'conclusion')) ? 'recorded, support must be evaluated' : 'missing/unclear'}.`, 'assessment', wp)));
      section('Finding quality', findings.map((f) => item(`${f.source.label}: assess condition support, cited criteria, corroborated cause, quantified impact and actionable recommendation. Recorded severity is ${field(f, 'severity')}, not recalculated or approved by this review.`, 'assessment', f)));
      section('Review disposition', [item(content.reviewerNotes.length ? `${content.reviewerNotes.length} review notes require auditor assessment. Resolve material support and consistency gaps before requesting formal sign-off.` : 'No rule-detected documentation issues were found in the retrieved subset. This does not establish evidence sufficiency or replace independent review.', 'assessment'), item('Reviewer notes are suggestions only. They have not been posted as formal review notes or used to approve a workpaper.', 'assessment')]);
      break;
    case AiFeature.RiskRadar: {
      content.title = 'Risk radar and audit focus recommendations';
      const signals = recordsOf(context, 'RiskSignal');
      section('Emerging risks', [], ['Risk / signal', 'Driver', 'Recorded / proposed rating'], signals.map((s) => ({ cells: [s.source.label, field(s, 'summary') || 'Driver requires investigation', 'UNRATED - assess impact and likelihood'], basis: 'assessment', sourceIds: [s.source.id] })));
      for (const r of risks) {
        const linked = context.links.filter((l) => l.from === r.source.id && l.relationship === 'mitigated by');
        if (!linked.length) note('HIGH', 'Missing control linkage', `No mitigating control was retrieved for ${r.source.label}. Confirm whether this is a missing control, missing linkage, a permission restriction or a retrieval limit before concluding a design gap.`, r);
      }
      section('Control weaknesses', [], ['Control', 'Recorded condition', 'Audit response'], controls.filter((c) => ['INEFFECTIVE', 'PARTIALLY_EFFECTIVE', 'NOT_TESTED'].includes(field(c, 'effectiveness'))).map((c) => ({ cells: [c.source.label, field(c, 'effectiveness'), 'Prioritise design review and targeted testing; validate the recorded assessment and current remediation.'], basis: 'assessment', sourceIds: [c.source.id] })));
      section('Repeated findings and previous audits', [...findings.filter((f) => f.fields.isRepeat).map((f) => item(`${f.source.label} is recorded as a repeat finding. Investigate whether prior remediation addressed the underlying cause.`, 'assessment', f)), ...recordsOf(context, 'Engagement').map((e) => item(`Previous/current audit: ${e.source.label}; ${field(e, 'stage')}; period ${field(e, 'periodStart') || 'unknown'} to ${field(e, 'periodEnd') || 'unknown'}.`, 'fact', e))]);
      section('Process changes', [item('Obtain process-change logs, new supplier dependencies, system releases and organisation changes. A record update timestamp alone does not prove a process change or emerging risk.', 'missing', ...processes)]);
      section('Heat map recommendations', risks.filter((r) => ['HIGH', 'CRITICAL'].includes(field(r, 'rating'))).map((r) => item(`Consider ${r.source.label} for audit focus: recorded residual rating ${field(r, 'rating')} and score ${field(r, 'residualScore')}. Corroborate current exposure and control coverage before proposing a revised assessment.`, 'recommendation', r)));
      if (!signals.length) section('Signal limitations', [item('No readable emerging-risk signals were retrieved. External events and process changes have not been independently researched.', 'missing')]);
      break;
    }
    case AiFeature.NaturalLanguageSearch:
      content.title = 'Audit intelligence search results';
      content.narrative = context.search?.interpretation ?? 'No search interpretation is available.';
      section('Search results', (context.search?.results ?? []).map((result) => {
        const record = context.records.find((r) => r.source.id === result.sourceId)!;
        return item(`${record.source.kind}: ${record.source.label}. ${result.reason}.`, 'fact', record);
      }));
      if (!context.search?.results.length) section('No matching records', [item('No records were found under the displayed filters and permissions. Broaden the keywords or date range; absence from results is not proof that no exceptions exist.', 'missing')]);
      break;
  }
  section('Missing information and assumptions', [
    ...(!risks.length ? [item('Risk linkage and risk assessment inputs are not established.', 'missing')] : []),
    ...(!controls.length ? [item('The control requirement and frequency are not established.', 'missing')] : []),
    ...(!documents.length ? [item('No readable source documents were supplied or retrieved.', 'missing')] : []),
    item('Source statements, control statuses and management explanations require independent corroboration. Audit judgement remains with the responsible auditor.', 'assumption'),
  ]);
  content.suggestions = [...new Set(content.reviewerNotes.slice(0, 8).map((n) => n.comment))];
  if (!content.suggestions.length) content.suggestions = ['Confirm scope, source reliability and missing information before incorporating this draft into the audit file.'];
  content.checklist = ['Auditor reviewed cited source records and original documents', 'Facts, assumptions and unresolved exceptions distinguished', 'Risk-control-procedure-evidence linkage validated', 'Scope and sampling limitations documented', 'Independent reviewer assessed conclusions and proposed ratings'];
  let shortened = false;
  const clip = (text: string, limit: number) => { if (text.length <= limit) return text; shortened = true; return `${text.slice(0, limit - 12)} [excerpt]`; };
  content.title = clip(content.title, 300);
  for (const s of content.sections) { s.items = s.items.slice(0, 100).map((i) => ({ ...i, text: clip(i.text, 12000) })); s.rows = s.rows.slice(0, 100).map((r) => ({ ...r, cells: r.cells.map((c) => clip(c, 4000)) })); }
  content.exceptions = content.exceptions.map((e) => ({ ...e, observation: clip(e.observation, 12000), risk: clip(e.risk, 12000) }));
  if (content.reviewerNotes.length > 100) { shortened = true; content.reviewerNotes = content.reviewerNotes.slice(0, 100); }
  if (shortened || content.exceptions.length === 100) content.caveats.push('Output detail was bounded for this review. Inspect the cited originals and narrow the target for further analysis.');
  return content;
}
