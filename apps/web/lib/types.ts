import type {
  AgeingBucket,
  EngagementStage,
  EntityType,
  FindingStatus,
  PermissionKey,
  PlanStatus,
  RequestStatus,
  RoleKey,
  Severity,
  WorkpaperStatus,
} from '@auditsphere/shared';

export type {
  AgeingBucket,
  EngagementStage,
  EntityType,
  FindingStatus,
  PermissionKey,
  PlanStatus,
  RequestStatus,
  RoleKey,
  Severity,
  WorkpaperStatus,
};

export type ISODate = string;
export type UUID = string;

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  sort?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Auth and users
// ---------------------------------------------------------------------------

export type UserStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
export type AuthProvider = 'LOCAL' | 'ENTRA_ID';

export interface UserRef {
  id: UUID;
  displayName: string;
  email?: string;
  avatarUrl?: string | null;
  jobTitle?: string | null;
}

export interface User extends UserRef {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  jobTitle?: string | null;
  officeLocation?: string | null;
  country?: string | null;
  phone?: string | null;
  status: UserStatus;
  authProvider: AuthProvider;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
  mfaRequiredToEnrol: boolean;
  roles: RoleKey[];
  permissions: PermissionKey[];
  lastLoginAt?: ISODate | null;
  weeklyCapacity?: number | string | null;
  createdAt?: ISODate;
  tenant?: { id: UUID; slug: string; name: string };
}

export interface LoginResponse {
  user?: User;
  mfaRequired?: boolean;
  mfaToken?: string;
}

export interface MfaSetupResponse {
  secret: string;
  otpauthUrl: string;
}

export interface Role {
  id: UUID;
  key: RoleKey;
  name: string;
  description?: string | null;
  permissions: PermissionKey[];
}

// ---------------------------------------------------------------------------
// Audit universe
// ---------------------------------------------------------------------------

export type RiskRating = Severity;

export interface EntityNode {
  id: UUID;
  parentId?: UUID | null;
  type: EntityType;
  code: string;
  name: string;
  description?: string | null;
  ownerId?: UUID | null;
  owner?: UserRef | null;
  country?: string | null;
  strategicObjectives?: string[];
  regulatoryRequirements?: unknown[];
  riskRating: RiskRating;
  riskScore?: number | string | null;
  lastAuditDate?: ISODate | null;
  nextAuditDue?: ISODate | null;
  auditFrequencyMonths?: number | null;
  isActive: boolean;
  children?: EntityNode[];
  createdAt?: ISODate;
  updatedAt?: ISODate;
}

export interface Process {
  id: UUID;
  entityId: UUID;
  code: string;
  name: string;
  description?: string | null;
  ownerId?: UUID | null;
  owner?: UserRef | null;
  category?: string | null;
  isKey: boolean;
  createdAt?: ISODate;
}

export interface EntityDetail extends EntityNode {
  processes: Process[];
  risks: RiskSummary[];
  engagements: EngagementSummary[];
  openFindingsCount: number;
}

export interface CoverageSummary {
  total: number;
  auditedLast12Months: number;
  auditedLast36Months: number;
  neverAudited: number;
  byType: { type: EntityType; total: number; covered: number }[];
}

// ---------------------------------------------------------------------------
// Risks and controls
// ---------------------------------------------------------------------------

export type RiskStatus = 'ACTIVE' | 'MONITORING' | 'RETIRED';
export type RiskVelocity = 'SLOW' | 'MODERATE' | 'FAST' | 'IMMEDIATE';

export interface RiskCategory {
  id: UUID;
  code: string;
  name: string;
  description?: string | null;
  colour?: string | null;
}

export interface RiskSummary {
  id: UUID;
  code: string;
  title: string;
  rating: RiskRating;
  residualScore?: number | string;
  status?: RiskStatus;
}

export interface Risk extends RiskSummary {
  description?: string | null;
  categoryId?: UUID | null;
  category?: RiskCategory | null;
  entityId?: UUID | null;
  entity?: { id: UUID; name: string } | null;
  processId?: UUID | null;
  process?: { id: UUID; name: string } | null;
  ownerId?: UUID | null;
  owner?: UserRef | null;
  source?: string | null;
  status: RiskStatus;
  inherentLikelihood: number;
  inherentImpact: number;
  inherentScore: number | string;
  controlEffectiveness: number;
  residualLikelihood: number;
  residualImpact: number;
  residualScore: number | string;
  velocity: RiskVelocity;
  appetiteThreshold?: number | string | null;
  withinAppetite?: boolean | null;
  lastAssessedAt?: ISODate | null;
  tags?: string[];
  controls?: ControlSummary[];
  assessments?: RiskAssessment[];
  createdAt?: ISODate;
  updatedAt?: ISODate;
}

export interface RiskAssessment {
  id: UUID;
  riskId: UUID;
  periodLabel: string;
  inherentLikelihood: number;
  inherentImpact: number;
  inherentScore: number | string;
  controlEffectiveness: number;
  residualLikelihood: number;
  residualImpact: number;
  residualScore: number | string;
  velocity: RiskVelocity;
  rating: RiskRating;
  rationale?: string | null;
  assessedBy?: UserRef;
  assessedAt: ISODate;
}

export interface HeatmapCell {
  likelihood: number;
  impact: number;
  count: number;
  rating: RiskRating;
}

export interface ScoringModel {
  id: UUID;
  name: string;
  isDefault: boolean;
  weights: { likelihood: number; impact: number; velocity: number };
  thresholds: { LOW: number; MEDIUM: number; HIGH: number; CRITICAL: number };
  appetite: Record<string, number>;
}

export type ControlType = 'PREVENTIVE' | 'DETECTIVE' | 'CORRECTIVE' | 'DIRECTIVE';
export type ControlNature = 'MANUAL' | 'AUTOMATED' | 'IT_DEPENDENT_MANUAL';
export type ControlFrequency =
  | 'CONTINUOUS'
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMI_ANNUAL'
  | 'ANNUAL'
  | 'EVENT_DRIVEN';
export type ControlEffectiveness = 'NOT_TESTED' | 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE';
export type ControlTestType = 'DESIGN' | 'OPERATING';
export type ControlTestResult = 'NOT_STARTED' | 'IN_PROGRESS' | 'PASS' | 'PASS_WITH_EXCEPTIONS' | 'FAIL';

export interface ControlSummary {
  id: UUID;
  code: string;
  title: string;
  effectiveness?: ControlEffectiveness;
}

export interface Control extends ControlSummary {
  description?: string | null;
  processId?: UUID | null;
  process?: { id: UUID; name: string } | null;
  ownerId?: UUID | null;
  owner?: UserRef | null;
  frequency: ControlFrequency;
  type: ControlType;
  nature: ControlNature;
  isKeyControl: boolean;
  effectiveness: ControlEffectiveness;
  designEffective?: boolean | null;
  operatingEffective?: boolean | null;
  lastTestedAt?: ISODate | null;
  frameworkReferences?: { framework: string; ref: string }[];
  isActive: boolean;
  risks?: RiskSummary[];
  tests?: ControlTest[];
  createdAt?: ISODate;
}

export interface ControlTest {
  id: UUID;
  controlId: UUID;
  engagementId?: UUID | null;
  workpaperId?: UUID | null;
  testType: ControlTestType;
  periodStart?: ISODate | null;
  periodEnd?: ISODate | null;
  populationSize?: number | null;
  sampleSize?: number | null;
  exceptions: number;
  result: ControlTestResult;
  procedure?: string | null;
  conclusion?: string | null;
  remediation?: string | null;
  testedBy?: UserRef | null;
  testedAt?: ISODate | null;
  createdAt: ISODate;
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export type PlanItemStatus = 'PROPOSED' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'DEFERRED' | 'CANCELLED';
export type PlanItemSource =
  | 'RISK_BASED'
  | 'MANAGEMENT_REQUEST'
  | 'REGULATORY'
  | 'FOLLOW_UP'
  | 'AUDIT_COMMITTEE'
  | 'ROTATIONAL';
export type EngagementType =
  | 'INTERNAL_AUDIT'
  | 'OPERATIONAL'
  | 'FINANCIAL'
  | 'COMPLIANCE'
  | 'IT'
  | 'INVESTIGATION'
  | 'ADVISORY'
  | 'FOLLOW_UP'
  | 'INTEGRATED';

export interface PlanItem {
  id: UUID;
  planId: UUID;
  entityId?: UUID | null;
  entity?: { id: UUID; name: string } | null;
  engagementId?: UUID | null;
  engagement?: { id: UUID; auditNumber: string; stage: EngagementStage } | null;
  title: string;
  description?: string | null;
  source: PlanItemSource;
  engagementType: EngagementType;
  riskRating: RiskRating;
  priority: number;
  plannedYear: number;
  plannedQuarter?: number | null;
  plannedStart?: ISODate | null;
  plannedEnd?: ISODate | null;
  budgetHours?: number | string | null;
  budgetAmount?: number | string | null;
  leadId?: UUID | null;
  lead?: UserRef | null;
  status: PlanItemStatus;
  rationale?: string | null;
}

export interface PlanRollups {
  totalBudgetHours: number;
  byQuarter: { quarter: number | null; count: number; budgetHours: number }[];
  byRating: { rating: RiskRating; count: number; budgetHours?: number }[];
}

export interface AuditPlan {
  id: UUID;
  title: string;
  fiscalYear: number;
  horizonYears: number;
  startDate: ISODate;
  endDate: ISODate;
  status: PlanStatus;
  version: number;
  totalBudgetHours?: number | string | null;
  totalBudgetAmount?: number | string | null;
  currency: string;
  narrative?: string | null;
  createdBy?: UserRef;
  approvedBy?: UserRef | null;
  approvedAt?: ISODate | null;
  itemCount?: number;
  items?: PlanItem[];
  rollups?: PlanRollups;
  availableActions?: AvailableAction[];
  createdAt?: ISODate;
  updatedAt?: ISODate;
}

export type ManagementRequestStatus = 'RECEIVED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'DECLINED' | 'PLANNED';

export interface ManagementRequest {
  id: UUID;
  title: string;
  description?: string | null;
  requesterName?: string | null;
  requestedBy?: UserRef | null;
  entity?: { id: UUID; name: string } | null;
  priority: TaskPriority;
  status: ManagementRequestStatus;
  receivedAt: ISODate;
  decisionNote?: string | null;
}

// ---------------------------------------------------------------------------
// Engagements
// ---------------------------------------------------------------------------

export type EngagementStatus = 'ACTIVE' | 'ON_HOLD' | 'CANCELLED' | 'COMPLETED';
export type EngagementRole =
  | 'PARTNER'
  | 'MANAGER'
  | 'LEAD'
  | 'SENIOR'
  | 'JUNIOR'
  | 'REVIEWER'
  | 'SPECIALIST'
  | 'OBSERVER';
export type AuditOpinion = 'SATISFACTORY' | 'NEEDS_IMPROVEMENT' | 'UNSATISFACTORY' | 'NOT_RATED';

export interface GuardCheck {
  guard: string;
  passed?: boolean;
  ok?: boolean;
  message?: string;
}

export interface AvailableAction {
  action: string;
  label?: string;
  to?: string;
  permission?: string;
  allowed?: boolean;
  guards?: GuardCheck[];
}

export interface EngagementSummary {
  id: UUID;
  auditNumber: string;
  title: string;
  type: EngagementType;
  stage: EngagementStage;
  status: EngagementStatus;
  riskRating: RiskRating;
  entity?: { id: UUID; name: string } | null;
  lead?: UserRef | null;
  plannedStart?: ISODate | null;
  plannedEnd?: ISODate | null;
  budgetHours?: number | string | null;
  workpaperCount?: number;
  openFindingsCount?: number;
  progressPct?: number;
  updatedAt?: ISODate;
}

export interface EngagementMember {
  id: UUID;
  userId: UUID;
  user?: UserRef;
  role: EngagementRole;
  plannedHours?: number | string | null;
  addedAt?: ISODate;
}

export interface EngagementStakeholder {
  id: UUID;
  userId?: UUID | null;
  name: string;
  email?: string | null;
  title?: string | null;
  organisation?: string | null;
  role: string;
  isPrimary: boolean;
}

export interface EngagementMilestone {
  id: UUID;
  name: string;
  stage?: EngagementStage | null;
  dueDate: ISODate;
  completedAt?: ISODate | null;
  sortOrder: number;
}

export interface StageHistoryEntry {
  id: UUID;
  fromStage?: EngagementStage | null;
  toStage: EngagementStage;
  changedBy?: UserRef;
  comment?: string | null;
  changedAt: ISODate;
}

export interface Engagement extends EngagementSummary {
  entityId?: UUID | null;
  objectives?: string | null;
  scope?: string | null;
  outOfScope?: string | null;
  background?: string | null;
  periodStart?: ISODate | null;
  periodEnd?: ISODate | null;
  actualStart?: ISODate | null;
  actualEnd?: ISODate | null;
  budgetAmount?: number | string | null;
  leadId?: UUID | null;
  managerId?: UUID | null;
  manager?: UserRef | null;
  partnerId?: UUID | null;
  partner?: UserRef | null;
  opinion: AuditOpinion;
  executiveSummary?: string | null;
  reportIssuedAt?: ISODate | null;
  reportDocumentId?: UUID | null;
  members: EngagementMember[];
  stakeholders: EngagementStakeholder[];
  milestones: EngagementMilestone[];
  stageHistory: StageHistoryEntry[];
  counts?: {
    workpapers?: number;
    findings?: number;
    openFindings?: number;
    requests?: number;
    evidence?: number;
    openReviewNotes?: number;
  };
  availableActions?: AvailableAction[];
  createdAt: ISODate;
}

// ---------------------------------------------------------------------------
// Programmes and workpapers
// ---------------------------------------------------------------------------

export type ProgramStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED';
export type StepStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NOT_APPLICABLE';

export interface ProgramStep {
  id: UUID;
  programId: UUID;
  section: string;
  reference: string;
  sortOrder: number;
  objective: string;
  procedure: string;
  riskId?: UUID | null;
  controlId?: UUID | null;
  assigneeId?: UUID | null;
  assignee?: UserRef | null;
  estimatedHours?: number | string | null;
  status: StepStatus;
  workpapers?: { id: UUID; reference: string; status: WorkpaperStatus }[];
}

export interface AuditProgram {
  id: UUID;
  engagementId: UUID;
  title: string;
  description?: string | null;
  status: ProgramStatus;
  libraryItemId?: UUID | null;
  approvedBy?: UserRef | null;
  approvedAt?: ISODate | null;
  steps: ProgramStep[];
}

export type ReviewNoteStatus = 'OPEN' | 'ADDRESSED' | 'CLEARED';
export type ReviewNotePriority = 'LOW' | 'NORMAL' | 'HIGH';

export interface ReviewNote {
  id: UUID;
  workpaperId: UUID;
  text: string;
  priority: ReviewNotePriority;
  status: ReviewNoteStatus;
  raisedBy?: UserRef;
  raisedById: UUID;
  assignedTo?: UserRef | null;
  assignedToId?: UUID | null;
  response?: string | null;
  respondedAt?: ISODate | null;
  clearedBy?: UserRef | null;
  clearedAt?: ISODate | null;
  createdAt: ISODate;
}

export interface WorkpaperVersionMeta {
  id: UUID;
  versionNumber: number;
  changeSummary?: string | null;
  changedBy?: UserRef;
  createdAt: ISODate;
}

export interface WorkpaperSnapshot {
  versionNumber: number;
  snapshot: Partial<Workpaper> & Record<string, unknown>;
  changedBy?: UserRef;
  createdAt: ISODate;
}

export interface WorkpaperSummary {
  id: UUID;
  engagementId: UUID;
  reference: string;
  title: string;
  status: WorkpaperStatus;
  currentVersion: number;
  preparedBy?: UserRef | null;
  reviewedBy?: UserRef | null;
  signedOffBy?: UserRef | null;
  isLocked: boolean;
  sortOrder?: number;
  programStepId?: UUID | null;
  openReviewNotes?: number;
  updatedAt?: ISODate;
}

export interface Workpaper extends WorkpaperSummary {
  objective?: string | null;
  riskId?: UUID | null;
  risk?: RiskSummary | null;
  controlId?: UUID | null;
  control?: ControlSummary | null;
  procedure?: string | null;
  testPerformed?: string | null;
  results?: string | null;
  exceptions?: string | null;
  conclusion?: string | null;
  content?: Record<string, unknown>;
  preparedAt?: ISODate | null;
  reviewedAt?: ISODate | null;
  signedOffAt?: ISODate | null;
  aiSummary?: string | null;
  engagement?: { id: UUID; auditNumber: string; title: string; stage?: EngagementStage };
  versions: WorkpaperVersionMeta[];
  reviewNotes: ReviewNote[];
  evidence: Evidence[];
  availableActions?: AvailableAction[];
  createdAt: ISODate;
}

export interface WorkpaperTemplate {
  id: UUID;
  name: string;
  category?: string | null;
  description?: string | null;
}

// ---------------------------------------------------------------------------
// Documents and evidence
// ---------------------------------------------------------------------------

export type DocumentClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
export type EvidenceType =
  | 'DOCUMENT'
  | 'SCREENSHOT'
  | 'SYSTEM_EXTRACT'
  | 'INTERVIEW_NOTE'
  | 'OBSERVATION'
  | 'RECALCULATION'
  | 'CONFIRMATION'
  | 'EMAIL'
  | 'PHOTO'
  | 'VOICE_NOTE';

export interface Document {
  id: UUID;
  ownerType?: string | null;
  ownerId?: UUID | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number | string;
  classification: DocumentClassification;
  currentVersion: number;
  uploadedBy?: UserRef;
  uploadedById?: UUID;
  tags?: string[];
  uploadedAt?: ISODate | null;
  createdAt: ISODate;
}

export interface DownloadLink {
  url: string;
  expiresAt: ISODate;
  fileName: string;
  mimeType: string;
}

export interface Evidence {
  id: UUID;
  engagementId: UUID;
  workpaperId?: UUID | null;
  documentId?: UUID | null;
  document?: Document | null;
  reference: string;
  description: string;
  type: EvidenceType;
  obtainedFrom?: string | null;
  obtainedAt?: ISODate | null;
  obtainedBy?: UserRef;
  isSufficient?: boolean | null;
  createdAt: ISODate;
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

export type RootCauseCategory = 'PEOPLE' | 'PROCESS' | 'TECHNOLOGY' | 'GOVERNANCE' | 'EXTERNAL' | 'DATA' | 'POLICY';
export type RecommendationStatus =
  | 'PROPOSED'
  | 'AGREED'
  | 'IN_PROGRESS'
  | 'IMPLEMENTED'
  | 'VALIDATED'
  | 'NOT_IMPLEMENTED'
  | 'SUPERSEDED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Recommendation {
  id: UUID;
  findingId: UUID;
  sequence: number;
  text: string;
  priority: TaskPriority;
  ownerId?: UUID | null;
  owner?: UserRef | null;
  ownerName?: string | null;
  dueDate?: ISODate | null;
  status: RecommendationStatus;
  actionPlan?: string | null;
  progressNote?: string | null;
  progressPct: number;
  completedAt?: ISODate | null;
}

export interface FindingStatusHistoryEntry {
  id: UUID;
  fromStatus?: FindingStatus | null;
  toStatus: FindingStatus;
  changedBy?: UserRef;
  comment?: string | null;
  changedAt: ISODate;
}

export interface FindingSummary {
  id: UUID;
  engagementId: UUID;
  engagement?: { id: UUID; auditNumber: string; title: string } | null;
  entity?: { id: UUID; name: string } | null;
  reference: string;
  title: string;
  severity: Severity;
  status: FindingStatus;
  actionOwner?: UserRef | null;
  actionOwnerName?: string | null;
  dueDate?: ISODate | null;
  ageingBucket?: AgeingBucket;
  daysOverdue?: number;
  isRepeat?: boolean;
  updatedAt?: ISODate;
  createdAt?: ISODate;
}

export interface Finding extends FindingSummary {
  workpaperId?: UUID | null;
  workpaper?: { id: UUID; reference: string; title: string } | null;
  entityId?: UUID | null;
  processId?: UUID | null;
  process?: { id: UUID; name: string } | null;
  riskId?: UUID | null;
  risk?: RiskSummary | null;
  controlId?: UUID | null;
  control?: ControlSummary | null;
  condition: string;
  criteria: string;
  cause?: string | null;
  impact?: string | null;
  recommendation?: string | null;
  managementResponse?: string | null;
  rootCauseCategory?: RootCauseCategory | null;
  category?: string | null;
  actionOwnerId?: UUID | null;
  actionOwnerEmail?: string | null;
  originalDueDate?: ISODate | null;
  extensionCount: number;
  agreedAt?: ISODate | null;
  implementedAt?: ISODate | null;
  validatedBy?: UserRef | null;
  validatedAt?: ISODate | null;
  closedAt?: ISODate | null;
  repeatOfId?: UUID | null;
  raisedBy?: UserRef;
  escalationLevel: number;
  recommendations: Recommendation[];
  statusHistory: FindingStatusHistoryEntry[];
  evidence: Evidence[];
  availableActions?: AvailableAction[];
}

export interface FindingAgeing {
  buckets: { bucket: AgeingBucket; count: number }[];
  bySeverity: { severity: Severity; count: number }[] | Record<string, number>;
  overdueTotal: number;
}

// ---------------------------------------------------------------------------
// Document requests
// ---------------------------------------------------------------------------

export interface DocumentRequest {
  id: UUID;
  engagementId: UUID;
  engagement?: { id: UUID; auditNumber: string; title: string } | null;
  reference: string;
  title: string;
  description?: string | null;
  requestedBy?: UserRef;
  assigneeId?: UUID | null;
  assignee?: UserRef | null;
  assigneeEmail?: string | null;
  dueDate: ISODate;
  status: RequestStatus;
  responseNote?: string | null;
  submittedAt?: ISODate | null;
  acceptedAt?: ISODate | null;
  returnReason?: string | null;
  documents?: Document[];
  availableActions?: AvailableAction[];
  createdAt: ISODate;
  updatedAt?: ISODate;
}

// ---------------------------------------------------------------------------
// Collaboration
// ---------------------------------------------------------------------------

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';

export interface Task {
  id: UUID;
  engagementId?: UUID | null;
  engagement?: { id: UUID; auditNumber: string; title: string } | null;
  targetType?: string | null;
  targetId?: UUID | null;
  title: string;
  description?: string | null;
  assigneeId?: UUID | null;
  assignee?: UserRef | null;
  createdBy?: UserRef;
  dueDate?: ISODate | null;
  priority: TaskPriority;
  status: TaskStatus;
  completedAt?: ISODate | null;
  createdAt: ISODate;
}

export interface Comment {
  id: UUID;
  targetType: string;
  targetId: UUID;
  parentId?: UUID | null;
  author?: UserRef;
  authorId: UUID;
  body: string;
  mentions?: string[];
  isInternal: boolean;
  editedAt?: ISODate | null;
  createdAt: ISODate;
}

export interface Notification {
  id: UUID;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  readAt?: ISODate | null;
  createdAt: ISODate;
}

export interface AuditTrailEntry {
  id: number | string;
  actorId?: UUID | null;
  actorEmail?: string | null;
  actor?: UserRef | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  requestId?: string | null;
  occurredAt: ISODate;
}

// ---------------------------------------------------------------------------
// Time, resources and availability
// ---------------------------------------------------------------------------

export type TimesheetStatus = 'OPEN' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type AvailabilityType = 'LEAVE' | 'TRAINING' | 'PUBLIC_HOLIDAY' | 'SECONDMENT' | 'OTHER';

export interface ChargeCode {
  id: UUID;
  code: string;
  name: string;
  isBillable: boolean;
  isActive: boolean;
}

export interface TimeEntry {
  id: UUID;
  timesheetId: UUID;
  engagementId?: UUID | null;
  engagement?: { id: UUID; auditNumber: string; title: string } | null;
  chargeCodeId: UUID;
  chargeCode?: ChargeCode;
  date: ISODate;
  hours: number | string;
  notes?: string | null;
  createdAt: ISODate;
}

export interface Timesheet {
  id: UUID;
  userId: UUID;
  user?: UserRef & { weeklyCapacity?: number | string | null };
  weekStart: ISODate;
  status: TimesheetStatus;
  totalHours: number | string;
  submittedAt?: ISODate | null;
  approvedBy?: UserRef | null;
  approvedAt?: ISODate | null;
  rejectReason?: string | null;
  entries: TimeEntry[];
}

export interface StaffAvailability {
  id: UUID;
  userId: UUID;
  user?: UserRef;
  type: AvailabilityType;
  startDate: ISODate;
  endDate: ISODate;
  hoursPerDay: number | string;
  note?: string | null;
}

export interface ResourceSummary {
  currentWeekStart: ISODate;
  currentTimesheet?: Timesheet | null;
  pendingApproval: number;
  chargeCodes: ChargeCode[];
  utilisation: { periodDays: number; capacityHours: number; recordedHours: number; utilisationPct?: number | null };
  upcomingAvailability: StaffAvailability[];
}

// ---------------------------------------------------------------------------
// AI, monitoring and reports
// ---------------------------------------------------------------------------

export type AiFeature =
  | 'planning.scope'
  | 'fieldwork.procedures'
  | 'evidence.summary'
  | 'finding.draft'
  | 'report.summary'
  | 'quality.check'
  | 'risk.radar'
  | 'search.nl';

export interface AiCopilotResponse {
  version?: string;
  reviewRequired?: true;
  reviewNotice?: string;
  prompt?: string;
  sections?: import('@auditsphere/shared').AssistantContent['sections'];
  exceptions?: import('@auditsphere/shared').AssistantContent['exceptions'];
  reviewerNotes?: import('@auditsphere/shared').AssistantContent['reviewerNotes'];
  evidenceAssessment?: import('@auditsphere/shared').AssistantContent['evidenceAssessment'];
  ratingProposal?: import('@auditsphere/shared').AssistantContent['ratingProposal'];
  sourceRegister?: import('@auditsphere/shared').AuditSource[];
  contextLinks?: import('@auditsphere/shared').AuditAssistantResponse['contextLinks'];
  contextWarnings?: string[];
  search?: import('@auditsphere/shared').AuditSearchSummary;
  id: UUID;
  createdAt: ISODate;
  provider: 'openai-compatible' | 'local-rulepack' | 'local-fallback';
  model: string;
  title: string;
  narrative: string;
  suggestions: string[];
  checklist: string[];
  caveats: string[];
  sources?: { documentId: UUID; fileName: string; characters: number; truncated: boolean }[];
}

export interface AiContextDocument {
  id: UUID;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  characters: number;
  preview: string;
  truncated: boolean;
  createdAt: ISODate;
}

export interface AiInteraction {
  id: UUID;
  feature: AiFeature;
  targetType?: string | null;
  targetId?: UUID | null;
  model: string;
  promptTokens: number;
  outputTokens: number;
  latencyMs?: number | null;
  accepted?: boolean | null;
  rating?: number | null;
  createdAt: ISODate;
  user?: UserRef;
  response?: Partial<AiCopilotResponse>;
}

export type RiskSignalStatus = 'NEW' | 'REVIEWED' | 'LINKED' | 'DISMISSED';
export type MonitoringAlertStatus = 'OPEN' | 'INVESTIGATING' | 'CONFIRMED' | 'FALSE_POSITIVE' | 'ESCALATED';
export type ConnectorType = 'DATABASE' | 'REST_API' | 'FILE_UPLOAD' | 'SAP' | 'ORACLE' | 'DYNAMICS_365' | 'SAGE';

export interface RiskSignal {
  id: UUID;
  source: string;
  title: string;
  summary?: string | null;
  url?: string | null;
  publishedAt?: ISODate | null;
  relevanceScore?: number | string | null;
  status: RiskSignalStatus;
  riskId?: UUID | null;
  risk?: RiskSummary | null;
  metadata?: Record<string, unknown>;
  createdAt: ISODate;
}

export interface MonitoringRule {
  id: UUID;
  connectorId?: UUID | null;
  connector?: { id: UUID; name: string; type: ConnectorType; lastRunAt?: ISODate | null; lastStatus?: string | null } | null;
  code: string;
  name: string;
  description?: string | null;
  ruleType: string;
  definition: Record<string, unknown>;
  severity: Severity;
  isActive: boolean;
  lastRunAt?: ISODate | null;
  createdAt: ISODate;
  updatedAt?: ISODate;
  _count?: { alerts?: number };
}

export interface MonitoringAlert {
  id: UUID;
  ruleId: UUID;
  rule?: Pick<MonitoringRule, 'id' | 'code' | 'name' | 'ruleType' | 'severity'> & Partial<Pick<MonitoringRule, 'description' | 'connector'>>;
  title: string;
  detail: Record<string, unknown>;
  amount?: number | string | null;
  status: MonitoringAlertStatus;
  assigneeId?: UUID | null;
  assignee?: UserRef | null;
  findingId?: UUID | null;
  detectedAt: ISODate;
  resolvedAt?: ISODate | null;
}

export interface DataConnector {
  id: UUID;
  name: string;
  type: ConnectorType;
  schedule?: string | null;
  lastRunAt?: ISODate | null;
  lastStatus?: string | null;
  isActive: boolean;
  _count?: { rules?: number };
}

export interface MonitoringSummary {
  signalsByStatus: { status: RiskSignalStatus; count: number }[];
  alertsByStatus: { status: MonitoringAlertStatus; count: number }[];
  openAssignedToMe: number;
  activeRules: number;
  activeConnectors: number;
  openAlertsByRule: { ruleId: UUID; code?: string; name?: string; severity?: Severity; count: number }[];
}

export interface GeneratedReportSection {
  heading: string;
  body: string;
}

export interface ExecutiveReport {
  title: string;
  generatedAt: ISODate;
  metrics: Record<string, number>;
  sections: GeneratedReportSection[];
  source?: { committee?: CommitteeDashboard; partner?: PartnerDashboard; plans?: AuditPlan[] };
}

export interface FindingRegisterReport extends Paged<FindingSummary> {
  generatedAt: ISODate;
  rollups: {
    bySeverity: { severity: Severity; count: number }[];
    byStatus: { status: FindingStatus; count: number }[];
    ageing: { bucket: AgeingBucket; count: number }[];
  };
}

export interface EngagementRegisterReport extends Paged<EngagementSummary & { opinion?: AuditOpinion; reportIssuedAt?: ISODate | null; _count?: Record<string, number> }> {
  generatedAt: ISODate;
  rollups: {
    byStage: { stage: EngagementStage; count: number }[];
    byOpinion: { opinion: AuditOpinion; count: number }[];
  };
}

export interface EngagementReport {
  title: string;
  generatedAt: ISODate;
  engagement: Engagement;
  sections: GeneratedReportSection[];
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

export type LibraryItemType =
  | 'AUDIT_PROGRAM'
  | 'RISK'
  | 'CONTROL'
  | 'TEST_PROCEDURE'
  | 'FINDING'
  | 'RECOMMENDATION'
  | 'WORKPAPER_TEMPLATE'
  | 'CHECKLIST';
export type LibraryStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED' | 'RETIRED';

export interface LibraryProgramContent {
  sections: {
    name: string;
    steps: { reference: string; objective: string; procedure: string; estimatedHours?: number }[];
  }[];
}

export interface LibraryItem {
  id: UUID;
  tenantId?: UUID | null;
  type: LibraryItemType;
  code: string;
  title: string;
  summary?: string | null;
  content: LibraryProgramContent | Record<string, unknown>;
  industry?: string | null;
  tags?: string[];
  version: number;
  status: LibraryStatus;
  usageCount: number;
  rating?: number | string | null;
  createdBy?: UserRef;
  approvedBy?: UserRef | null;
  approvedAt?: ISODate | null;
  frameworkRefs?: { framework: string; refCode: string; title?: string }[];
  createdAt: ISODate;
  updatedAt?: ISODate;
}

export interface Framework {
  id: UUID;
  code: string;
  name: string;
  version?: string | null;
  description?: string | null;
  references?: { id: UUID; refCode: string; title: string; description?: string | null }[];
}

// ---------------------------------------------------------------------------
// Dashboards and search
// ---------------------------------------------------------------------------

export interface CountList<T> {
  count: number;
  items: T[];
}

export interface AuditorDashboard {
  assignedSteps: CountList<ProgramStep & { engagement?: { id: UUID; auditNumber: string; title: string } }>;
  openReviewNotes: CountList<ReviewNote & { workpaper?: { id: UUID; reference: string; title: string } }>;
  pendingReviews: CountList<WorkpaperSummary & { engagement?: { id: UUID; auditNumber: string } }>;
  deadlines: CountList<{
    id: UUID;
    title: string;
    dueDate: ISODate;
    type?: string;
    link?: string;
    engagement?: { id: UUID; auditNumber: string };
  }>;
  myFindings: CountList<FindingSummary>;
  myRequests: CountList<DocumentRequest>;
}

export interface PartnerDashboard {
  engagementsByStage: { stage: EngagementStage; count: number }[];
  budgetVsActual: {
    engagementId: UUID;
    auditNumber: string;
    title: string;
    budgetHours: number;
    actualHours: number;
  }[];
  utilisation: {
    periodDays: number;
    items: { userId: UUID; displayName: string; capacityHours: number; recordedHours: number; utilisationPct: number | null }[];
  };
  overdueMilestones: CountList<{
    id: UUID;
    name: string;
    dueDate: ISODate;
    engagement: { id: UUID; auditNumber: string; title: string };
    daysOverdue?: number;
  }>;
}

export interface CommitteeDashboard {
  riskProfile: { cells: HeatmapCell[]; totalActiveRisks: number };
  planProgress: {
    planId: UUID;
    title: string;
    fiscalYear: number;
    total: number;
    completed: number;
    inProgress: number;
    completionPct: number;
    byStatus: { status: PlanItemStatus; count: number }[];
  } | null;
  keyFindings: CountList<FindingSummary>;
  repeatFindings: CountList<FindingSummary>;
  overdueActions: {
    buckets: { bucket: AgeingBucket; count: number }[];
    total: number;
  };
  riskTrend: { period: string; assessments: number; avgResidualScore: number; avgInherentScore: number; lastAssessedAt: ISODate | null }[];
}

export interface SearchResults {
  engagements: { id: UUID; auditNumber: string; title: string; stage?: EngagementStage }[];
  findings: { id: UUID; reference: string; title: string; severity?: Severity; status?: FindingStatus }[];
  workpapers: { id: UUID; reference: string; title: string; engagementId?: UUID }[];
  entities: { id: UUID; code: string; name: string; type?: EntityType }[];
  risks: { id: UUID; code: string; title: string; rating?: RiskRating }[];
  controls: { id: UUID; code: string; title: string }[];
}
