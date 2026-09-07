# BDO AuditSphere - Entity Relationship Diagram

Source of truth: `packages/db/prisma/schema.prisma`. Every business table carries `tenantId`.
Diagrams are grouped by module for readability; foreign keys to `User` are shown only where
they carry business meaning.

## 1. Identity and access

```mermaid
erDiagram
  Tenant ||--o{ User : has
  Tenant ||--o{ Role : defines
  Role ||--o{ RolePermission : grants
  Permission ||--o{ RolePermission : in
  User ||--o{ UserRole : holds
  Role ||--o{ UserRole : assigned
  AuditEntity o|--o{ UserRole : "scopes (optional)"
  User ||--o{ RefreshToken : sessions

  User {
    uuid id PK
    uuid tenantId FK
    string email
    string displayName
    enum status
    enum authProvider
    string externalId "Entra object id"
    string passwordHash
    bool mfaEnabled
    string mfaSecretEnc
    decimal chargeRate
    decimal weeklyCapacity
  }
  Role {
    uuid id PK
    enum key "9 system roles"
    string name
  }
  Permission {
    uuid id PK
    string key "module:action"
    string module
  }
```

## 2. Audit universe, risk and controls

```mermaid
erDiagram
  AuditEntity ||--o{ AuditEntity : "parent / child"
  AuditEntity ||--o{ Process : contains
  AuditEntity ||--o{ Risk : "risk of"
  Process ||--o{ Risk : "risk of"
  Process ||--o{ Control : "controlled by"
  RiskCategory ||--o{ Risk : categorises
  Risk ||--o{ RiskAssessment : "assessed over time"
  ScoringModel ||--o{ RiskAssessment : "scored with"
  Risk ||--o{ RiskControl : mitigated
  Control ||--o{ RiskControl : mitigates
  Control ||--o{ ControlTest : tested
  Engagement o|--o{ ControlTest : "tested in"
  Workpaper o|--o{ ControlTest : "documented in"

  AuditEntity {
    uuid id PK
    uuid parentId FK
    enum type "LEGAL_ENTITY .. THIRD_PARTY"
    string code
    string name
    uuid ownerId FK
    string country
    string_array strategicObjectives
    json regulatoryRequirements
    enum riskRating
    date lastAuditDate
    int auditFrequencyMonths
  }
  Risk {
    uuid id PK
    string code
    string title
    int inherentLikelihood "1-5"
    int inherentImpact "1-5"
    decimal inherentScore
    int controlEffectiveness "1-5"
    int residualLikelihood
    int residualImpact
    decimal residualScore
    enum velocity
    enum rating
    decimal appetiteThreshold
    bool withinAppetite
    enum aiSuggestedRating
  }
  Control {
    uuid id PK
    string code
    enum frequency
    enum type "PREVENTIVE / DETECTIVE / ..."
    enum nature "MANUAL / AUTOMATED"
    bool isKeyControl
    enum effectiveness
    json frameworkReferences
  }
  ControlTest {
    uuid id PK
    enum testType "DESIGN / OPERATING"
    int sampleSize
    int exceptions
    enum result
    string remediation
  }
```

## 3. Planning

```mermaid
erDiagram
  AuditPlan ||--o{ AuditPlanItem : contains
  AuditEntity o|--o{ AuditPlanItem : targets
  AuditPlanItem o|--o| Engagement : becomes
  AuditPlanItem o|--o{ ManagementRequest : addresses
  User ||--o{ AuditPlan : "created / approved by"

  AuditPlan {
    uuid id PK
    int fiscalYear
    int horizonYears
    enum status
    int version
    decimal totalBudgetHours
    decimal totalBudgetAmount
  }
  AuditPlanItem {
    uuid id PK
    enum source "RISK_BASED / MANAGEMENT_REQUEST / ..."
    enum engagementType
    enum riskRating
    int priority
    int plannedYear
    int plannedQuarter
    decimal budgetHours
    enum status
  }
```

## 4. Engagement lifecycle

```mermaid
erDiagram
  Engagement ||--o{ EngagementMember : team
  Engagement ||--o{ EngagementStakeholder : stakeholders
  Engagement ||--o{ EngagementMilestone : timeline
  Engagement ||--o{ EngagementStageHistory : "stage changes"
  Engagement ||--o{ AuditProgram : programmes
  AuditProgram ||--o{ AuditProgramStep : steps
  LibraryItem o|--o{ AuditProgram : "instantiated from"
  AuditProgramStep o|--o{ Workpaper : "documented by"
  Engagement ||--o{ Workpaper : workpapers
  WorkpaperTemplate o|--o{ Workpaper : "based on"
  Workpaper ||--o{ WorkpaperVersion : versions
  Workpaper ||--o{ ReviewNote : "review notes"
  Workpaper ||--o{ Evidence : evidence
  Document o|--o{ Evidence : file
  Document ||--o{ DocumentVersion : versions

  Engagement {
    uuid id PK
    string auditNumber
    string title
    enum type
    string objectives
    string scope
    date periodStart
    date periodEnd
    enum stage "PLANNING .. CLOSED"
    enum status
    uuid leadId FK
    uuid managerId FK
    uuid partnerId FK
    enum opinion
    date reportIssuedAt
  }
  Workpaper {
    uuid id PK
    string reference "B.2.1"
    string objective
    uuid riskId FK
    uuid controlId FK
    string procedure
    string testPerformed
    string results
    string conclusion
    enum status "DRAFT .. SIGNED_OFF"
    int currentVersion
    uuid preparedById FK
    uuid reviewedById FK
    uuid signedOffById FK
    bool isLocked
  }
  Document {
    uuid id PK
    string ownerType
    uuid ownerId
    string fileName
    string mimeType
    bigint sizeBytes
    string storageKey
    string checksumSha256
    enum classification
    string extractedText
  }
```

## 5. Findings and remediation

```mermaid
erDiagram
  Engagement ||--o{ Finding : raises
  Workpaper o|--o{ Finding : "supported by"
  Risk o|--o{ Finding : relates
  Control o|--o{ Finding : relates
  Finding ||--o{ Recommendation : recommends
  Finding ||--o{ FindingStatusHistory : history
  Finding o|--o{ Finding : "repeat of"
  Finding }o--o{ Evidence : "implementation evidence"
  Engagement ||--o{ DocumentRequest : requests
  DocumentRequest }o--o{ Document : responses

  Finding {
    uuid id PK
    string reference
    string title
    enum severity
    enum status "DRAFT .. CLOSED"
    string condition
    string criteria
    string cause
    string impact
    string recommendation
    string managementResponse
    enum rootCauseCategory
    uuid actionOwnerId FK
    date dueDate
    date originalDueDate
    int extensionCount
    bool isRepeat
    int escalationLevel
  }
  Recommendation {
    uuid id PK
    string text
    enum priority
    date dueDate
    enum status
    int progressPct
  }
  DocumentRequest {
    uuid id PK
    string reference
    string title
    uuid assigneeId FK
    date dueDate
    enum status
    int reminderCount
  }
```

## 6. Collaboration, governance and library

```mermaid
erDiagram
  Engagement o|--o{ Task : "for"
  Comment o|--o{ Comment : replies
  User ||--o{ Notification : receives
  User ||--o{ Approval : approves
  User o|--o{ AuditTrail : actor
  Framework ||--o{ FrameworkReference : references
  LibraryItem }o--o{ FrameworkReference : "mapped to"
  LibraryItem o|--o{ LibraryItem : "newer version"

  AuditTrail {
    bigint id PK
    uuid tenantId
    uuid actorId
    string action
    string targetType
    string targetId
    json before
    json after
    string requestId
    timestamp occurredAt
  }
  LibraryItem {
    uuid id PK
    uuid tenantId "null = global"
    enum type
    string code
    json content
    int version
    enum status
    int usageCount
  }
```

## 7. Time, AI and continuous monitoring

```mermaid
erDiagram
  User ||--o{ Timesheet : submits
  Timesheet ||--o{ TimeEntry : lines
  ChargeCode ||--o{ TimeEntry : "charged to"
  Engagement o|--o{ TimeEntry : "booked to"
  User ||--o{ StaffAvailability : availability
  User ||--o{ AiInteraction : "uses copilot"
  Risk o|--o{ RiskSignal : "linked signals"
  DataConnector ||--o{ MonitoringRule : rules
  MonitoringRule ||--o{ MonitoringAlert : alerts

  MonitoringRule {
    uuid id PK
    string ruleType "duplicate_payment / threshold / ..."
    json definition
    enum severity
  }
  MonitoringAlert {
    uuid id PK
    json detail
    decimal amount
    enum status
    uuid findingId
  }
```

## 8. Knowledge graph

The graph module traverses existing relations rather than a separate store:

```
Risk --RiskControl--> Control --AuditProgramStep--> Procedure --Workpaper--> Evidence
     \--Finding.riskId--> Finding --Recommendation--> Recommendation
```

Exposed through `/api/v1/graph/risk/:id` in Phase 1 and GraphQL in Phase 3.
