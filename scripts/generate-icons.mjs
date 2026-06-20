// Generates TriZone app icons/splash from inline SVG using sharp.
// Run: node scripts/generate-icons.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, '..', 'assets', 'images');

const BRAND = '#E2231A';

// Three ascending chevrons = motion / swim·bike·run.
function chevrons({ apexYs, halfW, drop, strokeW, color, cx = 512 }) {
  return apexYs
    .map(
      (y) =>
        `<path d="M ${cx - halfW} ${y + drop} L ${cx} ${y} L ${cx + halfW} ${y + drop}" ` +
        `fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('');
}

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${BRAND}"/>
  ${chevrons({ apexYs: [368, 500, 632], halfW: 215, drop: 150, strokeW: 104, color: '#ffffff' })}
</svg>`;

// Transparent mark centered in the adaptive-icon safe zone.
const markSvg = (color) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${chevrons({ apexYs: [332, 452, 572], halfW: 175, drop: 120, strokeW: 92, color })}
</svg>`;

const tasks = [
  { svg: iconSvg, file: 'icon.png', size: 1024 },
  { svg: iconSvg, file: 'favicon.png', size: 96 },
  { svg: markSvg('#ffffff'), file: 'splash-icon.png', size: 1024 },
  { svg: markSvg('#ffffff'), file: 'android-icon-foreground.png', size: 1024 },
  { svg: markSvg('#ffffff'), file: 'android-icon-monochrome.png', size: 1024 },
];

for (const { svg, file, size } of tasks) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(out, file));
  console.log('wrote', file, `(${size}px)`);
}

// Solid brand background for the Android adaptive icon.
await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: BRAND },
})
  .png()
  .toFile(join(out, 'android-icon-background.png'));
console.log('wrote android-icon-background.png (brand fill)');
