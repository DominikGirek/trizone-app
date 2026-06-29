// Captured the moment this module is first evaluated — i.e. very early in JS startup. Imported first in
// the root _layout. mark() records named checkpoints so the boot diagnostic can show WHICH sub-phase of
// the cold start eats the time (module eval, first render, full-tree render, prefetch, reveal).
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
