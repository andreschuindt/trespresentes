const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');

const INDEX_PATH = 'index.html';
const PARTS = [
  'assets/presente03-approved/part01.b64',
  'assets/presente03-approved/part02.b64',
  'assets/presente03-approved/part03.b64',
  'assets/presente03-approved/part04.b64',
  'assets/presente03-approved/part05.b64',
  'assets/presente03-approved/part06.b64',
  'assets/presente03-approved/part07.b64',
  'assets/presente03-approved/part08.b64',
  'assets/presente03-approved/part09.b64',
  'assets/presente03-approved/part10.b64',
  'assets/presente03-approved/part11.b64',
  'assets/presente03-approved/part12.b64',
  'assets/presente03-approved/part13.b64',
  'assets/presente03-approved/part14.b64'
];
const EXPECTED_B64_LENGTH = 47428;
const EXPECTED_SHA256 = '99be72ae0fd5a81896e9d9e96fbb43c71b14fedd24689020c7ed6c1b3bd03cf1';

function readApprovedBase64() {
  const b64 = PARTS.map((path) => fs.readFileSync(path, 'utf8').trim()).join('');
  if (b64.length !== EXPECTED_B64_LENGTH) {
    throw new Error(`Arte aprovada incompleta: base64 ${b64.length}, esperado ${EXPECTED_B64_LENGTH}.`);
  }
  return b64;
}

function scoreBuffers(a, b) {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let total = 0;
  for (let i = 0; i < a.length; i++) total += Math.abs(a[i] - b[i]);
  return total / a.length;
}

async function normalizedRaw(input) {
  return sharp(input)
    .resize(120, 50, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer();
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
  if (html.includes(approvedB64.slice(0, 1024))) {
    console.log('[INSPIRA] A arte aprovada do Presente 03 já está aplicada integralmente.');
    return;
  }

  const re = /data:image\/([^;,]+)(?:;[^,]*)*;base64,([A-Za-z0-9+/=]+)/gi;
  const matches = [...html.matchAll(re)];
  if (!matches.length) throw new Error('Nenhuma imagem embutida em base64 foi encontrada no index.html.');

  const referenceRaw = await normalizedRaw(approved);
  const candidates = [];

  for (const match of matches) {
    try {
      const input = Buffer.from(match[2], 'base64');
      const meta = await sharp(input).metadata();
      if (!meta.width || !meta.height) continue;
      const aspect = meta.width / meta.height;
      if (meta.width < 300 || meta.height < 100 || meta.height > 800 || aspect < 2.05 || aspect > 2.90) continue;
      const raw = await normalizedRaw(input);
      candidates.push({ match, width: meta.width, height: meta.height, score: scoreBuffers(raw, referenceRaw) });
    } catch (_) {}
  }

  if (!candidates.length) throw new Error('O card horizontal do Presente 03 não foi localizado. Nenhuma alteração foi feita.');
  candidates.sort((a, b) => a.score - b.score);
  const chosen = candidates[0];

  const replacement = `data:image/webp;base64,${approvedB64}`;
  const next = html.replace(chosen.match[0], replacement);
  if (next === html) throw new Error('A substituição integral da arte não alterou o HTML.');

  fs.writeFileSync(INDEX_PATH, next, 'utf8');
  console.log(`[INSPIRA] Presente 03 substituído integralmente pela arte aprovada (${approvedMeta.width}x${approvedMeta.height}), sem overlays nem recomposição. Alvo anterior: ${chosen.width}x${chosen.height}; score ${chosen.score.toFixed(2)}.`);
}

main().catch((err) => {
  console.error('[INSPIRA] Falha ao aplicar a arte aprovada do Presente 03:', err);
  process.exit(1);
});
