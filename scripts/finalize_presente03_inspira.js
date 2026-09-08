const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');

const INDEX_PATH = 'index.html';
const REVIEW_BEFORE = 'presente03-review-before.webp';
const REVIEW_FINAL = 'presente03-review-final.webp';
const PARTS = Array.from({ length: 14 }, (_, i) =>
  `assets/presente03-approved/part${String(i + 1).padStart(2, '0')}.b64`
);
const EXPECTED_B64_LENGTH = 47428;
const EXPECTED_SHA256 = '99be72ae0fd5a81896e9d9e96fbb43c71b14fedd24689020c7ed6c1b3bd03cf1';

function readApprovedBase64() {
  const b64 = PARTS.map((path) => fs.readFileSync(path, 'utf8').trim()).join('');
  if (b64.length !== EXPECTED_B64_LENGTH) {
    throw new Error(`Arte aprovada incompleta: base64 ${b64.length}, esperado ${EXPECTED_B64_LENGTH}.`);
  }
  return b64;
}

function isPink(r, g, b) {
  return r >= 190 && g >= 80 && b >= 80 && r >= g + 18 && r >= b + 12;
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

async function findPinkBounds(input, width, height, startFraction = 0) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const startY = Math.floor(height * startFraction);
  const rowCounts = new Int32Array(height);

  for (let y = startY; y < height; y++) {
    let count = 0;
    let p = y * width * channels;
    for (let x = 0; x < width; x++, p += channels) {
      if (isPink(data[p], data[p + 1], data[p + 2])) count++;
    }
    rowCounts[y] = count;
  }

  const rowThreshold = Math.floor(width * 0.22);
  const ys = [];
  for (let y = startY; y < height; y++) if (rowCounts[y] >= rowThreshold) ys.push(y);
  if (!ys.length) return null;

  const y0 = ys[0];
  const y1 = ys[ys.length - 1];
  const colCounts = new Int32Array(width);

  for (let y = y0; y <= y1; y++) {
    let p = y * width * channels;
    for (let x = 0; x < width; x++, p += channels) {
      if (isPink(data[p], data[p + 1], data[p + 2])) colCounts[x]++;
    }
  }

  const cardH = y1 - y0 + 1;
  const colThreshold = Math.floor(cardH * 0.38);
  const xs = [];
  for (let x = 0; x < width; x++) if (colCounts[x] >= colThreshold) xs.push(x);
  if (!xs.length) return null;

  return { x: xs[0], y: y0, w: xs[xs.length - 1] - xs[0] + 1, h: cardH };
}

function removeImgTagContaining(html, dataUri) {
  const at = html.indexOf(dataUri);
  if (at < 0) return { html, removed: false };

  const start = html.lastIndexOf('<img', at);
  const end = html.indexOf('>', at);
  if (start >= 0 && end > at) {
    const tag = html.slice(start, end + 1);
    if (tag.includes(dataUri)) {
      return { html: html.slice(0, start) + html.slice(end + 1), removed: true };
    }
  }

  return { html, removed: false };
}

async function buildReplacementStrip(hero, heroW, heroH, approved, approvedMeta) {
  let heroCard = await findPinkBounds(hero, heroW, heroH, 0.52);
  if (!heroCard) {
    heroCard = {
      x: Math.round(heroW * 0.11),
      y: Math.round(heroH * 0.655),
      w: Math.round(heroW * 0.79),
      h: Math.round(heroH * 0.27)
    };
  }

  let approvedCard = await findPinkBounds(approved, approvedMeta.width, approvedMeta.height, 0);
  if (!approvedCard) {
    approvedCard = { x: 70, y: 24, w: 660, h: 278 };
  }

  const scaledApproved = await sharp(approved)
    .resize({ width: heroW, withoutEnlargement: false, kernel: sharp.kernel.lanczos3 })
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
  const scaledMeta = await sharp(scaledApproved).metadata();

  const scale = heroW / approvedMeta.width;
  const approvedPinkTopScaled = Math.round(approvedCard.y * scale);
  let top = heroCard.y - approvedPinkTopScaled;

  // Protege os blocos 01 e 02 e garante cobertura integral de todo o bloco 03.
  const minTop = Math.round(heroH * 0.60);
  const maxTop = Math.round(heroH * 0.70);
  top = Math.max(minTop, Math.min(maxTop, top));

  const stripH = heroH - top;
  const base = await sharp({
    create: {
      width: heroW,
      height: stripH,
      channels: 3,
      background: { r: 50, g: 24, b: 54 }
    }
  }).webp({ lossless: true }).toBuffer();

  const composites = [{ input: scaledApproved, left: 0, top: 0 }];

  if (scaledMeta.height < stripH) {
    const extra = stripH - scaledMeta.height;
    const sampleH = Math.min(24, scaledMeta.height);
    const tail = await sharp(scaledApproved)
      .extract({ left: 0, top: scaledMeta.height - sampleH, width: heroW, height: sampleH })
      .resize(heroW, extra, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .toBuffer();
    composites.push({ input: tail, left: 0, top: scaledMeta.height });
  }

  const strip = await sharp(base).composite(composites).webp({ lossless: true, effort: 6 }).toBuffer();
  return { strip, top, heroCard, approvedCard, scaledHeight: scaledMeta.height };
}

async function main() {
  if (!fs.existsSync(INDEX_PATH)) throw new Error(`Arquivo ${INDEX_PATH} não encontrado.`);

  const approvedB64 = readApprovedBase64();
  const approved = Buffer.from(approvedB64, 'base64');
  const hash = crypto.createHash('sha256').update(approved).digest('hex');
  if (hash !== EXPECTED_SHA256) throw new Error(`Hash da arte aprovada inválido: ${hash}.`);

  const approvedMeta = await sharp(approved).metadata();
  if (approvedMeta.width !== 800 || approvedMeta.height !== 335) {
    throw new Error(`Dimensões inesperadas da arte aprovada: ${approvedMeta.width}x${approvedMeta.height}.`);
  }

  let html = fs.readFileSync(INDEX_PATH, 'utf8');
  const re = /data:image\/([^;,]+)(?:;[^,]*)*;base64,([A-Za-z0-9+/=]+)/gi;
  const matches = [...html.matchAll(re)];
  if (!matches.length) throw new Error('Nenhuma imagem embutida em base64 foi encontrada no index.html.');

  const infos = [];
  for (const match of matches) {
    try {
      const input = Buffer.from(match[2], 'base64');
      const meta = await sharp(input).metadata();
      if (!meta.width || !meta.height) continue;
      infos.push({ match, input, width: meta.width, height: meta.height });
    } catch (_) {}
  }

  const tallCandidates = infos.filter((item) => {
    const aspect = item.width / item.height;
    return item.width >= 700 && item.height >= 900 && aspect >= 0.55 && aspect <= 1.05;
  });

  if (!tallCandidates.length) {
    throw new Error('Hero vertical com os três presentes não localizado. Nenhuma alteração foi feita.');
  }

  tallCandidates.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  const stack = tallCandidates[0];

  // Identifica a imagem horizontal rosa que vinha sendo colocada por cima do hero.
  const wide = [];
  for (const item of infos) {
    const aspect = item.width / item.height;
    if (item.width >= 300 && item.height >= 100 && item.height <= 700 && aspect >= 2.05 && aspect <= 3.00) {
      wide.push({ ...item, pink: await pinkRatio(item.input) });
    }
  }
  wide.sort((a, b) => b.pink - a.pink);

  let overlayRemoved = false;
  if (wide.length && wide[0].pink >= 0.16) {
    const result = removeImgTagContaining(html, wide[0].match[0]);
    html = result.html;
    overlayRemoved = result.removed;
    console.log(`[INSPIRA] Overlay horizontal detectado: ${wide[0].width}x${wide[0].height}, rosa ${wide[0].pink.toFixed(3)}. Tag removida: ${overlayRemoved}.`);
  }

  await sharp(stack.input).webp({ lossless: true, effort: 6 }).toFile(REVIEW_BEFORE);

  const replacement = await buildReplacementStrip(stack.input, stack.width, stack.height, approved, approvedMeta);
  const output = await sharp(stack.input)
    .composite([{ input: replacement.strip, left: 0, top: replacement.top }])
    .webp({ lossless: true, effort: 6 })
    .toBuffer();

  await sharp(output).toFile(REVIEW_FINAL);

  html = html.replace(stack.match[0], `data:image/webp;base64,${output.toString('base64')}`);
  fs.writeFileSync(INDEX_PATH, html, 'utf8');

  console.log(`[INSPIRA] Bloco 03 reconstruído como faixa única e opaca. Hero ${stack.width}x${stack.height}; início y=${replacement.top}; arte escalada=${stack.width}x${replacement.scaledHeight}.`);
  console.log(`[INSPIRA] Alinhamento: pink hero y=${replacement.heroCard.y}; pink aprovado y=${replacement.approvedCard.y}. Overlay removido=${overlayRemoved}.`);
  console.log(`[INSPIRA] Revisão visual publicada em /${REVIEW_FINAL}.`);
}

main().catch((err) => {
  console.error('[INSPIRA] Falha ao corrigir definitivamente o Presente 03:', err);
  process.exit(1);
});
