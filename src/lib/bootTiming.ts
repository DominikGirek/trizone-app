// Captured the moment this module is first evaluated — i.e. very early in JS startup. Imported first in
// the root _layout. mark() records named checkpoints; the block detector records any long JS-thread freeze.
export const BOOT_T0 = Date.now();

export const bootMarks: [string, number][] = [];

export function mark(label: string): void {
  bootMarks.push([label, Date.now() - BOOT_T0]);
}

export function sinceBoot(): number {
  return Date.now() - BOOT_T0;
}

export function bootSummary(): string {
  return bootMarks.map(([l, ms]) => `${l}: ${ms}`).join('\n');
}

// Block detector: a 300ms self-rescheduling timer. If it fires much later than scheduled, the JS thread was
// blocked in between (a synchronous freeze). Record the gap + when it ended, so the boot diagnostic shows
// exactly when the cold-start freeze happens — independent of any UI code.
let lastTick = BOOT_T0;
function tick() {
  const now = Date.now();
  const drift = now - lastTick - 300;
  if (drift > 600) bootMarks.push([`⚠️BLOCK ${drift}ms`, now - BOOT_T0]);
  lastTick = now;
  setTimeout(tick, 300);
}
setTimeout(tick, 300);
