export interface AuditSearchFilters { terms: string[]; from?: string; to?: string; exceptionsOnly: boolean; controlsOnly: boolean }

// Supported filters are explicit and bounded; no model-generated SQL is executed.
export function interpretAuditSearch(prompt: string, now = new Date()): AuditSearchFilters {
  const lower = prompt.toLowerCase();
  const exceptionsOnly = /\bexceptions?\b|\bfailed\b|\bfailures?\b/.test(lower) && !/\bwithout exceptions\b|\bno exceptions\b/.test(lower);
  let from: string | undefined;
  let to: string | undefined;
  if (/\blast (?:year|12 months)\b|\bpast year\b/.test(lower)) {
    const start = new Date(now); start.setUTCFullYear(start.getUTCFullYear() - 1);
    from = start.toISOString(); to = now.toISOString();
  } else {
    const year = lower.match(/\b(20\d{2})\b/);
    if (year) { from = `${year[1]}-01-01T00:00:00.000Z`; to = `${Number(year[1]) + 1}-01-01T00:00:00.000Z`; }
  }
  const stop = new Set('show me all the a an of in on with without and or for from which who what where when had have has were was are is to find search please tested tests test last past year months month controls control engagements engagement workpapers workpaper findings finding evidence documents document comments comment exceptions exception failed failures risk risks approval'.split(' '));
  // Approval remains a meaningful term for supplier/transaction questions.
  if (!/\bcontrols?\b/.test(lower)) stop.delete('approval');
  const terms = Array.from(new Set((lower.match(/[a-z0-9][a-z0-9-]*/g) ?? []).filter((t) => !stop.has(t) && !/^\d+$/.test(t)).map((t) => t === 'procurement' ? 'procur' : t === 'suppliers' ? 'supplier' : t))).slice(0, 6);
  return { terms, from, to, exceptionsOnly, controlsOnly: /\bcontrols?\b/.test(lower) };
}
