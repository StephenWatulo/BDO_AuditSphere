import * as React from 'react';
import { STAGE_LABELS, type EngagementStage } from '@auditsphere/shared';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { humanize } from '@/lib/utils';
import {
  CONTROL_EFFECTIVENESS_LABELS,
  FINDING_STATUS_LABELS,
  LIBRARY_STATUS_LABELS,
  PLAN_STATUS_LABELS,
  REQUEST_STATUS_LABELS,
  WORKPAPER_STATUS_LABELS,
  labelFor,
} from '@/lib/labels';
import type { AgeingBucket, ControlEffectiveness, Severity } from '@/lib/types';

type Tone = NonNullable<BadgeProps['variant']>;

export function SeverityBadge({ severity, className }: { severity?: Severity | string | null; className?: string }) {
  const tones: Record<string, Tone> = { LOW: 'success', MEDIUM: 'warning', HIGH: 'danger', CRITICAL: 'danger' };
  if (!severity) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant={tones[severity] ?? 'muted'} dot className={className}>
      {severity === 'CRITICAL' ? 'Critical' : humanize(severity)}
    </Badge>
  );
}

export const RatingBadge = SeverityBadge;

export function StageBadge({ stage, className }: { stage?: EngagementStage | string | null; className?: string }) {
  const tones: Record<string, Tone> = {
    PLANNING: 'info',
    RISK_ASSESSMENT: 'info',
    PROGRAMME: 'info',
    FIELDWORK: 'warning',
    REVIEW: 'warning',
    REPORTING: 'accent',
    FOLLOW_UP: 'accent',
    CLOSED: 'muted',
  };
  if (!stage) return null;
  return (
    <Badge variant={tones[stage] ?? 'secondary'} className={className}>
      {STAGE_LABELS[stage as EngagementStage] ?? humanize(stage)}
    </Badge>
  );
}

export function FindingStatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const tones: Record<string, Tone> = {
    DRAFT: 'muted',
    MANAGEMENT_REVIEW: 'info',
    AGREED: 'accent',
    IMPLEMENTATION: 'warning',
    VALIDATION: 'warning',
    CLOSED: 'success',
    RISK_ACCEPTED: 'secondary',
  };
  if (!status) return null;
  return (
    <Badge variant={tones[status] ?? 'secondary'} className={className}>
      {labelFor(FINDING_STATUS_LABELS, status)}
    </Badge>
  );
}

export function WorkpaperStatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const tones: Record<string, Tone> = {
    DRAFT: 'muted',
    PREPARED: 'info',
    IN_REVIEW: 'warning',
    REVIEW_NOTES_OPEN: 'danger',
    REVIEWED: 'accent',
    SIGNED_OFF: 'success',
  };
  if (!status) return null;
  return (
    <Badge variant={tones[status] ?? 'secondary'} className={className}>
      {labelFor(WORKPAPER_STATUS_LABELS, status)}
    </Badge>
  );
}

export function RequestStatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const tones: Record<string, Tone> = {
    OPEN: 'info',
    SUBMITTED: 'warning',
    ACCEPTED: 'success',
    RETURNED: 'danger',
    CANCELLED: 'muted',
  };
  if (!status) return null;
  return (
    <Badge variant={tones[status] ?? 'secondary'} className={className}>
      {labelFor(REQUEST_STATUS_LABELS, status)}
    </Badge>
  );
}

export function PlanStatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const tones: Record<string, Tone> = {
    DRAFT: 'muted',
    PENDING_APPROVAL: 'warning',
    APPROVED: 'info',
    ACTIVE: 'success',
    ARCHIVED: 'secondary',
  };
  if (!status) return null;
  return (
    <Badge variant={tones[status] ?? 'secondary'} className={className}>
      {labelFor(PLAN_STATUS_LABELS, status)}
    </Badge>
  );
}

export function LibraryStatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const tones: Record<string, Tone> = {
    DRAFT: 'muted',
    PENDING_APPROVAL: 'warning',
    PUBLISHED: 'success',
    RETIRED: 'secondary',
  };
  if (!status) return null;
  return (
    <Badge variant={tones[status] ?? 'secondary'} className={className}>
      {labelFor(LIBRARY_STATUS_LABELS, status)}
    </Badge>
  );
}

export function EffectivenessBadge({ value, className }: { value?: ControlEffectiveness | null; className?: string }) {
  const tones: Record<string, Tone> = {
    NOT_TESTED: 'muted',
    EFFECTIVE: 'success',
    PARTIALLY_EFFECTIVE: 'warning',
    INEFFECTIVE: 'danger',
  };
  if (!value) return null;
  return (
    <Badge variant={tones[value] ?? 'secondary'} className={className}>
      {labelFor(CONTROL_EFFECTIVENESS_LABELS, value)}
    </Badge>
  );
}

export function AgeingBadge({ bucket, className }: { bucket?: AgeingBucket | string | null; className?: string }) {
  if (!bucket) return null;
  const tones: Record<string, Tone> = {
    NOT_DUE: 'muted',
    '1-30': 'warning',
    '31-60': 'warning',
    '61-90': 'danger',
    '91-180': 'danger',
    '180+': 'danger',
  };
  return (
    <Badge variant={tones[bucket] ?? 'secondary'} className={className}>
      {bucket === 'NOT_DUE' ? 'Not due' : `${bucket} days`}
    </Badge>
  );
}

/** Generic status badge for enums we do not colour specifically. */
export function GenericStatusBadge({
  value,
  labels,
  tone = 'secondary',
  className,
}: {
  value?: string | null;
  labels?: Record<string, string>;
  tone?: Tone;
  className?: string;
}) {
  if (!value) return null;
  return (
    <Badge variant={tone} className={className}>
      {labels?.[value] ?? humanize(value)}
    </Badge>
  );
}
