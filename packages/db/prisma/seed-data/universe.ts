/**
 * Demo audit universe for the fictional client "Baraka Holdings", plus the
 * process, risk and control catalogue used by the engagements.
 */
export type EntityTypeSeed =
  | 'LEGAL_ENTITY'
  | 'BUSINESS_UNIT'
  | 'COUNTRY'
  | 'DEPARTMENT'
  | 'PROCESS'
  | 'SYSTEM'
  | 'PRODUCT'
  | 'THIRD_PARTY';
export type RatingSeed = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type VelocitySeed = 'SLOW' | 'MODERATE' | 'FAST' | 'IMMEDIATE';

/** Owner keys map to demo user handles in seed.ts. */
export type OwnerKey = 'owner' | 'reviewer' | 'manager' | 'cae';

export interface EntitySeed {
  code: string;
  type: EntityTypeSeed;
  name: string;
  parent?: string;
  country?: string;
  description?: string;
  owner?: OwnerKey;
  riskRating: RatingSeed;
  riskScore?: number;
  /** ISO date or null when never audited */
  lastAuditDate: string | null;
  auditFrequencyMonths?: number;
  strategicObjectives?: string[];
  regulatoryRequirements?: { code: string; name: string; regulator: string }[];
  metadata?: Record<string, unknown>;
}

export const ENTITIES: EntitySeed[] = [
  {
    code: 'BH',
    type: 'LEGAL_ENTITY',
    name: 'Baraka Holdings Limited',
    country: 'KE',
    description: 'Non-operating holding company listed on the Nairobi Securities Exchange with banking and insurance subsidiaries in East Africa.',
    owner: 'reviewer',
    riskRating: 'HIGH',
    riskScore: 16,
    lastAuditDate: '2025-03-31',
    auditFrequencyMonths: 12,
    strategicObjectives: [
      'Grow regional retail deposits by 15% per year',
      'Achieve cost-to-income ratio below 50% by FY2027',
      'Maintain capital adequacy above regulatory minimum plus 2% buffer',
    ],
    regulatoryRequirements: [
      { code: 'CBK-PG', name: 'CBK Prudential Guidelines', regulator: 'Central Bank of Kenya' },
      { code: 'CMA-CG', name: 'Code of Corporate Governance for Issuers', regulator: 'Capital Markets Authority' },
      { code: 'NSE-LR', name: 'NSE Listing Rules', regulator: 'Nairobi Securities Exchange' },
    ],
    metadata: { employees: 2450, listed: true },
  },
  {
    code: 'BH-KE',
    type: 'COUNTRY',
    name: 'Baraka Kenya',
    parent: 'BH',
    country: 'KE',
    owner: 'reviewer',
    riskRating: 'HIGH',
    riskScore: 15,
    lastAuditDate: '2025-10-20',
    auditFrequencyMonths: 12,
    regulatoryRequirements: [
      { code: 'CBK-PG', name: 'CBK Prudential Guidelines', regulator: 'Central Bank of Kenya' },
      { code: 'POCAMLA', name: 'Proceeds of Crime and Anti-Money Laundering Act', regulator: 'Financial Reporting Centre' },
      { code: 'DPA-2019', name: 'Data Protection Act 2019', regulator: 'ODPC' },
    ],
  },
  {
    code: 'BH-UG',
    type: 'COUNTRY',
    name: 'Baraka Uganda',
    parent: 'BH',
    country: 'UG',
    riskRating: 'MEDIUM',
    riskScore: 9,
    lastAuditDate: '2024-06-14',
    auditFrequencyMonths: 24,
    regulatoryRequirements: [
      { code: 'FIA-2004', name: 'Financial Institutions Act', regulator: 'Bank of Uganda' },
    ],
  },
  {
    code: 'BH-TZ',
    type: 'COUNTRY',
    name: 'Baraka Tanzania',
    parent: 'BH',
    country: 'TZ',
    riskRating: 'MEDIUM',
    riskScore: 10,
    lastAuditDate: '2023-11-08',
    auditFrequencyMonths: 24,
    regulatoryRequirements: [
      { code: 'BFIA-2006', name: 'Banking and Financial Institutions Act', regulator: 'Bank of Tanzania' },
    ],
  },
  {
    code: 'BH-KE-RB',
    type: 'BUSINESS_UNIT',
    name: 'Retail Banking',
    parent: 'BH-KE',
    country: 'KE',
    description: 'Branch network, mobile banking, personal loans and deposits.',
    riskRating: 'CRITICAL',
    riskScore: 20,
    lastAuditDate: '2025-02-28',
    auditFrequencyMonths: 12,
    strategicObjectives: ['Digital onboarding for 80% of new accounts', 'Reduce NPL ratio below 8%'],
    regulatoryRequirements: [
      { code: 'CBK-PG-CG', name: 'Prudential Guideline on Consumer Protection', regulator: 'Central Bank of Kenya' },
      { code: 'POCAMLA', name: 'AML/CFT obligations', regulator: 'Financial Reporting Centre' },
    ],
  },
  {
    code: 'BH-KE-CB',
    type: 'BUSINESS_UNIT',
    name: 'Corporate Banking',
    parent: 'BH-KE',
    country: 'KE',
    description: 'Corporate lending, trade finance and cash management.',
    riskRating: 'HIGH',
    riskScore: 15,
    lastAuditDate: '2024-09-30',
    auditFrequencyMonths: 18,
  },
  {
    code: 'BH-KE-INS',
    type: 'BUSINESS_UNIT',
    name: 'Baraka Insurance',
    parent: 'BH-KE',
    country: 'KE',
    description: 'General and life insurance underwriting and claims.',
    riskRating: 'HIGH',
    riskScore: 14,
    lastAuditDate: '2024-04-12',
    auditFrequencyMonths: 18,
    regulatoryRequirements: [
      { code: 'IRA-RBS', name: 'Risk Based Supervision guidelines', regulator: 'Insurance Regulatory Authority' },
      { code: 'IFRS17', name: 'IFRS 17 Insurance Contracts', regulator: 'ICPAK / IRA' },
    ],
  },
  {
    code: 'BH-KE-SS',
    type: 'BUSINESS_UNIT',
    name: 'Shared Services',
    parent: 'BH-KE',
    country: 'KE',
    description: 'Group finance, procurement, HR, IT and treasury services for all subsidiaries.',
    owner: 'reviewer',
    riskRating: 'HIGH',
    riskScore: 14,
    lastAuditDate: '2025-10-20',
    auditFrequencyMonths: 12,
  },
  {
    code: 'BH-UG-RB',
    type: 'BUSINESS_UNIT',
    name: 'Retail Banking Uganda',
    parent: 'BH-UG',
    country: 'UG',
    riskRating: 'MEDIUM',
    riskScore: 10,
    lastAuditDate: '2024-06-14',
    auditFrequencyMonths: 24,
  },
  {
    code: 'BH-TZ-RB',
    type: 'BUSINESS_UNIT',
    name: 'Retail Banking Tanzania',
    parent: 'BH-TZ',
    country: 'TZ',
    riskRating: 'MEDIUM',
    riskScore: 11,
    lastAuditDate: null,
    auditFrequencyMonths: 24,
  },
  {
    code: 'BH-SS-FIN',
    type: 'DEPARTMENT',
    name: 'Finance',
    parent: 'BH-KE-SS',
    country: 'KE',
    owner: 'reviewer',
    riskRating: 'HIGH',
    riskScore: 13,
    lastAuditDate: '2025-01-24',
    auditFrequencyMonths: 12,
  },
  {
    code: 'BH-SS-PRC',
    type: 'DEPARTMENT',
    name: 'Procurement',
    parent: 'BH-KE-SS',
    country: 'KE',
    owner: 'owner',
    riskRating: 'HIGH',
    riskScore: 16,
    lastAuditDate: '2023-08-18',
    auditFrequencyMonths: 24,
  },
  {
    code: 'BH-SS-HR',
    type: 'DEPARTMENT',
    name: 'Human Resources',
    parent: 'BH-KE-SS',
    country: 'KE',
    riskRating: 'MEDIUM',
    riskScore: 9,
    lastAuditDate: '2025-10-20',
    auditFrequencyMonths: 24,
  },
  {
    code: 'BH-SS-IT',
    type: 'DEPARTMENT',
    name: 'Information Technology',
    parent: 'BH-KE-SS',
    country: 'KE',
    riskRating: 'CRITICAL',
    riskScore: 20,
    lastAuditDate: '2024-11-29',
    auditFrequencyMonths: 12,
    regulatoryRequirements: [
      { code: 'CBK-CYBER', name: 'Guidance Note on Cybersecurity', regulator: 'Central Bank of Kenya' },
    ],
  },
  {
    code: 'BH-SS-TRS',
    type: 'DEPARTMENT',
    name: 'Treasury',
    parent: 'BH-KE-SS',
    country: 'KE',
    riskRating: 'HIGH',
    riskScore: 15,
    lastAuditDate: '2026-05-29',
    auditFrequencyMonths: 12,
  },
  {
    code: 'SYS-CBS',
    type: 'SYSTEM',
    name: 'Core Banking System (Finacle)',
    parent: 'BH-SS-IT',
    country: 'KE',
    description: 'Infosys Finacle 11 hosted in the primary data centre with DR in Mombasa.',
    riskRating: 'CRITICAL',
    riskScore: 22,
    lastAuditDate: '2024-11-29',
    auditFrequencyMonths: 12,
  },
  {
    code: 'SYS-ERP',
    type: 'SYSTEM',
    name: 'ERP (Microsoft Dynamics 365 Finance)',
    parent: 'BH-SS-IT',
    country: 'KE',
    description: 'General ledger, procurement, fixed assets and payroll interface. Cloud hosted.',
    riskRating: 'HIGH',
    riskScore: 14,
    lastAuditDate: null,
    auditFrequencyMonths: 18,
  },
  {
    code: 'TP-CIT',
    type: 'THIRD_PARTY',
    name: 'SecureMove Cash-in-Transit Ltd',
    parent: 'BH-SS-PRC',
    country: 'KE',
    description: 'Outsourced cash-in-transit and ATM replenishment for the Kenyan branch network.',
    riskRating: 'HIGH',
    riskScore: 13,
    lastAuditDate: '2024-02-09',
    auditFrequencyMonths: 24,
  },
  {
    code: 'TP-CLD',
    type: 'THIRD_PARTY',
    name: 'Savanna Cloud Hosting Ltd',
    parent: 'BH-SS-PRC',
    country: 'KE',
    description: 'Hosting provider for the ERP and data warehouse; ISO 27001 certified.',
    riskRating: 'HIGH',
    riskScore: 14,
    lastAuditDate: null,
    auditFrequencyMonths: 24,
  },
];

export interface ProcessSeed {
  code: string;
  name: string;
  entity: string;
  category: string;
  isKey: boolean;
  owner?: OwnerKey;
  description: string;
}

export const PROCESSES: ProcessSeed[] = [
  { code: 'PRC-P2P', name: 'Procure-to-pay', entity: 'BH-SS-PRC', category: 'Procurement', isKey: true, owner: 'owner', description: 'Requisition, sourcing, ordering, receipt, invoice processing and payment.' },
  { code: 'PRC-VND', name: 'Vendor onboarding', entity: 'BH-SS-PRC', category: 'Procurement', isKey: true, owner: 'owner', description: 'Due diligence, approval and master data set-up for new suppliers.' },
  { code: 'PRC-O2C', name: 'Order-to-cash', entity: 'BH-SS-FIN', category: 'Finance', isKey: false, description: 'Fee billing, collection and revenue recognition for non-interest income.' },
  { code: 'PRC-R2R', name: 'Record-to-report', entity: 'BH-SS-FIN', category: 'Finance', isKey: true, owner: 'reviewer', description: 'Month-end close, reconciliations, consolidation and financial reporting.' },
  { code: 'PRC-FA', name: 'Fixed assets', entity: 'BH-SS-FIN', category: 'Finance', isKey: false, description: 'Capitalisation, depreciation, verification and disposal of property and equipment.' },
  { code: 'PRC-TAX', name: 'Tax compliance', entity: 'BH-SS-FIN', category: 'Finance', isKey: false, owner: 'reviewer', description: 'Corporate tax, VAT, withholding and payroll tax filings across three jurisdictions.' },
  { code: 'PRC-PAY', name: 'Payroll', entity: 'BH-SS-HR', category: 'Human resources', isKey: true, description: 'Master data, monthly payroll calculation, approval, disbursement and statutory remittance.' },
  { code: 'PRC-UAM', name: 'User access management', entity: 'BH-SS-IT', category: 'IT general controls', isKey: true, description: 'Joiner, mover, leaver and privileged access across core banking, ERP and directory services.' },
  { code: 'PRC-CHG', name: 'Change management', entity: 'BH-SS-IT', category: 'IT general controls', isKey: true, description: 'Approval, testing and deployment of application and infrastructure changes.' },
  { code: 'PRC-TRD', name: 'Treasury dealing', entity: 'BH-SS-TRS', category: 'Treasury', isKey: true, description: 'FX and money market dealing, confirmation, settlement and limit monitoring.' },
  { code: 'PRC-CLM', name: 'Claims processing', entity: 'BH-KE-INS', category: 'Insurance operations', isKey: true, description: 'Claim notification, assessment, investigation, reserving and settlement.' },
  { code: 'PRC-LON', name: 'Loan origination', entity: 'BH-KE-RB', category: 'Credit', isKey: true, description: 'Customer onboarding, KYC, credit appraisal, approval and disbursement of retail loans.' },
];

export interface RiskCategorySeed {
  code: string;
  name: string;
  description: string;
  weight: number;
  colour: string;
}

export const RISK_CATEGORIES: RiskCategorySeed[] = [
  { code: 'STR', name: 'Strategic', description: 'Risks to the achievement of business objectives and market position.', weight: 1.2, colour: '#6f42c1' },
  { code: 'OPS', name: 'Operational', description: 'Failed processes, people or systems.', weight: 1, colour: '#0d6efd' },
  { code: 'FIN', name: 'Financial', description: 'Financial reporting, liquidity, market and credit exposure.', weight: 1.1, colour: '#198754' },
  { code: 'CMP', name: 'Compliance', description: 'Breach of laws, regulations and licence conditions.', weight: 1.3, colour: '#fd7e14' },
  { code: 'TEC', name: 'Technology', description: 'Availability, integrity and security of systems and data.', weight: 1.2, colour: '#20c997' },
  { code: 'FRD', name: 'Fraud', description: 'Internal or external fraud and misappropriation.', weight: 1.4, colour: '#dc3545' },
  { code: 'TPR', name: 'Third-party', description: 'Failure of outsourced providers and key suppliers.', weight: 1, colour: '#6c757d' },
];

export interface RiskSeed {
  code: string;
  title: string;
  description: string;
  category: string;
  process: string;
  owner?: OwnerKey;
  source: string;
  inherentLikelihood: number;
  inherentImpact: number;
  controlEffectiveness: number;
  velocity: VelocitySeed;
  appetiteThreshold?: number;
  tags: string[];
}

export const RISKS: RiskSeed[] = [
  { code: 'R-001', title: 'Duplicate or fictitious vendor payments', description: 'Invoices paid twice or paid to vendors that did not supply goods or services, through weak matching or collusion.', category: 'FRD', process: 'PRC-P2P', owner: 'owner', source: 'Prior audit', inherentLikelihood: 4, inherentImpact: 4, controlEffectiveness: 3, velocity: 'FAST', appetiteThreshold: 8, tags: ['fraud', 'payments'] },
  { code: 'R-002', title: 'Purchases committed without approved purchase orders', description: 'Goods or services ordered before authorisation, bypassing budget and delegation checks.', category: 'OPS', process: 'PRC-P2P', owner: 'owner', source: 'Risk workshop', inherentLikelihood: 4, inherentImpact: 3, controlEffectiveness: 3, velocity: 'MODERATE', appetiteThreshold: 8, tags: ['authorisation'] },
  { code: 'R-003', title: 'Vendor master data changes not independently reviewed', description: 'Bank account or name changes on vendor records processed without call-back or review, enabling payment diversion.', category: 'FRD', process: 'PRC-VND', owner: 'owner', source: 'Prior audit', inherentLikelihood: 3, inherentImpact: 4, controlEffectiveness: 2, velocity: 'FAST', appetiteThreshold: 6, tags: ['master data', 'fraud'] },
  { code: 'R-004', title: 'Conflicts of interest in vendor selection', description: 'Staff award contracts to related parties without disclosure.', category: 'FRD', process: 'PRC-VND', owner: 'owner', source: 'Whistleblower trend', inherentLikelihood: 3, inherentImpact: 4, controlEffectiveness: 2, velocity: 'SLOW', appetiteThreshold: 6, tags: ['ethics'] },
  { code: 'R-005', title: 'Revenue leakage from unbilled or under-billed fees', description: 'Account and transaction fees not charged or waived without authority.', category: 'FIN', process: 'PRC-O2C', source: 'Risk workshop', inherentLikelihood: 3, inherentImpact: 3, controlEffectiveness: 3, velocity: 'SLOW', tags: ['revenue'] },
  { code: 'R-006', title: 'Unreconciled suspense accounts at month end', description: 'Aged items in suspense and clearing accounts masking errors or losses.', category: 'FIN', process: 'PRC-R2R', owner: 'reviewer', source: 'External audit management letter', inherentLikelihood: 4, inherentImpact: 3, controlEffectiveness: 4, velocity: 'MODERATE', tags: ['reconciliation'] },
  { code: 'R-007', title: 'Ghost employees on payroll', description: 'Payments to non-existent or departed employees.', category: 'FRD', process: 'PRC-PAY', source: 'Prior audit', inherentLikelihood: 3, inherentImpact: 5, controlEffectiveness: 4, velocity: 'MODERATE', appetiteThreshold: 6, tags: ['fraud', 'payroll'] },
  { code: 'R-008', title: 'Unauthorised salary or bank detail changes', description: 'Payroll master file changes made without approval.', category: 'FRD', process: 'PRC-PAY', source: 'Prior audit', inherentLikelihood: 3, inherentImpact: 4, controlEffectiveness: 3, velocity: 'FAST', tags: ['payroll', 'master data'] },
  { code: 'R-009', title: 'Privileged access to core banking not reviewed', description: 'Administrator and generic accounts on Finacle not periodically recertified.', category: 'TEC', process: 'PRC-UAM', source: 'CBK inspection', inherentLikelihood: 4, inherentImpact: 5, controlEffectiveness: 2, velocity: 'FAST', appetiteThreshold: 8, tags: ['itgc', 'privileged access', 'cbk'] },
  { code: 'R-010', title: 'Leavers retaining system access', description: 'Accounts of former staff and contractors remaining active after exit.', category: 'TEC', process: 'PRC-UAM', source: 'Risk workshop', inherentLikelihood: 4, inherentImpact: 4, controlEffectiveness: 2, velocity: 'FAST', appetiteThreshold: 8, tags: ['itgc', 'leavers'] },
  { code: 'R-011', title: 'Unauthorised or untested changes deployed to production', description: 'Emergency or developer-initiated changes bypassing CAB and UAT.', category: 'TEC', process: 'PRC-CHG', source: 'Incident review', inherentLikelihood: 3, inherentImpact: 5, controlEffectiveness: 3, velocity: 'IMMEDIATE', tags: ['itgc', 'change'] },
  { code: 'R-012', title: 'Treasury dealing limits breached', description: 'Dealers exceed counterparty, position or stop-loss limits.', category: 'FIN', process: 'PRC-TRD', source: 'ALCO', inherentLikelihood: 2, inherentImpact: 5, controlEffectiveness: 4, velocity: 'IMMEDIATE', appetiteThreshold: 6, tags: ['treasury', 'market risk'] },
  { code: 'R-013', title: 'Settlement errors on FX and money market deals', description: 'Incorrect or late settlement causing losses and counterparty claims.', category: 'OPS', process: 'PRC-TRD', source: 'Loss event data', inherentLikelihood: 3, inherentImpact: 4, controlEffectiveness: 4, velocity: 'FAST', tags: ['treasury', 'settlement'] },
  { code: 'R-014', title: 'Fraudulent or inflated insurance claims paid', description: 'Claims paid without adequate investigation or with staff collusion.', category: 'FRD', process: 'PRC-CLM', source: 'Industry data', inherentLikelihood: 4, inherentImpact: 4, controlEffectiveness: 3, velocity: 'MODERATE', appetiteThreshold: 8, tags: ['insurance', 'fraud'] },
  { code: 'R-015', title: 'Outstanding claims reserves inadequately estimated', description: 'Under-reserving distorts results and solvency ratios under IFRS 17.', category: 'FIN', process: 'PRC-CLM', source: 'Actuarial review', inherentLikelihood: 3, inherentImpact: 4, controlEffectiveness: 3, velocity: 'SLOW', tags: ['insurance', 'ifrs17'] },
  { code: 'R-016', title: 'Loans approved outside credit policy', description: 'Facilities granted above authority or with waived conditions.', category: 'CMP', process: 'PRC-LON', source: 'CBK inspection', inherentLikelihood: 3, inherentImpact: 5, controlEffectiveness: 3, velocity: 'MODERATE', appetiteThreshold: 8, tags: ['credit', 'cbk'] },
  { code: 'R-017', title: 'Incomplete KYC and AML documentation at onboarding', description: 'Accounts opened without required identification and screening, exposing the bank to regulatory sanction.', category: 'CMP', process: 'PRC-LON', source: 'FRC guidance', inherentLikelihood: 4, inherentImpact: 5, controlEffectiveness: 3, velocity: 'FAST', appetiteThreshold: 8, tags: ['aml', 'kyc', 'regulatory'] },
  { code: 'R-018', title: 'Fixed asset register not reconciled to the general ledger', description: 'Assets disposed or impaired without record; depreciation misstated.', category: 'FIN', process: 'PRC-FA', source: 'External audit management letter', inherentLikelihood: 3, inherentImpact: 2, controlEffectiveness: 3, velocity: 'SLOW', tags: ['fixed assets'] },
  { code: 'R-019', title: 'Late or inaccurate statutory tax filings', description: 'Missed deadlines for PAYE, VAT and corporate tax across three jurisdictions attracting penalties.', category: 'CMP', process: 'PRC-TAX', owner: 'reviewer', source: 'Prior audit', inherentLikelihood: 3, inherentImpact: 4, controlEffectiveness: 4, velocity: 'MODERATE', tags: ['tax'] },
  { code: 'R-020', title: 'Critical third-party service failure', description: 'Cash-in-transit or cloud hosting provider fails to deliver, disrupting branch operations or the ERP.', category: 'TPR', process: 'PRC-VND', owner: 'owner', source: 'Business continuity review', inherentLikelihood: 3, inherentImpact: 5, controlEffectiveness: 2, velocity: 'IMMEDIATE', appetiteThreshold: 8, tags: ['third party', 'continuity'] },
  { code: 'R-021', title: 'Data breach through a hosting provider', description: 'Customer data exposed through the cloud provider environment or shared administrator credentials.', category: 'TEC', process: 'PRC-UAM', source: 'Threat intelligence', inherentLikelihood: 3, inherentImpact: 5, controlEffectiveness: 2, velocity: 'IMMEDIATE', appetiteThreshold: 6, tags: ['cyber', 'third party', 'data protection'] },
];

export interface ControlSeed {
  code: string;
  title: string;
  description: string;
  process: string;
  owner?: OwnerKey;
  frequency: 'CONTINUOUS' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'EVENT_DRIVEN';
  type: 'PREVENTIVE' | 'DETECTIVE' | 'CORRECTIVE' | 'DIRECTIVE';
  nature: 'MANUAL' | 'AUTOMATED' | 'IT_DEPENDENT_MANUAL';
  isKeyControl: boolean;
  risks: string[];
  frameworkReferences: { framework: string; ref: string }[];
}

export const CONTROLS: ControlSeed[] = [
  { code: 'C-001', title: 'Three-way match of PO, GRN and invoice in ERP', description: 'ERP blocks invoice posting unless quantity and price agree to an approved PO and goods receipt within tolerance; overrides require Finance Manager approval.', process: 'PRC-P2P', owner: 'owner', frequency: 'CONTINUOUS', type: 'PREVENTIVE', nature: 'AUTOMATED', isKeyControl: true, risks: ['R-001', 'R-002'], frameworkReferences: [{ framework: 'COSO', ref: 'CA-10' }, { framework: 'COBIT', ref: 'DSS06' }] },
  { code: 'C-002', title: 'Purchase order approval per delegation of authority', description: 'Purchase orders are routed in ERP workflow to approvers based on value bands in the DoA matrix.', process: 'PRC-P2P', owner: 'owner', frequency: 'EVENT_DRIVEN', type: 'PREVENTIVE', nature: 'IT_DEPENDENT_MANUAL', isKeyControl: true, risks: ['R-002'], frameworkReferences: [{ framework: 'COSO', ref: 'CA-10' }] },
  { code: 'C-003', title: 'Weekly duplicate invoice report review', description: 'Accounts Payable supervisor reviews the ERP duplicate invoice exception report weekly and documents resolution.', process: 'PRC-P2P', frequency: 'WEEKLY', type: 'DETECTIVE', nature: 'IT_DEPENDENT_MANUAL', isKeyControl: false, risks: ['R-001'], frameworkReferences: [{ framework: 'COSO', ref: 'MA-16' }] },
  { code: 'C-004', title: 'Independent review of vendor master changes', description: 'Monthly review of the vendor master change log by the Finance Manager with call-back verification of bank detail changes.', process: 'PRC-VND', owner: 'reviewer', frequency: 'MONTHLY', type: 'DETECTIVE', nature: 'MANUAL', isKeyControl: true, risks: ['R-003'], frameworkReferences: [{ framework: 'COSO', ref: 'CA-10' }] },
  { code: 'C-005', title: 'Vendor due diligence and conflict-of-interest declarations', description: 'New vendors complete KYC and beneficial ownership forms; evaluation committee members sign conflict declarations per tender.', process: 'PRC-VND', owner: 'owner', frequency: 'EVENT_DRIVEN', type: 'PREVENTIVE', nature: 'MANUAL', isKeyControl: false, risks: ['R-004', 'R-020'], frameworkReferences: [{ framework: 'COSO', ref: 'CE-1' }] },
  { code: 'C-006', title: 'Fee billing completeness reconciliation', description: 'Monthly reconciliation of billable events in core banking to fees posted, with waivers reviewed by the Head of Retail.', process: 'PRC-O2C', frequency: 'MONTHLY', type: 'DETECTIVE', nature: 'IT_DEPENDENT_MANUAL', isKeyControl: false, risks: ['R-005'], frameworkReferences: [{ framework: 'IFRS', ref: 'IFRS 15' }] },
  { code: 'C-007', title: 'Month-end close checklist and suspense account review', description: 'Financial Controller signs off the close checklist including ageing of all suspense and clearing accounts.', process: 'PRC-R2R', owner: 'reviewer', frequency: 'MONTHLY', type: 'DETECTIVE', nature: 'MANUAL', isKeyControl: true, risks: ['R-006'], frameworkReferences: [{ framework: 'COSO', ref: 'CA-10' }, { framework: 'IFRS', ref: 'IAS 1' }] },
  { code: 'C-008', title: 'Payroll master file changes approved and matched to HR records', description: 'All changes require signed HR documentation and approval by the Head of HR before payroll processing.', process: 'PRC-PAY', frequency: 'MONTHLY', type: 'PREVENTIVE', nature: 'MANUAL', isKeyControl: true, risks: ['R-007', 'R-008'], frameworkReferences: [{ framework: 'COSO', ref: 'CA-10' }] },
  { code: 'C-009', title: 'Payroll headcount reconciliation to HR system', description: 'Monthly reconciliation of payroll headcount and cost to the HR system by cost centre, reviewed by Finance.', process: 'PRC-PAY', frequency: 'MONTHLY', type: 'DETECTIVE', nature: 'IT_DEPENDENT_MANUAL', isKeyControl: false, risks: ['R-007'], frameworkReferences: [{ framework: 'COSO', ref: 'MA-16' }] },
  { code: 'C-010', title: 'Quarterly privileged access review', description: 'Application owners recertify all privileged and generic accounts each quarter; IT Security tracks removals.', process: 'PRC-UAM', frequency: 'QUARTERLY', type: 'DETECTIVE', nature: 'MANUAL', isKeyControl: true, risks: ['R-009', 'R-021'], frameworkReferences: [{ framework: 'ISO27001', ref: 'A.8.2' }, { framework: 'COBIT', ref: 'DSS05' }] },
  { code: 'C-011', title: 'Leaver deprovisioning within 24 hours', description: 'HR exit notification triggers a service desk ticket; all accounts disabled within one working day.', process: 'PRC-UAM', frequency: 'EVENT_DRIVEN', type: 'PREVENTIVE', nature: 'IT_DEPENDENT_MANUAL', isKeyControl: true, risks: ['R-010'], frameworkReferences: [{ framework: 'ISO27001', ref: 'A.5.18' }] },
  { code: 'C-012', title: 'Change advisory board approval and UAT sign-off', description: 'All production changes are approved by CAB with documented UAT sign-off by the business owner.', process: 'PRC-CHG', frequency: 'EVENT_DRIVEN', type: 'PREVENTIVE', nature: 'MANUAL', isKeyControl: true, risks: ['R-011'], frameworkReferences: [{ framework: 'COBIT', ref: 'BAI06' }, { framework: 'ISO27001', ref: 'A.8.32' }] },
  { code: 'C-013', title: 'Segregation of developer and deployment roles', description: 'Developers have no deployment rights to production; deployments performed by the release team through the pipeline.', process: 'PRC-CHG', frequency: 'CONTINUOUS', type: 'PREVENTIVE', nature: 'AUTOMATED', isKeyControl: false, risks: ['R-011'], frameworkReferences: [{ framework: 'COBIT', ref: 'BAI06' }] },
  { code: 'C-014', title: 'Automated dealing limit checks', description: 'Treasury system rejects deals that breach counterparty, position or dealer limits; breaches escalated to ALCO.', process: 'PRC-TRD', frequency: 'CONTINUOUS', type: 'PREVENTIVE', nature: 'AUTOMATED', isKeyControl: true, risks: ['R-012'], frameworkReferences: [{ framework: 'COSO', ref: 'CA-11' }] },
  { code: 'C-015', title: 'Daily deal confirmation and settlement reconciliation', description: 'Back office confirms all deals with counterparties and reconciles settlements to nostro accounts daily.', process: 'PRC-TRD', frequency: 'DAILY', type: 'DETECTIVE', nature: 'MANUAL', isKeyControl: true, risks: ['R-013'], frameworkReferences: [{ framework: 'COSO', ref: 'CA-10' }] },
  { code: 'C-016', title: 'Claims investigation above threshold', description: 'Claims above KES 500,000 or flagged by fraud rules are referred to the investigation unit before settlement.', process: 'PRC-CLM', frequency: 'EVENT_DRIVEN', type: 'DETECTIVE', nature: 'MANUAL', isKeyControl: true, risks: ['R-014'], frameworkReferences: [{ framework: 'COSO', ref: 'RA-8' }] },
  { code: 'C-017', title: 'Quarterly actuarial review of claims reserves', description: 'Appointed actuary reviews case reserves and IBNR each quarter; adjustments approved by the CFO.', process: 'PRC-CLM', frequency: 'QUARTERLY', type: 'DETECTIVE', nature: 'MANUAL', isKeyControl: false, risks: ['R-015'], frameworkReferences: [{ framework: 'IFRS', ref: 'IFRS 17' }] },
  { code: 'C-018', title: 'Credit committee approval and exception register', description: 'Facilities above branch authority are approved by credit committee; policy exceptions are logged and reported to the Board Credit Committee.', process: 'PRC-LON', frequency: 'EVENT_DRIVEN', type: 'PREVENTIVE', nature: 'MANUAL', isKeyControl: true, risks: ['R-016'], frameworkReferences: [{ framework: 'COSO', ref: 'CA-10' }] },
  { code: 'C-019', title: 'KYC checklist enforced in core banking', description: 'Account opening cannot complete without mandatory identification fields and sanctions screening result.', process: 'PRC-LON', frequency: 'CONTINUOUS', type: 'PREVENTIVE', nature: 'AUTOMATED', isKeyControl: true, risks: ['R-017'], frameworkReferences: [{ framework: 'COSO', ref: 'CA-11' }] },
  { code: 'C-020', title: 'Annual fixed asset verification and GL reconciliation', description: 'Physical verification of all assets annually with the register reconciled to the general ledger.', process: 'PRC-FA', frequency: 'ANNUAL', type: 'DETECTIVE', nature: 'MANUAL', isKeyControl: false, risks: ['R-018'], frameworkReferences: [{ framework: 'IFRS', ref: 'IAS 16' }] },
  { code: 'C-021', title: 'Tax compliance calendar with second-person review', description: 'Tax calendar tracked monthly; every return is prepared and independently reviewed before filing.', process: 'PRC-TAX', owner: 'reviewer', frequency: 'MONTHLY', type: 'PREVENTIVE', nature: 'MANUAL', isKeyControl: false, risks: ['R-019'], frameworkReferences: [{ framework: 'IFRS', ref: 'IAS 12' }] },
  { code: 'C-022', title: 'Third-party SLA monitoring and annual assurance reports', description: 'Vendor managers review SLA dashboards monthly and obtain SOC 2 or ISO 27001 reports annually for critical providers.', process: 'PRC-VND', owner: 'owner', frequency: 'ANNUAL', type: 'DETECTIVE', nature: 'MANUAL', isKeyControl: false, risks: ['R-020', 'R-021'], frameworkReferences: [{ framework: 'ISO27001', ref: 'A.5.19' }] },
];

export const WORKPAPER_TEMPLATES = [
  {
    name: 'Control test',
    category: 'Testing',
    description: 'Design and operating effectiveness test of a control with sampling and exception evaluation.',
    structure: [
      { key: 'objective', label: 'Test objective', prompt: 'State the control being tested and the assertion addressed.', required: true },
      { key: 'population', label: 'Population and sampling', prompt: 'Describe the population, how completeness was confirmed, and the sampling method and size.', required: true },
      { key: 'procedure', label: 'Test procedure', prompt: 'Steps performed for each sample item.', required: true },
      { key: 'results', label: 'Results', prompt: 'Summarise results including sample items with exceptions.', required: true },
      { key: 'exceptions', label: 'Exceptions', prompt: 'Describe each exception, root cause and whether it is a control deviation.', required: false },
      { key: 'conclusion', label: 'Conclusion', prompt: 'Conclude on design and operating effectiveness.', required: true },
    ],
  },
  {
    name: 'Walkthrough',
    category: 'Understanding',
    description: 'End-to-end walkthrough of a process to confirm understanding and identify controls.',
    structure: [
      { key: 'scope', label: 'Process scope', prompt: 'Boundaries of the process and the transaction followed.', required: true },
      { key: 'participants', label: 'Participants', prompt: 'People interviewed and their roles.', required: true },
      { key: 'narrative', label: 'Process narrative', prompt: 'Step-by-step description including systems and documents.', required: true },
      { key: 'controls', label: 'Controls identified', prompt: 'List controls observed with type, frequency and owner.', required: true },
      { key: 'gaps', label: 'Gaps and observations', prompt: 'Points where controls are missing or design appears weak.', required: false },
      { key: 'conclusion', label: 'Conclusion', prompt: 'Confirm whether the documented process reflects practice.', required: true },
    ],
  },
  {
    name: 'Analytical review',
    category: 'Analytics',
    description: 'Data analytics or trend analysis over a full population.',
    structure: [
      { key: 'objective', label: 'Objective', prompt: 'What the analysis is designed to detect.', required: true },
      { key: 'data', label: 'Data sources', prompt: 'Extracts used, dates, record counts and reconciliation to source.', required: true },
      { key: 'method', label: 'Method', prompt: 'Tests run, tools and parameters.', required: true },
      { key: 'results', label: 'Results', prompt: 'Hits by test, investigation outcome.', required: true },
      { key: 'conclusion', label: 'Conclusion', prompt: 'Overall conclusion and items escalated to findings.', required: true },
    ],
  },
  {
    name: 'Interview notes',
    category: 'Understanding',
    description: 'Record of an interview with management or process staff.',
    structure: [
      { key: 'interviewee', label: 'Interviewee', prompt: 'Name, title and date of interview.', required: true },
      { key: 'purpose', label: 'Purpose', prompt: 'Why the interview was held and topics planned.', required: true },
      { key: 'notes', label: 'Discussion notes', prompt: 'Key points, in the order discussed.', required: true },
      { key: 'followups', label: 'Follow-up items', prompt: 'Documents requested and open questions.', required: false },
      { key: 'confirmation', label: 'Confirmation', prompt: 'Whether the notes were confirmed with the interviewee.', required: false },
    ],
  },
];

export const CHARGE_CODES = [
  { code: 'AUD-FW', name: 'Fieldwork', isBillable: true },
  { code: 'AUD-PL', name: 'Planning', isBillable: true },
  { code: 'AUD-RP', name: 'Reporting', isBillable: true },
  { code: 'AUD-FU', name: 'Follow-up', isBillable: true },
  { code: 'ADM', name: 'Admin', isBillable: false },
  { code: 'TRN', name: 'Training', isBillable: false },
];
