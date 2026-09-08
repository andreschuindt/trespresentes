const fs = require('fs');
const sharp = require('sharp');

const INDEX_PATH = 'index.html';
const PATCH_SOURCE = 'scripts/fix_inspira_presente03_build.js';

function readPatchBase64(name) {
  const source = fs.readFileSync(PATCH_SOURCE, 'utf8');
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*"([A-Za-z0-9+/=]+)";`));
  if (!match) throw new Error(`Patch ${name} não encontrado.`);
  return match[1];
}

async function main() {
  if (!fs.existsSync(INDEX_PATH)) throw new Error(`Arquivo ${INDEX_PATH} não encontrado.`);

  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  const badgeB64 = readPatchBase64('BADGE_PATCH_B64');
  const bodyB64 = readPatchBase64('BODY_PATCH_B64');

  const re = /data:image\/([^;,]+)(?:;[^,]*)*;base64,([A-Za-z0-9+/=]+)/gi;
  const matches = [...html.matchAll(re)];
  if (!matches.length) throw new Error('Nenhuma imagem embutida em base64 foi encontrada no index.html.');

  let chosen = null;

  for (const m of matches) {
    try {
      const input = Buffer.from(m[2], 'base64');
      const meta = await sharp(input).metadata();
      if (!meta.width || !meta.height) continue;

      if (meta.width === 1122 && meta.height === 1402) {
        chosen = { match: m, width: meta.width, height: meta.height };
        break;
      }
    } catch (_) {}
  }

  if (!chosen) {
    throw new Error('A arte 1122x1402 dos três presentes não foi localizada. Nenhuma alteração foi feita.');
  }

  const input = Buffer.from(chosen.match[2], 'base64');

  const badgePatch = await sharp(Buffer.from(badgeB64, 'base64'))
    .resize(164, 34, { fit: 'fill' })
    .png()
    .toBuffer();

  const bodyPatch = await sharp(Buffer.from(bodyB64, 'base64'))
    .resize(146, 27, { fit: 'fill' })
    .png()
    .toBuffer();

  const output = await sharp(input)
    .composite([
      { input: badgePatch, left: 764, top: 930 },
      { input: bodyPatch, left: 532, top: 1134 }
    ])
    .webp({ quality: 96, smartSubsample: true })
    .toBuffer();

  const newDataUri = `data:image/webp;base64,${output.toString('base64')}`;
  const next = html.replace(chosen.match[0], newDataUri);

  if (next === html) throw new Error('A substituição da arte não alterou o HTML.');

  fs.writeFileSync(INDEX_PATH, next, 'utf8');
  console.log('[INSPIRA] Correção aplicada somente no Presente 03 da arte 1122x1402.');
}

main().catch((err) => {
  console.error('[INSPIRA] Falha ao corrigir a arte:', err);
  process.exit(1);
});
