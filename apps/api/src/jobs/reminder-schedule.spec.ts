import { reminderDecision } from './reminder-schedule';

const NOW = new Date('2026-09-03T06:00:00Z');
const daysFromNow = (d: number) => new Date(NOW.getTime() + d * 86_400_000);

describe('reminderDecision', () => {
  it('reminds 14, 7 and 1 day(s) before the due date', () => {
    for (const d of [14, 7, 1]) {
      const r = reminderDecision(daysFromNow(d), null, NOW);
      expect(r).toMatchObject({ remind: true, reason: 'before_due', daysUntilDue: d, escalationLevel: 0 });
    }
  });

  it('stays quiet on other days before the due date', () => {
    for (const d of [30, 10, 5, 2]) expect(reminderDecision(daysFromNow(d), null, NOW).remind).toBe(false);
  });

  it('does not repeat a before-due reminder on the same day', () => {
    expect(reminderDecision(daysFromNow(7), new Date(NOW.getTime() - 3600_000), NOW).remind).toBe(false);
  });

  it('reminds immediately when overdue and never reminded, with escalation', () => {
    expect(reminderDecision(daysFromNow(-3), null, NOW)).toMatchObject({ remind: true, reason: 'overdue', daysOverdue: 3, escalationLevel: 1 });
    expect(reminderDecision(daysFromNow(-20), null, NOW).escalationLevel).toBe(2);
    expect(reminderDecision(daysFromNow(-60), null, NOW).escalationLevel).toBe(3);
  });

  it('repeats overdue reminders every 7 days only', () => {
    expect(reminderDecision(daysFromNow(-10), daysFromNow(-3), NOW).remind).toBe(false);
    expect(reminderDecision(daysFromNow(-10), daysFromNow(-7), NOW).remind).toBe(true);
    expect(reminderDecision(daysFromNow(-10), daysFromNow(-8), NOW).remind).toBe(true);
  });

  it('reminds on the due day itself once', () => {
    expect(reminderDecision(NOW, null, NOW)).toMatchObject({ remind: true, daysUntilDue: 0, daysOverdue: 0, escalationLevel: 0 });
    expect(reminderDecision(NOW, NOW, NOW).remind).toBe(false);
  });
});
