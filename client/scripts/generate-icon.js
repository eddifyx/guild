const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const logoGeometry = require('../src/branding/logoGeometry.json');

// /guild app icon - keeps the diamond mark dominant and avoids the old
// "dark record" silhouette by using a full rounded-square badge.
const size = 1024;
const markSize = 520;
const markOrigin = (size - markSize) / 2;
const scale = markSize / logoGeometry.baseSize;
const outerStroke = (logoGeometry.outerStroke * scale).toFixed(2);
const middleStroke = (logoGeometry.middleStroke * scale).toFixed(2);
const middleInset = (logoGeometry.middleInset * scale).toFixed(2);
const innerInset = (logoGeometry.innerInset * scale).toFixed(2);
const outerRadius = (5 * scale).toFixed(2);
const middleRadius = (4 * scale).toFixed(2);
const innerRadius = (3 * scale).toFixed(2);
const middleSize = (markSize - middleInset * 2).toFixed(2);
const innerSize = (markSize - innerInset * 2).toFixed(2);
const badgeRadius = 238;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="badge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#061108"/>
      <stop offset="55%" stop-color="#09150b"/>
      <stop offset="100%" stop-color="#122018"/>
    </linearGradient>
    <linearGradient id="core" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#c1ffd3"/>
      <stop offset="55%" stop-color="#74ff7b"/>
      <stop offset="100%" stop-color="#34f85b"/>
    </linearGradient>
    <radialGradient id="fieldGlow" cx="50%" cy="44%" r="62%">
      <stop offset="0%" stop-color="rgba(78,255,112,0.24)"/>
      <stop offset="55%" stop-color="rgba(33,92,44,0.12)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
    <linearGradient id="edgeSheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
      <stop offset="45%" stop-color="rgba(255,255,255,0.04)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.22)"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="32" stdDeviation="40" flood-color="#010301" flood-opacity="0.5"/>
    </filter>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="18" flood-color="#54ff65" flood-opacity="0.34"/>
      <feDropShadow dx="0" dy="0" stdDeviation="42" flood-color="#1f8f35" flood-opacity="0.18"/>
    </filter>
  </defs>

  <rect x="48" y="48" width="928" height="928" rx="${badgeRadius}" fill="url(#badge)" filter="url(#shadow)"/>
  <rect x="48" y="48" width="928" height="928" rx="${badgeRadius}" fill="url(#fieldGlow)"/>
  <rect x="48" y="48" width="928" height="928" rx="${badgeRadius}" fill="none" stroke="url(#edgeSheen)" stroke-width="10"/>
    <rect x="126" y="126" width="772" height="772" rx="180" fill="none" stroke="rgba(92,255,112,0.08)" stroke-width="4"/>

  <!-- Subtle background geometry -->
  <rect x="240" y="240" width="544" height="544" rx="32"
        transform="rotate(45 512 512)"
        fill="none" stroke="rgba(77,255,103,0.07)" stroke-width="16"/>

  <!-- Outer diamond -->
  <rect x="${markOrigin}" y="${markOrigin}" width="${markSize}" height="${markSize}" rx="${outerRadius}"
        transform="rotate(45 512 512)"
        fill="none" stroke="rgba(69,255,86,0.56)" stroke-width="${outerStroke}"/>

  <!-- Middle diamond -->
  <rect x="${(markOrigin + Number(middleInset)).toFixed(2)}" y="${(markOrigin + Number(middleInset)).toFixed(2)}" width="${middleSize}" height="${middleSize}" rx="${middleRadius}"
        transform="rotate(45 512 512)"
        fill="none" stroke="rgba(104,255,118,0.78)" stroke-width="${middleStroke}"/>

  <!-- Inner diamond (filled) -->
  <rect x="${(markOrigin + Number(innerInset)).toFixed(2)}" y="${(markOrigin + Number(innerInset)).toFixed(2)}" width="${innerSize}" height="${innerSize}" rx="${innerRadius}"
        transform="rotate(45 512 512)"
        fill="url(#core)" filter="url(#glow)"/>
</svg>`;

async function generate() {
  const outDir = path.join(__dirname, '..', 'assets');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // Generate PNGs at various sizes
  const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];
  const pngBuffers = {};

  for (const s of sizes) {
    const buf = await sharp(Buffer.from(svg)).resize(s, s).png().toBuffer();
    pngBuffers[s] = buf;
    await sharp(buf).toFile(path.join(outDir, `icon-${s}.png`));
  }

  // Save the main 1024px PNG
  await sharp(Buffer.from(svg)).resize(1024, 1024).png().toFile(path.join(outDir, 'icon.png'));

  // Generate ICO file (Windows) - contains 16, 32, 48, 256 px
  const icoSizes = [16, 32, 48, 256];
  const icoPngs = [];
  for (const s of icoSizes) {
    icoPngs.push({ size: s, buffer: pngBuffers[s] });
  }
  const icoBuffer = createIco(icoPngs);
  fs.writeFileSync(path.join(outDir, 'icon.ico'), icoBuffer);

  generateIcns(outDir);

  console.log('Icons generated in client/assets/');
  console.log('  icon.png (1024x1024)');
  console.log('  icon.ico (16,32,48,256)');
  console.log('  icon.icns');
  console.log('  icon-{size}.png for each size');
}

// Minimal ICO file creator from PNG buffers
function createIco(entries) {
  const headerSize = 6;
  const dirEntrySize = 16;
  let dataOffset = headerSize + dirEntrySize * entries.length;

  const parts = [];

  // ICO header
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);      // reserved
  header.writeUInt16LE(1, 2);      // type: 1 = ICO
  header.writeUInt16LE(entries.length, 4);
  parts.push(header);

  // Directory entries
  const dataBuffers = [];
  for (const entry of entries) {
    const dir = Buffer.alloc(dirEntrySize);
    dir.writeUInt8(entry.size >= 256 ? 0 : entry.size, 0);   // width (0 = 256)
    dir.writeUInt8(entry.size >= 256 ? 0 : entry.size, 1);   // height
    dir.writeUInt8(0, 2);          // color palette
    dir.writeUInt8(0, 3);          // reserved
    dir.writeUInt16LE(1, 4);       // color planes
    dir.writeUInt16LE(32, 6);      // bits per pixel
    dir.writeUInt32LE(entry.buffer.length, 8);   // data size
    dir.writeUInt32LE(dataOffset, 12);           // data offset
    parts.push(dir);
    dataBuffers.push(entry.buffer);
    dataOffset += entry.buffer.length;
  }

  // Image data
  for (const buf of dataBuffers) {
    parts.push(buf);
  }

  return Buffer.concat(parts);
}

function generateIcns(outDir) {
  try {
    const iconsetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guild-iconset-'));
    const iconsetDir = path.join(iconsetRoot, 'guild.iconset');
    fs.mkdirSync(iconsetDir);
    const masterPng = path.join(outDir, 'icon.png');
    const variants = [
      ['icon_16x16.png', 16],
      ['icon_16x16@2x.png', 32],
      ['icon_32x32.png', 32],
      ['icon_32x32@2x.png', 64],
      ['icon_128x128.png', 128],
      ['icon_128x128@2x.png', 256],
      ['icon_256x256.png', 256],
      ['icon_256x256@2x.png', 512],
      ['icon_512x512.png', 512],
      ['icon_512x512@2x.png', 1024],
    ];

    for (const [targetName, targetSize] of variants) {
      execFileSync('sips', ['-z', String(targetSize), String(targetSize), masterPng, '--out', path.join(iconsetDir, targetName)], {
        stdio: 'ignore',
      });
    }

    execFileSync('xattr', ['-cr', iconsetDir], { stdio: 'ignore' });
    execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', path.join(outDir, 'icon.icns')]);
    fs.rmSync(iconsetRoot, { recursive: true, force: true });
  } catch (error) {
    console.warn('Skipping icon.icns generation:', error.message);
  }
}

generate().catch(console.error);
