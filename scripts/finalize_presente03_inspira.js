const fs = require('fs');
const sharp = require('sharp');

const INDEX_PATH = 'index.html';

function isPink(r, g, b) {
  return r >= 205 && g >= 105 && b >= 105 && r >= g + 25 && r >= b + 20;
}

async function pinkRatio(input) {
  const { data, info } = await sharp(input)
    .resize(100, 40, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let pink = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (isPink(data[i], data[i + 1], data[i + 2])) pink++;
  }
  return pink / (info.width * info.height);
}

async function sampleColor(input, left, top, width, height) {
  const { data } = await sharp(input)
    .extract({
      left: Math.max(0, left),
      top: Math.max(0, top),
      width: Math.max(1, width),
      height: Math.max(1, height)
    })
    .resize(1, 1)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return `rgb(${data[0] || 247},${data[1] || 170},${data[2] || 165})`;
}

function makeSvgPatch(width, height, bg, text, fontSize, weight = 700, textColor = '#7b1616') {
  const rx = Math.max(2, Math.round(height * 0.28));
  return Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="0" y="0" width="${width}" height="${height}" rx="${rx}" fill="${bg}"/>
    <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle"
      font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="${textColor}">${text}</text>
  </svg>`);
}

async function patchIsolated(input, width, height) {
  const sx = width / 500;
  const sy = height / 200;

  const badgeBox = {
    left: Math.round(325 * sx),
    top: Math.round(24 * sy),
    width: Math.round(92 * sx),
    height: Math.round(23 * sy)
  };
  const bodyBox = {
    left: Math.round(226 * sx),
    top: Math.round(127 * sy),
    width: Math.round(91 * sx),
    height: Math.round(17 * sy)
  };

  const badgeBg = await sampleColor(input,
    badgeBox.left + Math.round(8 * sx),
    badgeBox.top + Math.round(5 * sy),
    Math.max(1, Math.round(4 * sx)),
    Math.max(1, Math.round(4 * sy))
  );
  const bodyBg = await sampleColor(input,
    bodyBox.left,
    bodyBox.top,
    Math.max(1, Math.round(4 * sx)),
    Math.max(1, Math.round(4 * sy))
  );

  const badgePatch = makeSvgPatch(
    badgeBox.width,
    badgeBox.height,
    badgeBg,
    'PROJETO INSPIRA',
    Math.max(8, Math.round(7.4 * sy)),
    700
  );
  const bodyPatch = makeSvgPatch(
    bodyBox.width,
    bodyBox.height,
    bodyBg,
    'INSPIRA',
    Math.max(8, Math.round(8.2 * sy)),
    500,
    '#1a1a1a'
  );

  return sharp(input)
    .composite([
      { input: badgePatch, left: badgeBox.left, top: badgeBox.top },
      { input: bodyPatch, left: bodyBox.left, top: bodyBox.top }
    ])
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
}

async function findBottomPinkCard(input, width, height) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const rowCounts = new Int32Array(height);
  const startY = Math.floor(height * 0.55);

  for (let y = startY; y < height; y++) {
    let count = 0;
    let p = (y * width) * channels;
    for (let x = 0; x < width; x++, p += channels) {
      if (isPink(data[p], data[p + 1], data[p + 2])) count++;
    }
    rowCounts[y] = count;
  }

  const rowThreshold = Math.floor(width * 0.28);
  const ys = [];
  for (let y = startY; y < height; y++) if (rowCounts[y] >= rowThreshold) ys.push(y);
  if (!ys.length) return null;

  let y0 = ys[0], y1 = ys[ys.length - 1];
  const colCounts = new Int32Array(width);
  for (let y = y0; y <= y1; y++) {
    let p = (y * width) * channels;
    for (let x = 0; x < width; x++, p += channels) {
      if (isPink(data[p], data[p + 1], data[p + 2])) colCounts[x]++;
    }
  }

  const cardH = y1 - y0 + 1;
  const colThreshold = Math.floor(cardH * 0.42);
  const xs = [];
  for (let x = 0; x < width; x++) if (colCounts[x] >= colThreshold) xs.push(x);
  if (!xs.length) return null;

  let x0 = xs[0], x1 = xs[xs.length - 1];
  const denseThreshold = Math.floor(cardH * 0.60);
  const dense = [];
  for (let x = x0; x <= x1; x++) if (colCounts[x] >= denseThreshold) dense.push(x);
  if (dense.length > 20) {
    x0 = dense[0];
    x1 = dense[dense.length - 1];
  }

  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

async function patchFullStack(input, width, height) {
  let box = await findBottomPinkCard(input, width, height);
  if (!box || box.w < width * 0.45 || box.h < height * 0.12) {
    box = {
      x: Math.round(width * 0.108),
      y: Math.round(height * 0.675),
      w: Math.round(width * 0.752),
      h: Math.round(height * 0.250)
    };
  }

  const sx = box.w / 77;
  const sy = box.h / 31;

  const badgeBox = {
    left: Math.round(box.x + 53.8 * sx),
    top: Math.round(box.y + 3.1 * sy),
    width: Math.round(17.2 * sx),
    height: Math.round(4.2 * sy)
  };
  const bodyBox = {
    left: Math.round(box.x + 34.7 * sx),
    top: Math.round(box.y + 23.6 * sy),
    width: Math.round(16.8 * sx),
    height: Math.round(3.2 * sy)
  };

  const badgeBg = await sampleColor(input,
    badgeBox.left + Math.max(1, Math.round(2 * sx)),
    badgeBox.top + Math.max(1, Math.round(1 * sy)),
    Math.max(1, Math.round(1 * sx)),
    Math.max(1, Math.round(1 * sy))
  );
  const bodyBg = await sampleColor(input,
    bodyBox.left,
    bodyBox.top,
    Math.max(1, Math.round(1 * sx)),
    Math.max(1, Math.round(1 * sy))
  );

  const badgePatch = makeSvgPatch(
    badgeBox.width,
    badgeBox.height,
    badgeBg,
    'PROJETO INSPIRA',
    Math.max(8, Math.round(0.75 * sy)),
    700
  );
  const bodyPatch = makeSvgPatch(
    bodyBox.width,
    bodyBox.height,
    bodyBg,
    'INSPIRA',
    Math.max(8, Math.round(0.82 * sy)),
    500,
    '#1a1a1a'
  );

  const output = await sharp(input)
    .composite([
      { input: badgePatch, left: badgeBox.left, top: badgeBox.top },
      { input: bodyPatch, left: bodyBox.left, top: bodyBox.top }
    ])
    .webp({ lossless: true, effort: 6 })
    .toBuffer();

  console.log(`[INSPIRA] Hero 1122x1402 corrigido em x=${box.x}, y=${box.y}, w=${box.w}, h=${box.h}.`);
  return output;
}

async function main() {
  if (!fs.existsSync(INDEX_PATH)) throw new Error(`Arquivo ${INDEX_PATH} não encontrado.`);
  let html = fs.readFileSync(INDEX_PATH, 'utf8');

  const re = /data:image\/([^;,]+)(?:;[^,]*)*;base64,([A-Za-z0-9+/=]+)/gi;
  const matches = [...html.matchAll(re)];
  if (!matches.length) throw new Error('Nenhuma imagem embutida em base64 foi encontrada no index.html.');

  const infos = [];
  for (const m of matches) {
    try {
      const input = Buffer.from(m[2], 'base64');
      const meta = await sharp(input).metadata();
      if (!meta.width || !meta.height) continue;
      infos.push({ match: m, input, width: meta.width, height: meta.height });
    } catch (_) {}
  }

  const wide = [];
  for (const item of infos) {
    const aspect = item.width / item.height;
    if (item.width >= 300 && item.height >= 100 && item.height <= 600 && aspect >= 2.15 && aspect <= 2.9) {
      wide.push({ ...item, pink: await pinkRatio(item.input) });
    }
  }
  wide.sort((a, b) => b.pink - a.pink);

  if (wide.length && wide[0].pink > 0.22) {
    const item = wide[0];
    const output = await patchIsolated(item.input, item.width, item.height);
    html = html.replace(item.match[0], `data:image/webp;base64,${output.toString('base64')}`);
    console.log(`[INSPIRA] Card isolado corrigido e preservado nítido: ${item.width}x${item.height}.`);
  }

  const stack = infos.find(item => item.width === 1122 && item.height === 1402);
  if (stack) {
    const output = await patchFullStack(stack.input, stack.width, stack.height);
    html = html.replace(stack.match[0], `data:image/webp;base64,${output.toString('base64')}`);
  }

  fs.writeFileSync(INDEX_PATH, html, 'utf8');
  console.log('[INSPIRA] Correção concluída: PROJETO INSPIRA + Comunidade INSPIRA, sem recompressão com perda.');
}

main().catch((err) => {
  console.error('[INSPIRA] Falha na correção final:', err);
  process.exit(1);
});
