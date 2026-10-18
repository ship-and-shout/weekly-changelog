// Weeks run Saturday → Friday, UTC — the same boundary Ship & Shout uses, so a
// changelog entry and a Ship & Shout post about the same week always agree.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86_400_000;

export interface Week {
  /** First day, YYYY-MM-DD (Saturday). */
  start: string;
  /** Last day, YYYY-MM-DD (Friday). */
  end: string;
  /** Inclusive lower bound, ISO timestamp. */
  since: string;
  /** Exclusive upper bound, ISO timestamp (start + 7 days). */
  until: string;
  /** "Sep 19–25" or "Sep 26 – Oct 2". */
  label: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The Saturday (UTC) of the week holding `date`. */
export function weekStartISO(date: Date): string {
  const back = (date.getUTCDay() + 1) % 7; // Sat → 0, Sun → 1, … Fri → 6
  return iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - back * DAY));
}

export function weekLabel(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  const sm = MONTHS[s.getUTCMonth()];
  const em = MONTHS[e.getUTCMonth()];
  return sm === em ? `${sm} ${s.getUTCDate()}–${e.getUTCDate()}` : `${sm} ${s.getUTCDate()} – ${em} ${e.getUTCDate()}`;
}

/** The Sat→Fri week holding `instant`. */
export function weekContaining(instant: Date): Week {
  const start = weekStartISO(instant);
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const end = iso(new Date(s + 6 * DAY));
  return { start, end, since: `${start}T00:00:00.000Z`, until: new Date(s + 7 * DAY).toISOString(), label: weekLabel(start, end) };
}

/** The most recent COMPLETED week as of `now` (never the week in progress). */
export function lastCompletedWeek(now: Date): Week {
  return weekContaining(new Date(now.getTime() - 7 * DAY));
}

/** Parse the `week` input: any YYYY-MM-DD inside the wanted week. */
export function parseWeekInput(value: string): Week | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || iso(d) !== value ? null : weekContaining(d);
}
