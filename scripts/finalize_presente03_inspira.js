const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');

const INDEX_PATH = 'index.html';
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

async function findBottomPinkCard(input, width, height) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const rowCounts = new Int32Array(height);
  const startY = Math.floor(height * 0.52);

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

  let y0 = ys[0], y1 = ys[ys.length - 1];
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

  let x0 = xs[0], x1 = xs[xs.length - 1];
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

async function replaceInsideStack(input, width, height, approved) {
  let box = await findBottomPinkCard(input, width, height);
  if (!box || box.w < width * 0.42 || box.h < height * 0.10) {
    box = {
      x: Math.round(width * 0.108),
      y: Math.round(height * 0.675),
      w: Math.round(width * 0.752),
      h: Math.round(height * 0.250)
    };
  }

  const card = await sharp(approved)
    .resize(box.w, box.h, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .toBuffer();

  const out = await sharp(input)
    .composite([{ input: card, left: box.x, top: box.y }])
    .webp({ lossless: true, effort: 6 })
    .toBuffer();

  console.log(`[INSPIRA] Arte aprovada aplicada integralmente no Presente 03 dentro do hero: x=${box.x}, y=${box.y}, w=${box.w}, h=${box.h}.`);
  return out;
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

  const wide = [];
  for (const item of infos) {
    const aspect = item.width / item.height;
    if (item.width >= 300 && item.height >= 100 && item.height <= 700 && aspect >= 2.05 && aspect <= 3.00) {
      wide.push({ ...item, pink: await pinkRatio(item.input) });
    }
  }
  wide.sort((a, b) => b.pink - a.pink);

  if (wide.length && wide[0].pink >= 0.16) {
    const item = wide[0];
    html = html.replace(item.match[0], `data:image/webp;base64,${approvedB64}`);
    fs.writeFileSync(INDEX_PATH, html, 'utf8');
    console.log(`[INSPIRA] Card isolado do Presente 03 substituído integralmente pela arte aprovada. Alvo: ${item.width}x${item.height}; rosa ${item.pink.toFixed(3)}.`);
    return;
  }

  const tallCandidates = infos.filter((item) => {
    const aspect = item.width / item.height;
    return item.width >= 700 && item.height >= 900 && aspect >= 0.55 && aspect <= 1.05;
  });

  if (!tallCandidates.length) {
    throw new Error('Nem o card isolado nem o hero vertical contendo o Presente 03 foram localizados. Nenhuma alteração foi feita.');
  }

  tallCandidates.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  const stack = tallCandidates[0];
  const output = await replaceInsideStack(stack.input, stack.width, stack.height, approved);
  html = html.replace(stack.match[0], `data:image/webp;base64,${output.toString('base64')}`);
  fs.writeFileSync(INDEX_PATH, html, 'utf8');
  console.log(`[INSPIRA] Presente 03 corrigido com a arte aprovada, sem overlays e sem recriar textos. Hero: ${stack.width}x${stack.height}.`);
}

main().catch((err) => {
  console.error('[INSPIRA] Falha ao aplicar a arte aprovada do Presente 03:', err);
  process.exit(1);
});
