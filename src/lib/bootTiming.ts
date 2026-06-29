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

// Microtask-flood detector: count Promise.then calls. If a runaway promise chain starves the timers, this
// number explodes into the millions during the freeze. A normal startup is a few thousand. Distinguishes
// "microtask flood (promise loop)" from "synchronous native block".
export const counters = { thens: 0 };
try {
  const proto = Promise.prototype as unknown as { then: (...a: unknown[]) => unknown };
  const orig = proto.then;
  proto.then = function (this: unknown, ...args: unknown[]) {
    counters.thens++;
    return orig.apply(this, args);
  };
} catch {
  // leave Promise untouched if patching fails
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
