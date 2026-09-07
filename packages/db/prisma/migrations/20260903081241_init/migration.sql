-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "RoleKey" AS ENUM ('GLOBAL_ADMIN', 'AUDIT_PARTNER', 'CHIEF_AUDIT_EXECUTIVE', 'AUDIT_MANAGER', 'SENIOR_AUDITOR', 'JUNIOR_AUDITOR', 'BUSINESS_OWNER', 'MANAGEMENT_REVIEWER', 'AUDIT_COMMITTEE_VIEWER');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'ENTRA_ID');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('LEGAL_ENTITY', 'BUSINESS_UNIT', 'COUNTRY', 'DEPARTMENT', 'PROCESS', 'SYSTEM', 'PRODUCT', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "RiskRating" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('ACTIVE', 'MONITORING', 'RETIRED');

-- CreateEnum
CREATE TYPE "RiskVelocity" AS ENUM ('SLOW', 'MODERATE', 'FAST', 'IMMEDIATE');

-- CreateEnum
CREATE TYPE "ControlType" AS ENUM ('PREVENTIVE', 'DETECTIVE', 'CORRECTIVE', 'DIRECTIVE');

-- CreateEnum
CREATE TYPE "ControlNature" AS ENUM ('MANUAL', 'AUTOMATED', 'IT_DEPENDENT_MANUAL');

-- CreateEnum
CREATE TYPE "ControlFrequency" AS ENUM ('CONTINUOUS', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'EVENT_DRIVEN');

-- CreateEnum
CREATE TYPE "ControlEffectiveness" AS ENUM ('NOT_TESTED', 'EFFECTIVE', 'PARTIALLY_EFFECTIVE', 'INEFFECTIVE');

-- CreateEnum
CREATE TYPE "ControlTestType" AS ENUM ('DESIGN', 'OPERATING');

-- CreateEnum
CREATE TYPE "ControlTestResult" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PASS', 'PASS_WITH_EXCEPTIONS', 'FAIL');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PlanItemStatus" AS ENUM ('PROPOSED', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'DEFERRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlanItemSource" AS ENUM ('RISK_BASED', 'MANAGEMENT_REQUEST', 'REGULATORY', 'FOLLOW_UP', 'AUDIT_COMMITTEE', 'ROTATIONAL');

-- CreateEnum
CREATE TYPE "EngagementType" AS ENUM ('OPERATIONAL', 'FINANCIAL', 'COMPLIANCE', 'IT', 'INVESTIGATION', 'ADVISORY', 'FOLLOW_UP', 'INTEGRATED');

-- CreateEnum
CREATE TYPE "EngagementStage" AS ENUM ('PLANNING', 'RISK_ASSESSMENT', 'PROGRAMME', 'FIELDWORK', 'REVIEW', 'REPORTING', 'FOLLOW_UP', 'CLOSED');

-- CreateEnum
CREATE TYPE "EngagementStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EngagementRole" AS ENUM ('PARTNER', 'MANAGER', 'LEAD', 'SENIOR', 'JUNIOR', 'REVIEWER', 'SPECIALIST', 'OBSERVER');

-- CreateEnum
CREATE TYPE "AuditOpinion" AS ENUM ('SATISFACTORY', 'NEEDS_IMPROVEMENT', 'UNSATISFACTORY', 'NOT_RATED');

-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "WorkpaperStatus" AS ENUM ('DRAFT', 'PREPARED', 'IN_REVIEW', 'REVIEW_NOTES_OPEN', 'REVIEWED', 'SIGNED_OFF');

-- CreateEnum
CREATE TYPE "ReviewNoteStatus" AS ENUM ('OPEN', 'ADDRESSED', 'CLEARED');

-- CreateEnum
CREATE TYPE "ReviewNotePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVED', 'CHANGES_REQUESTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewLevel" AS ENUM ('PREPARER', 'FIRST', 'SECOND', 'PARTNER', 'QUALITY');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('DOCUMENT', 'SCREENSHOT', 'SYSTEM_EXTRACT', 'INTERVIEW_NOTE', 'OBSERVATION', 'RECALCULATION', 'CONFIRMATION', 'EMAIL', 'PHOTO', 'VOICE_NOTE');

-- CreateEnum
CREATE TYPE "DocumentClassification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('DRAFT', 'MANAGEMENT_REVIEW', 'AGREED', 'IMPLEMENTATION', 'VALIDATION', 'CLOSED', 'RISK_ACCEPTED');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('PROPOSED', 'AGREED', 'IN_PROGRESS', 'IMPLEMENTED', 'VALIDATED', 'NOT_IMPLEMENTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "RootCauseCategory" AS ENUM ('PEOPLE', 'PROCESS', 'TECHNOLOGY', 'GOVERNANCE', 'EXTERNAL', 'DATA', 'POLICY');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'SUBMITTED', 'ACCEPTED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'TEAMS');

-- CreateEnum
CREATE TYPE "LibraryItemType" AS ENUM ('AUDIT_PROGRAM', 'RISK', 'CONTROL', 'TEST_PROCEDURE', 'FINDING', 'RECOMMENDATION', 'WORKPAPER_TEMPLATE', 'CHECKLIST');

-- CreateEnum
CREATE TYPE "LibraryStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('OPEN', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AvailabilityType" AS ENUM ('LEAVE', 'TRAINING', 'PUBLIC_HOLIDAY', 'SECONDMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ManagementRequestStatus" AS ENUM ('RECEIVED', 'UNDER_REVIEW', 'ACCEPTED', 'DECLINED', 'PLANNED');

-- CreateEnum
CREATE TYPE "RiskSignalStatus" AS ENUM ('NEW', 'REVIEWED', 'LINKED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "MonitoringAlertStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'CONFIRMED', 'FALSE_POSITIVE', 'ESCALATED');

-- CreateEnum
CREATE TYPE "ConnectorType" AS ENUM ('DATABASE', 'REST_API', 'FILE_UPLOAD', 'SAP', 'ORACLE', 'DYNAMICS_365', 'SAGE');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "jobTitle" TEXT,
    "officeLocation" TEXT,
    "country" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "externalId" TEXT,
    "passwordHash" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecretEnc" TEXT,
    "mfaRecoveryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastLoginAt" TIMESTAMP(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "chargeRate" DECIMAL(12,2),
    "weeklyCapacity" DECIMAL(5,2) NOT NULL DEFAULT 40,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "key" "RoleKey" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "entityId" UUID,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "family" UUID NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEntity" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "parentId" UUID,
    "type" "EntityType" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" UUID,
    "country" TEXT,
    "strategicObjectives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "regulatoryRequirements" JSONB NOT NULL DEFAULT '[]',
    "riskRating" "RiskRating" NOT NULL DEFAULT 'MEDIUM',
    "riskScore" DECIMAL(6,2),
    "lastAuditDate" TIMESTAMP(3),
    "nextAuditDue" TIMESTAMP(3),
    "auditFrequencyMonths" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AuditEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Process" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" UUID,
    "category" TEXT,
    "isKey" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Process_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskCategory" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "weight" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "colour" TEXT,

    CONSTRAINT "RiskCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringModel" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "likelihoodScale" JSONB NOT NULL,
    "impactScale" JSONB NOT NULL,
    "weights" JSONB NOT NULL DEFAULT '{"likelihood":1,"impact":1,"velocity":0}',
    "thresholds" JSONB NOT NULL DEFAULT '{"LOW":5,"MEDIUM":10,"HIGH":16,"CRITICAL":25}',
    "appetite" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoringModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" UUID,
    "entityId" UUID,
    "processId" UUID,
    "ownerId" UUID,
    "source" TEXT,
    "status" "RiskStatus" NOT NULL DEFAULT 'ACTIVE',
    "inherentLikelihood" INTEGER NOT NULL DEFAULT 3,
    "inherentImpact" INTEGER NOT NULL DEFAULT 3,
    "inherentScore" DECIMAL(6,2) NOT NULL DEFAULT 9,
    "controlEffectiveness" INTEGER NOT NULL DEFAULT 3,
    "residualLikelihood" INTEGER NOT NULL DEFAULT 3,
    "residualImpact" INTEGER NOT NULL DEFAULT 3,
    "residualScore" DECIMAL(6,2) NOT NULL DEFAULT 9,
    "velocity" "RiskVelocity" NOT NULL DEFAULT 'MODERATE',
    "rating" "RiskRating" NOT NULL DEFAULT 'MEDIUM',
    "appetiteThreshold" DECIMAL(6,2),
    "withinAppetite" BOOLEAN,
    "aiSuggestedRating" "RiskRating",
    "aiRationale" TEXT,
    "lastAssessedAt" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "riskId" UUID NOT NULL,
    "scoringModelId" UUID,
    "periodLabel" TEXT NOT NULL,
    "inherentLikelihood" INTEGER NOT NULL,
    "inherentImpact" INTEGER NOT NULL,
    "inherentScore" DECIMAL(6,2) NOT NULL,
    "controlEffectiveness" INTEGER NOT NULL,
    "residualLikelihood" INTEGER NOT NULL,
    "residualImpact" INTEGER NOT NULL,
    "residualScore" DECIMAL(6,2) NOT NULL,
    "velocity" "RiskVelocity" NOT NULL,
    "rating" "RiskRating" NOT NULL,
    "rationale" TEXT,
    "assessedById" UUID NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Control" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "processId" UUID,
    "ownerId" UUID,
    "frequency" "ControlFrequency" NOT NULL DEFAULT 'MONTHLY',
    "type" "ControlType" NOT NULL DEFAULT 'PREVENTIVE',
    "nature" "ControlNature" NOT NULL DEFAULT 'MANUAL',
    "isKeyControl" BOOLEAN NOT NULL DEFAULT false,
    "effectiveness" "ControlEffectiveness" NOT NULL DEFAULT 'NOT_TESTED',
    "designEffective" BOOLEAN,
    "operatingEffective" BOOLEAN,
    "lastTestedAt" TIMESTAMP(3),
    "frameworkReferences" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Control_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskControl" (
    "tenantId" UUID NOT NULL,
    "riskId" UUID NOT NULL,
    "controlId" UUID NOT NULL,

    CONSTRAINT "RiskControl_pkey" PRIMARY KEY ("riskId","controlId")
);

-- CreateTable
CREATE TABLE "ControlTest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "controlId" UUID NOT NULL,
    "engagementId" UUID,
    "workpaperId" UUID,
    "testType" "ControlTestType" NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "populationSize" INTEGER,
    "sampleSize" INTEGER,
    "exceptions" INTEGER NOT NULL DEFAULT 0,
    "result" "ControlTestResult" NOT NULL DEFAULT 'NOT_STARTED',
    "procedure" TEXT,
    "conclusion" TEXT,
    "remediation" TEXT,
    "testedById" UUID,
    "testedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ControlTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditPlan" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "horizonYears" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "totalBudgetHours" DECIMAL(10,2),
    "totalBudgetAmount" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "narrative" TEXT,
    "createdById" UUID NOT NULL,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditPlanItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "entityId" UUID,
    "engagementId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source" "PlanItemSource" NOT NULL DEFAULT 'RISK_BASED',
    "engagementType" "EngagementType" NOT NULL DEFAULT 'OPERATIONAL',
    "riskRating" "RiskRating" NOT NULL DEFAULT 'MEDIUM',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "plannedYear" INTEGER NOT NULL,
    "plannedQuarter" INTEGER,
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "budgetHours" DECIMAL(10,2),
    "budgetAmount" DECIMAL(14,2),
    "leadId" UUID,
    "status" "PlanItemStatus" NOT NULL DEFAULT 'PLANNED',
    "rationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagementRequest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requestedById" UUID,
    "requesterName" TEXT,
    "entityId" UUID,
    "planItemId" UUID,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "ManagementRequestStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagementRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Engagement" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "auditNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "EngagementType" NOT NULL DEFAULT 'OPERATIONAL',
    "entityId" UUID,
    "objectives" TEXT,
    "scope" TEXT,
    "outOfScope" TEXT,
    "background" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "stage" "EngagementStage" NOT NULL DEFAULT 'PLANNING',
    "status" "EngagementStatus" NOT NULL DEFAULT 'ACTIVE',
    "riskRating" "RiskRating" NOT NULL DEFAULT 'MEDIUM',
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "budgetHours" DECIMAL(10,2),
    "budgetAmount" DECIMAL(14,2),
    "leadId" UUID,
    "managerId" UUID,
    "partnerId" UUID,
    "opinion" "AuditOpinion" NOT NULL DEFAULT 'NOT_RATED',
    "executiveSummary" TEXT,
    "reportIssuedAt" TIMESTAMP(3),
    "reportDocumentId" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Engagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementMember" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "engagementId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "EngagementRole" NOT NULL,
    "plannedHours" DECIMAL(8,2),
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementStakeholder" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "engagementId" UUID NOT NULL,
    "userId" UUID,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "title" TEXT,
    "organisation" TEXT,
    "role" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EngagementStakeholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementMilestone" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "engagementId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "EngagementStage",
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EngagementMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementStageHistory" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "engagementId" UUID NOT NULL,
    "fromStage" "EngagementStage",
    "toStage" "EngagementStage" NOT NULL,
    "changedById" UUID NOT NULL,
    "comment" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementStageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditProgram" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "engagementId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "libraryItemId" UUID,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditProgramStep" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "section" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "objective" TEXT NOT NULL,
    "procedure" TEXT NOT NULL,
    "riskId" UUID,
    "controlId" UUID,
    "assigneeId" UUID,
    "estimatedHours" DECIMAL(8,2),
    "status" "StepStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditProgramStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkpaperTemplate" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "structure" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkpaperTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workpaper" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "engagementId" UUID NOT NULL,
    "programStepId" UUID,
    "templateId" UUID,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT,
    "riskId" UUID,
    "controlId" UUID,
    "procedure" TEXT,
    "testPerformed" TEXT,
    "results" TEXT,
    "exceptions" TEXT,
    "conclusion" TEXT,
    "content" JSONB NOT NULL DEFAULT '{}',
    "status" "WorkpaperStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "preparedById" UUID,
    "preparedAt" TIMESTAMP(3),
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "signedOffById" UUID,
    "signedOffAt" TIMESTAMP(3),
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "aiSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Workpaper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkpaperVersion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "workpaperId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changeSummary" TEXT,
    "changedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkpaperVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewNote" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "workpaperId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "priority" "ReviewNotePriority" NOT NULL DEFAULT 'NORMAL',
    "status" "ReviewNoteStatus" NOT NULL DEFAULT 'OPEN',
    "raisedById" UUID NOT NULL,
    "assignedToId" UUID,
    "response" TEXT,
    "respondedAt" TIMESTAMP(3),
    "clearedById" UUID,
    "clearedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" UUID NOT NULL,
    "level" "ReviewLevel" NOT NULL,
    "reviewerId" UUID NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ownerType" TEXT,
    "ownerId" UUID,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "checksumSha256" TEXT,
    "classification" "DocumentClassification" NOT NULL DEFAULT 'CONFIDENTIAL',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "uploadedById" UUID NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "extractedText" TEXT,
    "aiSummary" TEXT,
    "isQuarantined" BOOLEAN NOT NULL DEFAULT false,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksumSha256" TEXT,
    "uploadedById" UUID NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "engagementId" UUID NOT NULL,
    "workpaperId" UUID,
    "documentId" UUID,
    "reference" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL DEFAULT 'DOCUMENT',
    "obtainedFrom" TEXT,
    "obtainedAt" TIMESTAMP(3),
    "obtainedById" UUID NOT NULL,
    "isSufficient" BOOLEAN,
    "aiAnalysis" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "engagementId" UUID NOT NULL,
    "workpaperId" UUID,
    "entityId" UUID,
    "processId" UUID,
    "riskId" UUID,
    "controlId" UUID,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "FindingStatus" NOT NULL DEFAULT 'DRAFT',
    "condition" TEXT NOT NULL,
    "criteria" TEXT NOT NULL,
    "cause" TEXT,
    "impact" TEXT,
    "recommendation" TEXT,
    "managementResponse" TEXT,
    "rootCauseCategory" "RootCauseCategory",
    "category" TEXT,
    "actionOwnerId" UUID,
    "actionOwnerName" TEXT,
    "actionOwnerEmail" TEXT,
    "dueDate" TIMESTAMP(3),
    "originalDueDate" TIMESTAMP(3),
    "extensionCount" INTEGER NOT NULL DEFAULT 0,
    "agreedAt" TIMESTAMP(3),
    "implementedAt" TIMESTAMP(3),
    "validatedById" UUID,
    "validatedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "isRepeat" BOOLEAN NOT NULL DEFAULT false,
    "repeatOfId" UUID,
    "raisedById" UUID NOT NULL,
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "aiDraft" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "findingId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "text" TEXT NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "ownerId" UUID,
    "ownerName" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PROPOSED',
    "actionPlan" TEXT,
    "progressNote" TEXT,
    "progressPct" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FindingStatusHistory" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "findingId" UUID NOT NULL,
    "fromStatus" "FindingStatus",
    "toStatus" "FindingStatus" NOT NULL,
    "changedById" UUID NOT NULL,
    "comment" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FindingStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRequest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "engagementId" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requestedById" UUID NOT NULL,
    "assigneeId" UUID,
    "assigneeEmail" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
    "responseNote" TEXT,
    "submittedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "returnReason" TEXT,
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "engagementId" UUID,
    "targetType" TEXT,
    "targetId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" UUID,
    "createdById" UUID NOT NULL,
    "dueDate" TIMESTAMP(3),
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" UUID NOT NULL,
    "parentId" UUID,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" UUID NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 1,
    "approverId" UUID NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditTrail" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" UUID NOT NULL,
    "actorId" UUID,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditTrail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Framework" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "description" TEXT,

    CONSTRAINT "Framework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrameworkReference" (
    "id" UUID NOT NULL,
    "frameworkId" UUID NOT NULL,
    "refCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "parentId" UUID,

    CONSTRAINT "FrameworkReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "type" "LibraryItemType" NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" JSONB NOT NULL,
    "industry" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentVersionId" UUID,
    "status" "LibraryStatus" NOT NULL DEFAULT 'DRAFT',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "rating" DECIMAL(3,2),
    "createdById" UUID NOT NULL,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryItemFrameworkRef" (
    "libraryItemId" UUID NOT NULL,
    "referenceId" UUID NOT NULL,

    CONSTRAINT "LibraryItemFrameworkRef_pkey" PRIMARY KEY ("libraryItemId","referenceId")
);

-- CreateTable
CREATE TABLE "ChargeCode" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isBillable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ChargeCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "weekStart" DATE NOT NULL,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'OPEN',
    "totalHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "timesheetId" UUID NOT NULL,
    "engagementId" UUID,
    "chargeCodeId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAvailability" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "AvailabilityType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "hoursPerDay" DECIMAL(4,2) NOT NULL DEFAULT 8,
    "note" TEXT,

    CONSTRAINT "StaffAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiInteraction" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "feature" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" UUID,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER,
    "request" JSONB NOT NULL,
    "response" JSONB NOT NULL,
    "accepted" BOOLEAN,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskSignal" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "url" TEXT,
    "publishedAt" TIMESTAMP(3),
    "relevanceScore" DECIMAL(4,3),
    "status" "RiskSignalStatus" NOT NULL DEFAULT 'NEW',
    "riskId" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataConnector" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ConnectorType" NOT NULL,
    "configEnc" TEXT NOT NULL,
    "schedule" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataConnector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringRule" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "connectorId" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ruleType" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "severity" "FindingSeverity" NOT NULL DEFAULT 'MEDIUM',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoringRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringAlert" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ruleId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "amount" DECIMAL(16,2),
    "status" "MonitoringAlertStatus" NOT NULL DEFAULT 'OPEN',
    "assigneeId" UUID,
    "findingId" UUID,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "MonitoringAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RequestDocuments" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_RequestDocuments_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_FindingEvidence" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_FindingEvidence_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "User_tenantId_status_idx" ON "User"("tenantId", "status");

-- CreateIndex
CREATE INDEX "User_externalId_idx" ON "User"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_tenantId_key_key" ON "Role"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "UserRole_tenantId_userId_idx" ON "UserRole"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_entityId_key" ON "UserRole"("userId", "roleId", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_family_idx" ON "RefreshToken"("family");

-- CreateIndex
CREATE INDEX "AuditEntity_tenantId_type_idx" ON "AuditEntity"("tenantId", "type");

-- CreateIndex
CREATE INDEX "AuditEntity_tenantId_parentId_idx" ON "AuditEntity"("tenantId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEntity_tenantId_code_key" ON "AuditEntity"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Process_tenantId_entityId_idx" ON "Process"("tenantId", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Process_tenantId_code_key" ON "Process"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "RiskCategory_tenantId_code_key" ON "RiskCategory"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringModel_tenantId_name_key" ON "ScoringModel"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Risk_tenantId_rating_idx" ON "Risk"("tenantId", "rating");

-- CreateIndex
CREATE INDEX "Risk_tenantId_entityId_idx" ON "Risk"("tenantId", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Risk_tenantId_code_key" ON "Risk"("tenantId", "code");

-- CreateIndex
CREATE INDEX "RiskAssessment_tenantId_riskId_assessedAt_idx" ON "RiskAssessment"("tenantId", "riskId", "assessedAt");

-- CreateIndex
CREATE INDEX "Control_tenantId_processId_idx" ON "Control"("tenantId", "processId");

-- CreateIndex
CREATE UNIQUE INDEX "Control_tenantId_code_key" ON "Control"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ControlTest_tenantId_controlId_idx" ON "ControlTest"("tenantId", "controlId");

-- CreateIndex
CREATE INDEX "ControlTest_engagementId_idx" ON "ControlTest"("engagementId");

-- CreateIndex
CREATE INDEX "AuditPlan_tenantId_status_idx" ON "AuditPlan"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AuditPlan_tenantId_fiscalYear_version_key" ON "AuditPlan"("tenantId", "fiscalYear", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AuditPlanItem_engagementId_key" ON "AuditPlanItem"("engagementId");

-- CreateIndex
CREATE INDEX "AuditPlanItem_tenantId_planId_idx" ON "AuditPlanItem"("tenantId", "planId");

-- CreateIndex
CREATE INDEX "AuditPlanItem_tenantId_status_idx" ON "AuditPlanItem"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ManagementRequest_tenantId_status_idx" ON "ManagementRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Engagement_tenantId_stage_status_idx" ON "Engagement"("tenantId", "stage", "status");

-- CreateIndex
CREATE INDEX "Engagement_tenantId_entityId_idx" ON "Engagement"("tenantId", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Engagement_tenantId_auditNumber_key" ON "Engagement"("tenantId", "auditNumber");

-- CreateIndex
CREATE INDEX "EngagementMember_tenantId_userId_idx" ON "EngagementMember"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EngagementMember_engagementId_userId_key" ON "EngagementMember"("engagementId", "userId");

-- CreateIndex
CREATE INDEX "EngagementStakeholder_engagementId_idx" ON "EngagementStakeholder"("engagementId");

-- CreateIndex
CREATE INDEX "EngagementMilestone_engagementId_idx" ON "EngagementMilestone"("engagementId");

-- CreateIndex
CREATE INDEX "EngagementStageHistory_engagementId_changedAt_idx" ON "EngagementStageHistory"("engagementId", "changedAt");

-- CreateIndex
CREATE INDEX "AuditProgram_tenantId_engagementId_idx" ON "AuditProgram"("tenantId", "engagementId");

-- CreateIndex
CREATE INDEX "AuditProgramStep_tenantId_programId_idx" ON "AuditProgramStep"("tenantId", "programId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditProgramStep_programId_reference_key" ON "AuditProgramStep"("programId", "reference");

-- CreateIndex
CREATE INDEX "WorkpaperTemplate_tenantId_idx" ON "WorkpaperTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "Workpaper_tenantId_engagementId_status_idx" ON "Workpaper"("tenantId", "engagementId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Workpaper_engagementId_reference_key" ON "Workpaper"("engagementId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "WorkpaperVersion_workpaperId_versionNumber_key" ON "WorkpaperVersion"("workpaperId", "versionNumber");

-- CreateIndex
CREATE INDEX "ReviewNote_tenantId_workpaperId_status_idx" ON "ReviewNote"("tenantId", "workpaperId", "status");

-- CreateIndex
CREATE INDEX "Review_tenantId_targetType_targetId_idx" ON "Review"("tenantId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "Document_tenantId_ownerType_ownerId_idx" ON "Document"("tenantId", "ownerType", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_versionNumber_key" ON "DocumentVersion"("documentId", "versionNumber");

-- CreateIndex
CREATE INDEX "Evidence_tenantId_workpaperId_idx" ON "Evidence"("tenantId", "workpaperId");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_engagementId_reference_key" ON "Evidence"("engagementId", "reference");

-- CreateIndex
CREATE INDEX "Finding_tenantId_status_dueDate_idx" ON "Finding"("tenantId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Finding_tenantId_severity_idx" ON "Finding"("tenantId", "severity");

-- CreateIndex
CREATE INDEX "Finding_tenantId_entityId_idx" ON "Finding"("tenantId", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Finding_engagementId_reference_key" ON "Finding"("engagementId", "reference");

-- CreateIndex
CREATE INDEX "Recommendation_tenantId_findingId_idx" ON "Recommendation"("tenantId", "findingId");

-- CreateIndex
CREATE INDEX "Recommendation_tenantId_status_dueDate_idx" ON "Recommendation"("tenantId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "FindingStatusHistory_findingId_changedAt_idx" ON "FindingStatusHistory"("findingId", "changedAt");

-- CreateIndex
CREATE INDEX "DocumentRequest_tenantId_assigneeId_status_idx" ON "DocumentRequest"("tenantId", "assigneeId", "status");

-- CreateIndex
CREATE INDEX "DocumentRequest_tenantId_dueDate_idx" ON "DocumentRequest"("tenantId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRequest_engagementId_reference_key" ON "DocumentRequest"("engagementId", "reference");

-- CreateIndex
CREATE INDEX "Task_tenantId_assigneeId_status_idx" ON "Task"("tenantId", "assigneeId", "status");

-- CreateIndex
CREATE INDEX "Task_tenantId_engagementId_idx" ON "Task"("tenantId", "engagementId");

-- CreateIndex
CREATE INDEX "Comment_tenantId_targetType_targetId_idx" ON "Comment"("tenantId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "Notification_tenantId_userId_readAt_idx" ON "Notification"("tenantId", "userId", "readAt");

-- CreateIndex
CREATE INDEX "Approval_tenantId_targetType_targetId_idx" ON "Approval"("tenantId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "Approval_tenantId_approverId_status_idx" ON "Approval"("tenantId", "approverId", "status");

-- CreateIndex
CREATE INDEX "AuditTrail_tenantId_targetType_targetId_idx" ON "AuditTrail"("tenantId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditTrail_tenantId_occurredAt_idx" ON "AuditTrail"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditTrail_tenantId_actorId_idx" ON "AuditTrail"("tenantId", "actorId");

-- CreateIndex
CREATE UNIQUE INDEX "Framework_code_key" ON "Framework"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FrameworkReference_frameworkId_refCode_key" ON "FrameworkReference"("frameworkId", "refCode");

-- CreateIndex
CREATE INDEX "LibraryItem_type_status_idx" ON "LibraryItem"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryItem_tenantId_code_version_key" ON "LibraryItem"("tenantId", "code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ChargeCode_tenantId_code_key" ON "ChargeCode"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Timesheet_tenantId_status_idx" ON "Timesheet"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_userId_weekStart_key" ON "Timesheet"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "TimeEntry_tenantId_engagementId_date_idx" ON "TimeEntry"("tenantId", "engagementId", "date");

-- CreateIndex
CREATE INDEX "StaffAvailability_tenantId_userId_startDate_idx" ON "StaffAvailability"("tenantId", "userId", "startDate");

-- CreateIndex
CREATE INDEX "AiInteraction_tenantId_feature_createdAt_idx" ON "AiInteraction"("tenantId", "feature", "createdAt");

-- CreateIndex
CREATE INDEX "RiskSignal_tenantId_status_createdAt_idx" ON "RiskSignal"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DataConnector_tenantId_name_key" ON "DataConnector"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MonitoringRule_tenantId_code_key" ON "MonitoringRule"("tenantId", "code");

-- CreateIndex
CREATE INDEX "MonitoringAlert_tenantId_status_detectedAt_idx" ON "MonitoringAlert"("tenantId", "status", "detectedAt");

-- CreateIndex
CREATE INDEX "_RequestDocuments_B_index" ON "_RequestDocuments"("B");

-- CreateIndex
CREATE INDEX "_FindingEvidence_B_index" ON "_FindingEvidence"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "AuditEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntity" ADD CONSTRAINT "AuditEntity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntity" ADD CONSTRAINT "AuditEntity_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AuditEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntity" ADD CONSTRAINT "AuditEntity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "AuditEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskCategory" ADD CONSTRAINT "RiskCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringModel" ADD CONSTRAINT "ScoringModel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "RiskCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "AuditEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_scoringModelId_fkey" FOREIGN KEY ("scoringModelId") REFERENCES "ScoringModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Control" ADD CONSTRAINT "Control_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Control" ADD CONSTRAINT "Control_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Control" ADD CONSTRAINT "Control_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskControl" ADD CONSTRAINT "RiskControl_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskControl" ADD CONSTRAINT "RiskControl_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskControl" ADD CONSTRAINT "RiskControl_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlTest" ADD CONSTRAINT "ControlTest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlTest" ADD CONSTRAINT "ControlTest_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlTest" ADD CONSTRAINT "ControlTest_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlTest" ADD CONSTRAINT "ControlTest_workpaperId_fkey" FOREIGN KEY ("workpaperId") REFERENCES "Workpaper"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlTest" ADD CONSTRAINT "ControlTest_testedById_fkey" FOREIGN KEY ("testedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditPlan" ADD CONSTRAINT "AuditPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditPlan" ADD CONSTRAINT "AuditPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditPlan" ADD CONSTRAINT "AuditPlan_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditPlanItem" ADD CONSTRAINT "AuditPlanItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditPlanItem" ADD CONSTRAINT "AuditPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AuditPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditPlanItem" ADD CONSTRAINT "AuditPlanItem_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "AuditEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditPlanItem" ADD CONSTRAINT "AuditPlanItem_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditPlanItem" ADD CONSTRAINT "AuditPlanItem_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementRequest" ADD CONSTRAINT "ManagementRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementRequest" ADD CONSTRAINT "ManagementRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementRequest" ADD CONSTRAINT "ManagementRequest_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "AuditEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementRequest" ADD CONSTRAINT "ManagementRequest_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "AuditPlanItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "AuditEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementMember" ADD CONSTRAINT "EngagementMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementMember" ADD CONSTRAINT "EngagementMember_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementMember" ADD CONSTRAINT "EngagementMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementStakeholder" ADD CONSTRAINT "EngagementStakeholder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementStakeholder" ADD CONSTRAINT "EngagementStakeholder_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementStakeholder" ADD CONSTRAINT "EngagementStakeholder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementMilestone" ADD CONSTRAINT "EngagementMilestone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementMilestone" ADD CONSTRAINT "EngagementMilestone_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementStageHistory" ADD CONSTRAINT "EngagementStageHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementStageHistory" ADD CONSTRAINT "EngagementStageHistory_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementStageHistory" ADD CONSTRAINT "EngagementStageHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProgram" ADD CONSTRAINT "AuditProgram_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProgram" ADD CONSTRAINT "AuditProgram_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProgram" ADD CONSTRAINT "AuditProgram_libraryItemId_fkey" FOREIGN KEY ("libraryItemId") REFERENCES "LibraryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProgram" ADD CONSTRAINT "AuditProgram_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProgramStep" ADD CONSTRAINT "AuditProgramStep_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProgramStep" ADD CONSTRAINT "AuditProgramStep_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AuditProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProgramStep" ADD CONSTRAINT "AuditProgramStep_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProgramStep" ADD CONSTRAINT "AuditProgramStep_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProgramStep" ADD CONSTRAINT "AuditProgramStep_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpaperTemplate" ADD CONSTRAINT "WorkpaperTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workpaper" ADD CONSTRAINT "Workpaper_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workpaper" ADD CONSTRAINT "Workpaper_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workpaper" ADD CONSTRAINT "Workpaper_programStepId_fkey" FOREIGN KEY ("programStepId") REFERENCES "AuditProgramStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workpaper" ADD CONSTRAINT "Workpaper_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkpaperTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workpaper" ADD CONSTRAINT "Workpaper_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workpaper" ADD CONSTRAINT "Workpaper_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workpaper" ADD CONSTRAINT "Workpaper_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workpaper" ADD CONSTRAINT "Workpaper_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workpaper" ADD CONSTRAINT "Workpaper_signedOffById_fkey" FOREIGN KEY ("signedOffById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpaperVersion" ADD CONSTRAINT "WorkpaperVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpaperVersion" ADD CONSTRAINT "WorkpaperVersion_workpaperId_fkey" FOREIGN KEY ("workpaperId") REFERENCES "Workpaper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpaperVersion" ADD CONSTRAINT "WorkpaperVersion_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewNote" ADD CONSTRAINT "ReviewNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewNote" ADD CONSTRAINT "ReviewNote_workpaperId_fkey" FOREIGN KEY ("workpaperId") REFERENCES "Workpaper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewNote" ADD CONSTRAINT "ReviewNote_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewNote" ADD CONSTRAINT "ReviewNote_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewNote" ADD CONSTRAINT "ReviewNote_clearedById_fkey" FOREIGN KEY ("clearedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_workpaperId_fkey" FOREIGN KEY ("workpaperId") REFERENCES "Workpaper"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_obtainedById_fkey" FOREIGN KEY ("obtainedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_workpaperId_fkey" FOREIGN KEY ("workpaperId") REFERENCES "Workpaper"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "AuditEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_actionOwnerId_fkey" FOREIGN KEY ("actionOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_repeatOfId_fkey" FOREIGN KEY ("repeatOfId") REFERENCES "Finding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingStatusHistory" ADD CONSTRAINT "FindingStatusHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingStatusHistory" ADD CONSTRAINT "FindingStatusHistory_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingStatusHistory" ADD CONSTRAINT "FindingStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditTrail" ADD CONSTRAINT "AuditTrail_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditTrail" ADD CONSTRAINT "AuditTrail_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrameworkReference" ADD CONSTRAINT "FrameworkReference_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrameworkReference" ADD CONSTRAINT "FrameworkReference_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FrameworkReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryItem" ADD CONSTRAINT "LibraryItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryItem" ADD CONSTRAINT "LibraryItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryItem" ADD CONSTRAINT "LibraryItem_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryItem" ADD CONSTRAINT "LibraryItem_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "LibraryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryItemFrameworkRef" ADD CONSTRAINT "LibraryItemFrameworkRef_libraryItemId_fkey" FOREIGN KEY ("libraryItemId") REFERENCES "LibraryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryItemFrameworkRef" ADD CONSTRAINT "LibraryItemFrameworkRef_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "FrameworkReference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeCode" ADD CONSTRAINT "ChargeCode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_chargeCodeId_fkey" FOREIGN KEY ("chargeCodeId") REFERENCES "ChargeCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAvailability" ADD CONSTRAINT "StaffAvailability_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAvailability" ADD CONSTRAINT "StaffAvailability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInteraction" ADD CONSTRAINT "AiInteraction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInteraction" ADD CONSTRAINT "AiInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskSignal" ADD CONSTRAINT "RiskSignal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskSignal" ADD CONSTRAINT "RiskSignal_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataConnector" ADD CONSTRAINT "DataConnector_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringRule" ADD CONSTRAINT "MonitoringRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringRule" ADD CONSTRAINT "MonitoringRule_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "DataConnector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringAlert" ADD CONSTRAINT "MonitoringAlert_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringAlert" ADD CONSTRAINT "MonitoringAlert_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "MonitoringRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringAlert" ADD CONSTRAINT "MonitoringAlert_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RequestDocuments" ADD CONSTRAINT "_RequestDocuments_A_fkey" FOREIGN KEY ("A") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RequestDocuments" ADD CONSTRAINT "_RequestDocuments_B_fkey" FOREIGN KEY ("B") REFERENCES "DocumentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FindingEvidence" ADD CONSTRAINT "_FindingEvidence_A_fkey" FOREIGN KEY ("A") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FindingEvidence" ADD CONSTRAINT "_FindingEvidence_B_fkey" FOREIGN KEY ("B") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
