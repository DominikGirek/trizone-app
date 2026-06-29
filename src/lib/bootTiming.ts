// Captured the moment this module is first evaluated — i.e. very early in JS startup. Imported first in
// the root _layout so the delta from here to "app visible" measures the JS phase. If the user perceives a
// long freeze but this delta is small, the time is being spent in the NATIVE phase (before JS runs).
export const BOOT_T0 = Date.now();

export function sinceBoot(): number {
  return Date.now() - BOOT_T0;
}
