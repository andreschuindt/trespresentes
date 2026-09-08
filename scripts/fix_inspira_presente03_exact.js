const fs = require('fs');
const sharp = require('sharp');

const INDEX_PATH = 'index.html';
const REFERENCE_SOURCE = 'scripts/fix_inspira_presente03_build.js';

function readReferenceBase64() {
  const source = fs.readFileSync(REFERENCE_SOURCE, 'utf8');
  const match = source.match(/const\s+REFERENCE_B64\s*=\s*"([A-Za-z0-9+/=]+)";/);
  if (!match) throw new Error('REFERENCE_B64 não encontrado.');
  return match[1];
}

function scoreBuffers(a, b) {
  const len = Math.min(a.length, b.length);
  let total = 0;
  for (let i = 0; i < len; i++) total += Math.abs(a[i] - b[i]);
  return total / Math.max(1, len);
}

async function sampleColor(input, left, top, width, height) {
  const { data, info } = await sharp(input)
    .extract({ left, top, width, height })
    .resize(1, 1)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const r = data[0] || 247;
  const g = data[1] || 170;
  const b = data[2] || 165;
  return `rgb(${r},${g},${b})`;
}

function svgPatch(width, height, background, text, fontSize, weight = 700) {
  return Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="0" y="0" width="${width}" height="${height}" rx="${Math.max(2, Math.round(height / 3))}" fill="${background}"/>
    <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle"
      font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="#7d1717">${text}</text>
  </svg>`);
}

async function main() {
  if (!fs.existsSync(INDEX_PATH)) throw new Error(`Arquivo ${INDEX_PATH} não encontrado.`);
  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  const re = /data:image\/([^;,]+)(?:;[^,]*)*;base64,([A-Za-z0-9+/=]+)/gi;
  const matches = [...html.matchAll(re)];
  if (!matches.length) throw new Error('Nenhuma imagem embutida em base64 foi encontrada no index.html.');

  const referenceRaw = await sharp(Buffer.from(readReferenceBase64(), 'base64'))
    .resize(100, 40, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer();

  const candidates = [];
  for (const m of matches) {
    try {
      const input = Buffer.from(m[2], 'base64');
      const meta = await sharp(input).metadata();
      if (!meta.width || !meta.height || meta.width < 300 || meta.height < 120) continue;
      const ratio = meta.width / meta.height;
      if (ratio < 1.8 || ratio > 3.2) continue;
      const raw = await sharp(input)
        .resize(100, 40, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer();
      candidates.push({ match: m, width: meta.width, height: meta.height, score: scoreBuffers(raw, referenceRaw) });
    } catch (_) {}
  }

  if (!candidates.length) throw new Error('A arte horizontal do Presente 03 não foi localizada.');
  candidates.sort((a, b) => a.score - b.score);
  const chosen = candidates[0];
  const input = Buffer.from(chosen.match[2], 'base64');
  const sx = chosen.width / 500;
  const sy = chosen.height / 200;

  // Coordenadas relativas à arte original 500x200 do Presente 03.
  const badge = {
    left: Math.round(326 * sx),
    top: Math.round(26 * sy),
    width: Math.round(88 * sx),
    height: Math.round(20 * sy)
  };
  const body = {
    left: Math.round(226 * sx),
    top: Math.round(129 * sy),
    width: Math.round(87 * sx),
    height: Math.round(15 * sy)
  };

  const badgeBg = await sampleColor(input,
    Math.max(0, badge.left + Math.round(6 * sx)),
    Math.max(0, badge.top + Math.round(3 * sy)),
    Math.max(1, Math.round(4 * sx)),
    Math.max(1, Math.round(4 * sy))
  );
  const bodyBg = await sampleColor(input,
    Math.max(0, body.left),
    Math.max(0, body.top),
    Math.max(1, Math.round(4 * sx)),
    Math.max(1, Math.round(4 * sy))
  );

  const badgePatch = svgPatch(badge.width, badge.height, badgeBg, 'PROJETO INSPIRA', Math.max(8, Math.round(7.2 * sy)), 700);
  const bodyPatch = svgPatch(body.width, body.height, bodyBg, 'INSPIRA', Math.max(8, Math.round(8 * sy)), 500);

  const output = await sharp(input)
    .composite([
      { input: badgePatch, left: badge.left, top: badge.top },
      { input: bodyPatch, left: body.left, top: body.top }
    ])
    .webp({ lossless: true })
    .toBuffer();

  const newDataUri = `data:image/webp;base64,${output.toString('base64')}`;
  const next = html.replace(chosen.match[0], newDataUri);
  if (next === html) throw new Error('A substituição da arte não alterou o HTML.');

  fs.writeFileSync(INDEX_PATH, next, 'utf8');
  console.log(`[INSPIRA] Presente 03 corrigido com arte nítida: ${chosen.width}x${chosen.height}; score ${chosen.score.toFixed(2)}.`);
}

main().catch((err) => {
  console.error('[INSPIRA] Falha ao corrigir a arte:', err);
  process.exit(1);
});
