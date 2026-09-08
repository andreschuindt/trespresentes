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
  if (b64.length !== EXPECTED_B64_LENGTH) throw new Error(`Arte aprovada incompleta: ${b64.length}.`);
  return b64;
}

function isPink(r, g, b) {
  return r >= 190 && g >= 80 && b >= 80 && r >= g + 18 && r >= b + 12;
}

async function pinkRatio(input) {
  const { data, info } = await sharp(input).resize(100, 40, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let pink = 0;
  for (let i = 0; i < data.length; i += info.channels) if (isPink(data[i], data[i + 1], data[i + 2])) pink++;
  return pink / (info.width * info.height);
}

async function findPinkBounds(input, width, height, startFraction = 0) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const startY = Math.floor(height * startFraction);
  const rowCounts = new Int32Array(height);
  for (let y = startY; y < height; y++) {
    let count = 0, p = y * width * channels;
    for (let x = 0; x < width; x++, p += channels) if (isPink(data[p], data[p + 1], data[p + 2])) count++;
    rowCounts[y] = count;
  }
  const ys = [];
  const rowThreshold = Math.floor(width * 0.22);
  for (let y = startY; y < height; y++) if (rowCounts[y] >= rowThreshold) ys.push(y);
  if (!ys.length) return null;
  const y0 = ys[0], y1 = ys[ys.length - 1], cardH = y1 - y0 + 1;
  const colCounts = new Int32Array(width);
  for (let y = y0; y <= y1; y++) {
    let p = y * width * channels;
    for (let x = 0; x < width; x++, p += channels) if (isPink(data[p], data[p + 1], data[p + 2])) colCounts[x]++;
  }
  const xs = [];
  const colThreshold = Math.floor(cardH * 0.38);
  for (let x = 0; x < width; x++) if (colCounts[x] >= colThreshold) xs.push(x);
  if (!xs.length) return null;
  return { x: xs[0], y: y0, w: xs[xs.length - 1] - xs[0] + 1, h: cardH };
}

function compactContext(text) {
  return text.replace(/data:image\/[a-zA-Z0-9.+-]+(?:;[^,]*)*;base64,[A-Za-z0-9+/=]+/g, '[DATA_URI]').replace(/\s+/g, ' ').slice(0, 1300);
}

async function buildReplacementStrip(hero, heroW, heroH, approved, approvedMeta) {
  let heroCard = await findPinkBounds(hero, heroW, heroH, 0.52);
  if (!heroCard) heroCard = { x: Math.round(heroW * 0.11), y: Math.round(heroH * 0.655), w: Math.round(heroW * 0.79), h: Math.round(heroH * 0.27) };
  let approvedCard = await findPinkBounds(approved, approvedMeta.width, approvedMeta.height, 0);
  if (!approvedCard) approvedCard = { x: 70, y: 24, w: 660, h: 278 };

  const scaledApproved = await sharp(approved).resize({ width: heroW, withoutEnlargement: false, kernel: sharp.kernel.lanczos3 }).webp({ lossless: true, effort: 6 }).toBuffer();
  const scaledMeta = await sharp(scaledApproved).metadata();
  const scale = heroW / approvedMeta.width;
  const approvedPinkTopScaled = Math.round(approvedCard.y * scale);
  const exactTop = heroCard.y - approvedPinkTopScaled;
  const top = Math.max(0, Math.min(heroH - 1, exactTop));
  const stripH = heroH - top;

  const base = await sharp({ create: { width: heroW, height: stripH, channels: 3, background: { r: 50, g: 24, b: 54 } } }).webp({ lossless: true }).toBuffer();
  const composites = [{ input: scaledApproved, left: 0, top: 0 }];
  if (scaledMeta.height < stripH) {
    const extra = stripH - scaledMeta.height;
    const sampleH = Math.min(24, scaledMeta.height);
    const tail = await sharp(scaledApproved).extract({ left: 0, top: scaledMeta.height - sampleH, width: heroW, height: sampleH }).resize(heroW, extra, { fit: 'fill', kernel: sharp.kernel.lanczos3 }).toBuffer();
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
  if (approvedMeta.width !== 800 || approvedMeta.height !== 335) throw new Error(`Arte aprovada com dimensão inesperada: ${approvedMeta.width}x${approvedMeta.height}.`);

  let html = fs.readFileSync(INDEX_PATH, 'utf8');
  const re = /data:image\/([^;,]+)(?:;[^,]*)*;base64,([A-Za-z0-9+/=]+)/gi;
  const matches = [...html.matchAll(re)];
  if (!matches.length) throw new Error('Nenhuma imagem base64 encontrada.');
  const infos = [];
  for (const match of matches) {
    try {
      const input = Buffer.from(match[2], 'base64');
      const meta = await sharp(input).metadata();
      if (meta.width && meta.height) infos.push({ match, input, width: meta.width, height: meta.height });
    } catch (_) {}
  }

  const tallCandidates = infos.filter(item => { const a = item.width / item.height; return item.width >= 700 && item.height >= 900 && a >= 0.55 && a <= 1.05; });
  if (!tallCandidates.length) throw new Error('Hero vertical com os três presentes não localizado.');
  tallCandidates.sort((a, b) => b.width * b.height - a.width * a.height);
  const stack = tallCandidates[0];

  const wide = [];
  for (const item of infos) {
    const aspect = item.width / item.height;
    if (item.width >= 300 && item.height >= 100 && item.height <= 700 && aspect >= 2.05 && aspect <= 3.00) wide.push({ ...item, pink: await pinkRatio(item.input) });
  }
  wide.sort((a, b) => b.pink - a.pink);
  if (wide.length) {
    const at = html.indexOf(wide[0].match[0]);
    const before = Math.max(0, at - 650);
    const after = Math.min(html.length, at + wide[0].match[0].length + 650);
    console.log(`[INSPIRA][DIAGNOSTICO] Candidato horizontal ${wide[0].width}x${wide[0].height}, rosa=${wide[0].pink.toFixed(3)}.`);
    console.log(`[INSPIRA][DIAGNOSTICO][CONTEXTO] ${compactContext(html.slice(before, after))}`);
  }

  await sharp(stack.input).webp({ lossless: true, effort: 6 }).toFile(REVIEW_BEFORE);
  const replacement = await buildReplacementStrip(stack.input, stack.width, stack.height, approved, approvedMeta);
  const output = await sharp(stack.input).composite([{ input: replacement.strip, left: 0, top: replacement.top }]).webp({ lossless: true, effort: 6 }).toBuffer();
  await sharp(output).toFile(REVIEW_FINAL);
  html = html.replace(stack.match[0], `data:image/webp;base64,${output.toString('base64')}`);
  fs.writeFileSync(INDEX_PATH, html, 'utf8');
  console.log(`[INSPIRA] Presente 03 substituído por faixa única desde y=${replacement.top}; pink antigo y=${replacement.heroCard.y}; arte aprovada alinhada ao mesmo topo.`);
}

main().catch(err => { console.error('[INSPIRA] Falha:', err); process.exit(1); });
