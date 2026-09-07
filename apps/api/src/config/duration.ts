const UNITS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

/** Parses `15m`, `30d`, `900s`, `3600` (seconds) into milliseconds. */
export function parseDuration(value: string): number {
  const trimmed = value.trim().toLowerCase();
  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)?$/.exec(trimmed);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2] ?? 's';
  return Math.round(amount * UNITS[unit]);
}
