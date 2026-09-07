export const AGEING_BUCKETS = ['NOT_DUE', '1-30', '31-60', '61-90', '91-180', '180+'] as const;
export type AgeingBucket = (typeof AGEING_BUCKETS)[number];

export function ageingBucket(
  dueDate: Date | string | null | undefined,
  now = new Date(),
): AgeingBucket {
  if (!dueDate) return 'NOT_DUE';
  const due = new Date(dueDate);
  const days = Math.floor((now.getTime() - due.getTime()) / 86_400_000);
  if (days <= 0) return 'NOT_DUE';
  if (days <= 30) return '1-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  if (days <= 180) return '91-180';
  return '180+';
}

export function daysOverdue(dueDate: Date | string | null | undefined, now = new Date()): number {
  if (!dueDate) return 0;
  const days = Math.floor((now.getTime() - new Date(dueDate).getTime()) / 86_400_000);
  return days > 0 ? days : 0;
}

/** Escalation ladder for overdue actions: 0 owner, 1 line manager, 2 CAE, 3 audit committee. */
export function escalationLevel(daysOverdueCount: number): number {
  if (daysOverdueCount <= 0) return 0;
  if (daysOverdueCount <= 14) return 1;
  if (daysOverdueCount <= 45) return 2;
  return 3;
}

/** Reminder cadence: days before due date at which reminders fire, then every N days after. */
export const REMINDER_SCHEDULE = { beforeDueDays: [14, 7, 1], afterDueEveryDays: 7 } as const;
