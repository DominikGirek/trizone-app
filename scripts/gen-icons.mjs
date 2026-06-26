/**
 * TriZone icon + logo generator — the single source of truth for the brand mark.
 *
 * The mark is a centered, upward DOUBLE CHEVRON ("rising / zone") in white on the brand red.
 * Everything (app icon, adaptive icon, splash, favicon, in-app logo) is rendered from the
 * same SVG below via sharp, so the mark is consistent and perfectly centered.
 *
 * Usage: node scripts/gen-icons.mjs
 */
import sharp from 'sharp';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images');
const RED = '#E2231A';

// Two upward chevrons, centered at (512,512) in a 1024 box, with a gap between them.
const chevrons = (stroke) => `
  <path d="M257 482 L512 332 L767 482" fill="none" stroke="${stroke}" stroke-width="132" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M257 692 L512 542 L767 692" fill="none" stroke="${stroke}" stroke-width="132" stroke-linecap="round" stroke-linejoin="round"/>
`;

const GRAD = `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#F6C7C2"/></linearGradient></defs>`;

// Full app icon: red field + gradient mark (iOS applies its own rounded mask).
const iconSvg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">${GRAD}<rect width="1024" height="1024" fill="${RED}"/>${chevrons('url(#g)')}</svg>`;

// Mark only on transparent (foreground / splash / monochrome / in-app logo).
const markSvg = (stroke) =>
  `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">${chevrons(stroke)}</svg>`;

const solidRed = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><rect width="1024" height="1024" fill="${RED}"/></svg>`;

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png();

await Promise.all([
  png(iconSvg, 1024).toFile(resolve(OUT, 'icon.png')),
  png(markSvg('#FFFFFF'), 1024).toFile(resolve(OUT, 'android-icon-foreground.png')),
  png(solidRed, 1024).toFile(resolve(OUT, 'android-icon-background.png')),
  png(markSvg('#FFFFFF'), 1024).toFile(resolve(OUT, 'android-icon-monochrome.png')),
  png(markSvg('#FFFFFF'), 1024).toFile(resolve(OUT, 'splash-icon.png')),
  png(iconSvg, 96).toFile(resolve(OUT, 'favicon.png')),
  // In-app brand mark (white, transparent) used in the header lockup.
  png(markSvg('#FFFFFF'), 256).toFile(resolve(OUT, 'logo-mark.png')),
]);

console.log('Generated icons + logo-mark from the centered double-chevron source → assets/images');
