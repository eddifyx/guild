const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const WIDTH = 700;
const HEIGHT = 460;
const SCALE = 2;

function buildSvg(width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#070b08"/>
        <stop offset="55%" stop-color="#0b1410"/>
        <stop offset="100%" stop-color="#141d18"/>
      </linearGradient>
      <radialGradient id="glowLeft" cx="22%" cy="34%" r="56%">
        <stop offset="0%" stop-color="rgba(67,255,99,0.10)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
      </radialGradient>
      <radialGradient id="glowRight" cx="78%" cy="68%" r="52%">
        <stop offset="0%" stop-color="rgba(45,135,62,0.08)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
      </radialGradient>
    </defs>

    <rect width="${width}" height="${height}" rx="18" fill="url(#bg)"/>
    <rect width="${width}" height="${height}" rx="18" fill="url(#glowLeft)"/>
    <rect width="${width}" height="${height}" rx="18" fill="url(#glowRight)"/>
    <rect x="14" y="14" width="${width - 28}" height="${height - 28}" rx="14" fill="none" stroke="rgba(112,255,128,0.10)" stroke-width="1"/>
  </svg>`;
}

async function generate() {
  const outDir = path.join(__dirname, '..', 'assets');
  fs.mkdirSync(outDir, { recursive: true });

  const baseSvg = buildSvg(WIDTH, HEIGHT);
  const retinaSvg = buildSvg(WIDTH * SCALE, HEIGHT * SCALE);

  await sharp(Buffer.from(baseSvg)).png().toFile(path.join(outDir, 'dmg-background.png'));
  await sharp(Buffer.from(retinaSvg)).png().toFile(path.join(outDir, 'dmg-background@2x.png'));

  console.log('DMG backgrounds generated in client/assets/');
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
