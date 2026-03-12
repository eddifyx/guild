const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// /guild diamond logo as SVG - matches the login screen geometric symbol
const size = 1024;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0a0a"/>
      <stop offset="100%" stop-color="#111111"/>
    </linearGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff8c00"/>
      <stop offset="100%" stop-color="#ff5500"/>
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="0" stdDeviation="30" flood-color="#ff6b00" flood-opacity="0.5"/>
    </filter>
  </defs>

  <!-- Background circle for rounded icon -->
  <circle cx="512" cy="512" r="512" fill="url(#bg)"/>

  <!-- Outer diamond -->
  <rect x="262" y="262" width="500" height="500" rx="20"
        transform="rotate(45 512 512)"
        fill="none" stroke="rgba(255,107,0,0.5)" stroke-width="12"/>

  <!-- Middle diamond -->
  <rect x="322" y="322" width="380" height="380" rx="16"
        transform="rotate(45 512 512)"
        fill="none" stroke="rgba(255,107,0,0.35)" stroke-width="10"/>

  <!-- Inner diamond (filled) -->
  <rect x="400" y="400" width="224" height="224" rx="10"
        transform="rotate(45 512 512)"
        fill="url(#glow)" filter="url(#shadow)"/>
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

  console.log('Icons generated in client/assets/');
  console.log('  icon.png (1024x1024)');
  console.log('  icon.ico (16,32,48,256)');
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

generate().catch(console.error);
