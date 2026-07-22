/**
 * Tobi · overdue — the anti-silent-failure net. Tobi knows each registry race's expected date; if a race
 * is well past it with STILL no result, that's not "nothing to do" — it's a signal (missing/wrong PTO slug,
 * PTO didn't publish, a source is needed). Turn it into a visible `robot_runs` alarm instead of a silent miss.
 *
 * Pure helpers — the caller supplies `now`. No network, no clock of their own.
 */

/** Hours since the END of the race day (UTC), or -1 if no/invalid date. A race is "done" by day's end. */
export function overdueHours(dateIso, now) {
  if (!dateIso) return -1;
  const end = Date.parse(`${dateIso}T23:59:59Z`);
  return Number.isNaN(end) ? -1 : (now - end) / 3_600_000;
}

/** True once `hours` have passed since the race day ended (default 36h — gives PTO time to publish). */
export function isOverdue(dateIso, now, hours = 36) {
  return overdueHours(dateIso, now) >= hours;
}

/**
 * Are two robot_runs the SAME state? Used to de-duplicate the log so a persistent condition (overdue,
 * incomplete, staged-stable) writes ONE row, not one per hourly run — and so the stability gate measures
 * "≥45 min" from the FIRST sighting, not the latest.
 */
export function sameRun(a, b) {
  if (!a || !b) return false;
  const eq = (x = [], y = []) => x.length === y.length && x.every((v, i) => v === y[i]);
  return a.status === b.status && (a.note ?? '') === (b.note ?? '') && eq(a.men, b.men) && eq(a.women, b.women);
}
