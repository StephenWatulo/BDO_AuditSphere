import { daysOverdue, escalationLevel, REMINDER_SCHEDULE } from '@auditsphere/shared';
import { startOfUtcDay } from '../common/utils';

export interface ReminderDecision {
  remind: boolean;
  daysUntilDue: number;
  daysOverdue: number;
  escalationLevel: number;
  reason: 'before_due' | 'overdue' | 'none';
}

/**
 * Decides whether an item with `dueDate` should be reminded about today.
 * Before the due date reminders fire on the configured days (14, 7, 1) at most
 * once per day; after the due date they repeat every N days, escalating.
 */
export function reminderDecision(dueDate: Date, lastReminderAt: Date | null, now = new Date()): ReminderDecision {
  const today = startOfUtcDay(now);
  const due = startOfUtcDay(dueDate);
  const daysUntilDue = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const overdueDays = daysOverdue(dueDate, now);
  const level = escalationLevel(overdueDays);
  const remindedToday = lastReminderAt ? startOfUtcDay(lastReminderAt).getTime() === today.getTime() : false;

  if (daysUntilDue > 0) {
    const scheduled = (REMINDER_SCHEDULE.beforeDueDays as readonly number[]).includes(daysUntilDue);
    return { remind: scheduled && !remindedToday, daysUntilDue, daysOverdue: 0, escalationLevel: 0, reason: scheduled ? 'before_due' : 'none' };
  }
  const sinceLast = lastReminderAt ? Math.floor((now.getTime() - lastReminderAt.getTime()) / 86_400_000) : Infinity;
  const dueNow = sinceLast >= REMINDER_SCHEDULE.afterDueEveryDays || (daysUntilDue === 0 && !remindedToday);
  return { remind: dueNow && !remindedToday, daysUntilDue, daysOverdue: overdueDays, escalationLevel: level, reason: 'overdue' };
}
