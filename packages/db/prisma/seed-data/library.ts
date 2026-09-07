/**
 * BDO methodology library content. AUDIT_PROGRAM items use the content shape
 * defined in docs/api/contract-phase1.md:
 *   { sections: [{ name, steps: [{ reference, objective, procedure, estimatedHours }] }] }
 */
export type LibraryType = 'AUDIT_PROGRAM' | 'TEST_PROCEDURE' | 'FINDING' | 'RECOMMENDATION';

export interface ProgramStepSeed {
  reference: string;
  objective: string;
  procedure: string;
  estimatedHours: number;
  /** Optional risk / control codes used when the programme is instantiated for demo engagements. */
  riskCode?: string;
  controlCode?: string;
}

export interface ProgramSectionSeed {
  name: string;
  steps: ProgramStepSeed[];
}

export interface LibraryItemSeed {
  code: string;
  type: LibraryType;
  title: string;
  summary: string;
  industry?: string;
  tags: string[];
  /** [frameworkCode, refCode] pairs */
  frameworkRefs: [string, string][];
  content: Record<string, unknown>;
}

export const PROGRAM_P2P: ProgramSectionSeed[] = [
  {
    name: 'Planning',
    steps: [
      {
        reference: 'P.1',
        objective: 'Understand the end-to-end procure-to-pay process and key systems.',
        procedure:
          'Obtain process documentation, delegation of authority matrix and ERP workflow configuration. Hold walkthrough meetings with Procurement and Accounts Payable and document the flow from requisition to payment, identifying key controls and system dependencies.',
        estimatedHours: 6,
      },
      {
        reference: 'P.2',
        objective: 'Confirm the risk and control matrix for the process.',
        procedure:
          'Map identified risks to controls in the risk register. Agree the scope, sampling approach and period with the engagement manager and process owner. Update the engagement risk assessment.',
        estimatedHours: 4,
      },
      {
        reference: 'P.3',
        objective: 'Obtain populations for testing.',
        procedure:
          'Request the full population of purchase orders, goods receipts, invoices and payments for the period through the document request portal. Reconcile the population to the general ledger before sampling.',
        estimatedHours: 4,
      },
    ],
  },
  {
    name: 'Purchase requisition and ordering',
    steps: [
      {
        reference: 'B.1',
        objective: 'Confirm purchases are authorised in line with the delegation of authority.',
        procedure:
          'Select a sample of 25 purchase orders. For each, verify the requisition exists, the approver held the required authority for the value, and approval preceded the order date. Investigate any after-the-fact approvals.',
        estimatedHours: 10,
        riskCode: 'R-002',
        controlCode: 'C-002',
      },
      {
        reference: 'B.2',
        objective: 'Confirm competitive sourcing and vendor selection are documented.',
        procedure:
          'For orders above the tender threshold, obtain evidence of quotations or tender evaluation, conflict-of-interest declarations and contract approval.',
        estimatedHours: 8,
        riskCode: 'R-004',
        controlCode: 'C-005',
      },
    ],
  },
  {
    name: 'Receiving, invoicing and payment',
    steps: [
      {
        reference: 'B.3',
        objective: 'Test the operating effectiveness of the three-way match.',
        procedure:
          'Select 25 paid invoices. Agree quantity and price to the purchase order and goods receipt note; confirm ERP tolerance settings and that any override was approved. Record exceptions and evaluate control effectiveness.',
        estimatedHours: 12,
        riskCode: 'R-001',
        controlCode: 'C-001',
      },
      {
        reference: 'B.4',
        objective: 'Identify duplicate or suspicious payments.',
        procedure:
          'Run duplicate payment analytics on the full payment population (same vendor, amount and invoice number variants; same bank account across vendors; round amounts; weekend postings). Investigate matches and confirm the weekly duplicate report was reviewed.',
        estimatedHours: 10,
        riskCode: 'R-001',
        controlCode: 'C-003',
      },
      {
        reference: 'B.5',
        objective: 'Confirm vendor master data changes are independently reviewed.',
        procedure:
          'Obtain the vendor master change log. Select 25 changes (new vendors and bank detail changes). Verify supporting documentation, call-back verification for bank changes and evidence of independent review.',
        estimatedHours: 8,
        riskCode: 'R-003',
        controlCode: 'C-004',
      },
    ],
  },
  {
    name: 'Reporting',
    steps: [
      {
        reference: 'R.1',
        objective: 'Conclude on control effectiveness and draft findings.',
        procedure:
          'Summarise test results by control, rate findings using the BDO severity matrix, validate facts with the process owner and draft the report using the standard template.',
        estimatedHours: 8,
      },
    ],
  },
];

export const PROGRAM_UAM: ProgramSectionSeed[] = [
  {
    name: 'Planning',
    steps: [
      {
        reference: 'P.1',
        objective: 'Understand the identity and access management landscape.',
        procedure:
          'Obtain the access management policy, list of in-scope applications (core banking, ERP, Active Directory), joiner-mover-leaver procedures and the privileged access inventory.',
        estimatedHours: 6,
      },
      {
        reference: 'P.2',
        objective: 'Agree scope and obtain system extracts.',
        procedure:
          'Request user listings with roles, last logon and creation dates for each in-scope system, HR joiner and leaver lists for the period and the privileged account register.',
        estimatedHours: 4,
      },
    ],
  },
  {
    name: 'Joiners and movers',
    steps: [
      {
        reference: 'B.1',
        objective: 'Confirm access is granted only on approved request.',
        procedure:
          'Select 25 accounts created in the period. Verify an approved access request exists, the roles granted match the request and approval was by the line manager and application owner.',
        estimatedHours: 8,
      },
      {
        reference: 'B.2',
        objective: 'Confirm role changes on transfer are appropriate.',
        procedure:
          'Select 15 staff who changed role. Confirm previous access was removed and current access matches the new role profile.',
        estimatedHours: 6,
      },
    ],
  },
  {
    name: 'Leavers and privileged access',
    steps: [
      {
        reference: 'B.3',
        objective: 'Confirm leaver access is removed promptly.',
        procedure:
          'Compare the HR leaver list to active accounts in each system. For all leavers, verify the disable date and calculate the days between exit and deprovisioning against the 24-hour standard.',
        estimatedHours: 8,
        riskCode: 'R-010',
        controlCode: 'C-011',
      },
      {
        reference: 'B.4',
        objective: 'Evaluate privileged access management.',
        procedure:
          'Obtain the privileged access register and quarterly review evidence. Confirm all privileged accounts are named, justified, reviewed each quarter and that generic accounts are vaulted with session logging.',
        estimatedHours: 10,
        riskCode: 'R-009',
        controlCode: 'C-010',
      },
      {
        reference: 'B.5',
        objective: 'Assess authentication configuration.',
        procedure:
          'Review password and MFA settings against policy for each system. Test that MFA is enforced for remote and privileged access.',
        estimatedHours: 6,
      },
    ],
  },
  {
    name: 'Reporting',
    steps: [
      {
        reference: 'R.1',
        objective: 'Conclude and report.',
        procedure:
          'Summarise exceptions, assess root causes with IT management, rate findings and draft the report.',
        estimatedHours: 6,
      },
    ],
  },
];

export const PROGRAM_PAYROLL: ProgramSectionSeed[] = [
  {
    name: 'Planning',
    steps: [
      {
        reference: 'P.1',
        objective: 'Understand the payroll process and systems.',
        procedure:
          'Document the flow from HR master data through payroll calculation, approval, disbursement and statutory remittance. Identify interfaces between the HR system, payroll and the general ledger.',
        estimatedHours: 5,
      },
      {
        reference: 'P.2',
        objective: 'Obtain payroll populations.',
        procedure:
          'Request monthly payroll registers, HR headcount reports, master file change logs and statutory remittance schedules for the period.',
        estimatedHours: 3,
      },
    ],
  },
  {
    name: 'Master data and calculation',
    steps: [
      {
        reference: 'B.1',
        objective: 'Confirm payroll master file changes are authorised.',
        procedure:
          'Select 25 master file changes (new hires, salary changes, bank changes). Verify approved documentation and independent review.',
        estimatedHours: 8,
        riskCode: 'R-008',
        controlCode: 'C-008',
      },
      {
        reference: 'B.2',
        objective: 'Test for ghost employees.',
        procedure:
          'Reconcile the payroll register to the HR headcount. Analyse for duplicate bank accounts, identity numbers and employees without leave or attendance records. Perform physical verification for a sample.',
        estimatedHours: 10,
        riskCode: 'R-007',
        controlCode: 'C-009',
      },
      {
        reference: 'B.3',
        objective: 'Recalculate pay and deductions.',
        procedure:
          'For 20 employees recalculate gross to net including PAYE, NSSF, SHIF and housing levy. Agree to the payroll register.',
        estimatedHours: 8,
      },
    ],
  },
  {
    name: 'Disbursement and statutory compliance',
    steps: [
      {
        reference: 'B.4',
        objective: 'Confirm payroll approval and disbursement controls.',
        procedure:
          'Verify each monthly payroll was approved before disbursement and that bank file totals agree to the approved register.',
        estimatedHours: 6,
      },
      {
        reference: 'B.5',
        objective: 'Confirm statutory deductions were remitted on time.',
        procedure:
          'Agree statutory remittances to filing receipts and payment dates against statutory deadlines. Quantify penalties incurred.',
        estimatedHours: 5,
        riskCode: 'R-019',
        controlCode: 'C-021',
      },
    ],
  },
  {
    name: 'Reporting',
    steps: [
      {
        reference: 'R.1',
        objective: 'Conclude and report.',
        procedure: 'Summarise results, rate findings, validate with HR and Finance and draft the report.',
        estimatedHours: 5,
      },
    ],
  },
];

export const LIBRARY_ITEMS: LibraryItemSeed[] = [
  {
    code: 'LIB-AP-P2P',
    type: 'AUDIT_PROGRAM',
    title: 'Procure-to-pay audit programme',
    summary:
      'Standard BDO programme covering requisition, ordering, receiving, invoicing, vendor master data and payment controls.',
    industry: 'Financial services',
    tags: ['procurement', 'accounts payable', 'p2p', 'vendor master'],
    frameworkRefs: [
      ['COSO', 'CA-10'],
      ['COSO', 'CA-12'],
      ['COSO', 'RA-8'],
      ['COBIT', 'DSS06'],
    ],
    content: { sections: PROGRAM_P2P },
  },
  {
    code: 'LIB-AP-UAM',
    type: 'AUDIT_PROGRAM',
    title: 'User access management audit programme',
    summary:
      'Joiner, mover, leaver and privileged access testing across core banking, ERP and directory services.',
    industry: 'Financial services',
    tags: ['it general controls', 'access', 'identity', 'privileged access'],
    frameworkRefs: [
      ['COSO', 'CA-11'],
      ['ISO27001', 'A.5.15'],
      ['ISO27001', 'A.5.18'],
      ['ISO27001', 'A.8.2'],
      ['COBIT', 'DSS05'],
    ],
    content: { sections: PROGRAM_UAM },
  },
  {
    code: 'LIB-AP-PAY',
    type: 'AUDIT_PROGRAM',
    title: 'Payroll audit programme',
    summary: 'Master data, ghost employee analytics, recalculation, disbursement and statutory compliance.',
    industry: 'All',
    tags: ['payroll', 'hr', 'statutory', 'fraud'],
    frameworkRefs: [
      ['COSO', 'CA-10'],
      ['COSO', 'RA-8'],
      ['IFRS', 'IAS 19'],
    ],
    content: { sections: PROGRAM_PAYROLL },
  },
  {
    code: 'LIB-TP-001',
    type: 'TEST_PROCEDURE',
    title: 'Three-way match operating effectiveness test',
    summary: 'Sample-based test that invoices were matched to purchase orders and goods receipts before payment.',
    tags: ['p2p', 'three-way match', 'sampling'],
    frameworkRefs: [['COSO', 'CA-10']],
    content: {
      objective: 'Confirm the three-way match control operated throughout the period.',
      procedure:
        'Select 25 paid invoices using random sampling from the reconciled population. For each, agree invoice quantity and unit price to the purchase order and the goods receipt note within configured tolerances. Where a tolerance override occurred, obtain the approval.',
      sampling: 'Random, 25 items for a control operating daily; extend by 15 where one exception is found.',
      evidence: 'Invoice, PO, GRN, ERP match log, override approval.',
      exceptionCriteria: 'Any payment without a matched PO and GRN, or override without approval.',
    },
  },
  {
    code: 'LIB-TP-002',
    type: 'TEST_PROCEDURE',
    title: 'Leaver deprovisioning timeliness test',
    summary: 'Full-population comparison of HR leavers to active system accounts.',
    tags: ['access', 'leavers', 'itgc'],
    frameworkRefs: [
      ['ISO27001', 'A.5.18'],
      ['COBIT', 'DSS05'],
    ],
    content: {
      objective: 'Confirm access is removed within 24 hours of an employee leaving.',
      procedure:
        'Obtain the HR leaver list and user listings with disable dates. Match on employee number. For each leaver compute the days between exit date and account disable date; list accounts still active.',
      sampling: 'Full population.',
      evidence: 'HR leaver report, system user extract with timestamps, deprovisioning tickets.',
      exceptionCriteria: 'Account active more than 1 working day after exit.',
    },
  },
  {
    code: 'LIB-TP-003',
    type: 'TEST_PROCEDURE',
    title: 'Duplicate payment analytics',
    summary: 'Data analytics routine over the full payment population.',
    tags: ['analytics', 'p2p', 'fraud'],
    frameworkRefs: [['COSO', 'RA-8']],
    content: {
      objective: 'Identify duplicate or potentially fraudulent payments.',
      procedure:
        'Import payment listing. Run tests: exact duplicates (vendor, amount, invoice); fuzzy invoice numbers (strip punctuation and leading zeros); same bank account across vendors; vendors sharing employee bank accounts; round-sum payments above threshold; postings on weekends and public holidays. Investigate each hit with Accounts Payable.',
      sampling: 'Full population; investigate all hits.',
      evidence: 'Payment listing, vendor master, employee bank details, investigation log.',
      exceptionCriteria: 'Confirmed duplicate or unsupported payment.',
    },
  },
  {
    code: 'LIB-TP-004',
    type: 'TEST_PROCEDURE',
    title: 'Ghost employee analytics',
    summary: 'Payroll to HR reconciliation and identity duplicate tests.',
    tags: ['payroll', 'analytics', 'fraud'],
    frameworkRefs: [['COSO', 'RA-8']],
    content: {
      objective: 'Detect employees on payroll who do not exist or no longer work for the organisation.',
      procedure:
        'Reconcile payroll register headcount to HR headcount per cost centre. Test for duplicate bank accounts, identity numbers and addresses; employees with no leave, no attendance and no email activity. Physically verify a sample of unexplained items.',
      sampling: 'Full population analytics; physical verification of 15 employees.',
      evidence: 'Payroll register, HR headcount, leave and attendance extracts, verification sign-offs.',
      exceptionCriteria: 'Employee paid but not verified to exist and be employed.',
    },
  },
  {
    code: 'LIB-FN-001',
    type: 'FINDING',
    title: 'Purchases made without approved purchase orders',
    summary: 'Template finding for after-the-fact or missing purchase order approval.',
    tags: ['p2p', 'authorisation'],
    frameworkRefs: [['COSO', 'CA-10']],
    content: {
      condition:
        'Of [n] purchase transactions tested, [x] were committed before a purchase order was approved, and [y] had no purchase order at all.',
      criteria:
        'The Procurement Policy requires an approved purchase order before goods or services are ordered, with approval in line with the delegation of authority matrix.',
      cause: 'Urgent purchases are raised verbally and regularised later; ERP does not block invoice posting without a PO.',
      impact: 'Commitments may exceed budget and authority, and the three-way match cannot operate for these transactions.',
      severity: 'MEDIUM',
      rootCauseCategory: 'PROCESS',
    },
  },
  {
    code: 'LIB-FN-002',
    type: 'FINDING',
    title: 'Leaver access not removed on a timely basis',
    summary: 'Template finding for accounts of former employees remaining active.',
    tags: ['access', 'leavers'],
    frameworkRefs: [['ISO27001', 'A.5.18']],
    content: {
      condition: '[x] of [n] leavers retained active accounts for more than one working day; [y] accounts were still active at the audit date.',
      criteria: 'The Access Management Policy requires all access to be revoked within 24 hours of exit.',
      cause: 'HR does not notify IT of exits automatically; deprovisioning relies on line managers raising tickets.',
      impact: 'Former employees or persons with their credentials could access systems and data.',
      severity: 'HIGH',
      rootCauseCategory: 'PROCESS',
    },
  },
  {
    code: 'LIB-FN-003',
    type: 'FINDING',
    title: 'Inadequate segregation of duties in master data maintenance',
    summary: 'Template finding for users able to create and approve vendor or employee master data.',
    tags: ['segregation of duties', 'master data'],
    frameworkRefs: [
      ['COSO', 'CA-10'],
      ['COBIT', 'DSS06'],
    ],
    content: {
      condition: '[x] users hold roles that allow them to both create and approve [vendor/employee] master data changes.',
      criteria: 'Master data changes must be created and approved by different individuals (Finance Policy s.4.2).',
      cause: 'Role design in the ERP grants a combined maintenance role; compensating review is not performed.',
      impact: 'Fictitious vendors or employees could be created and paid without detection.',
      severity: 'HIGH',
      rootCauseCategory: 'TECHNOLOGY',
    },
  },
  {
    code: 'LIB-RC-001',
    type: 'RECOMMENDATION',
    title: 'Enforce purchase order before invoice posting',
    summary: 'System configuration recommendation for PO enforcement.',
    tags: ['p2p', 'erp'],
    frameworkRefs: [['COSO', 'CA-11']],
    content: {
      text: 'Configure the ERP to block posting of vendor invoices without a matched, approved purchase order, with a documented exception category for emergency purchases approved by the CFO within 48 hours.',
      priority: 'HIGH',
      actionPlan: 'IT to enable the PO-required flag for all vendor groups except utilities; Procurement to publish the emergency purchase procedure.',
    },
  },
  {
    code: 'LIB-RC-002',
    type: 'RECOMMENDATION',
    title: 'Automate leaver notification from HR to IT',
    summary: 'Integration recommendation for joiner-mover-leaver process.',
    tags: ['access', 'automation'],
    frameworkRefs: [['ISO27001', 'A.5.18']],
    content: {
      text: 'Integrate the HR system with the identity provider so that termination in HR automatically disables directory and application accounts, with a daily exception report reviewed by IT Security.',
      priority: 'HIGH',
      actionPlan: 'IT to implement the HR to Entra ID lifecycle workflow; IT Security to review the exception report daily.',
    },
  },
  {
    code: 'LIB-RC-003',
    type: 'RECOMMENDATION',
    title: 'Redesign master data roles and add independent review',
    summary: 'Role redesign with compensating monthly review.',
    tags: ['segregation of duties', 'master data'],
    frameworkRefs: [['COSO', 'CA-10']],
    content: {
      text: 'Split the master data maintenance role into request and approve roles, remove the combined role from all users and introduce a monthly independent review of the master data change log by Finance.',
      priority: 'HIGH',
      actionPlan: 'ERP administrator to redesign roles; Finance Manager to own the monthly review with sign-off retained.',
    },
  },
];
