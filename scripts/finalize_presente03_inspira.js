const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');

const INDEX_PATH = 'index.html';
const PARTS = Array.from({ length: 8 }, (_, i) =>
  `assets/hero-full-approved/part${String(i + 1).padStart(2, '0')}.b64`
);
const EXPECTED_B64_LENGTH = 72092;
const EXPECTED_SHA256 = '6933213dfe51a0840308d394fd85bac8436262232b0089fccc3477afd1872a20';
const EXPECTED_WIDTH = 530;
const EXPECTED_HEIGHT = 626;

function readApprovedHeroBase64() {
  const b64 = PARTS.map((path) => fs.readFileSync(path, 'utf8').replace(/\s+/g, '')).join('');
  if (b64.length !== EXPECTED_B64_LENGTH) {
    throw new Error(`Arte integral aprovada incompleta: ${b64.length}/${EXPECTED_B64_LENGTH}.`);
  }
  return b64;
}

async function main() {
  if (!fs.existsSync(INDEX_PATH)) throw new Error(`Arquivo ${INDEX_PATH} não encontrado.`);

  const approvedB64 = readApprovedHeroBase64();
  const approved = Buffer.from(approvedB64, 'base64');
  const hash = crypto.createHash('sha256').update(approved).digest('hex');
  if (hash !== EXPECTED_SHA256) throw new Error(`Hash da arte integral aprovada inválido: ${hash}.`);

  const approvedMeta = await sharp(approved).metadata();
  if (approvedMeta.width !== EXPECTED_WIDTH || approvedMeta.height !== EXPECTED_HEIGHT) {
    throw new Error(`Dimensão inesperada da arte integral: ${approvedMeta.width}x${approvedMeta.height}.`);
  }

  let html = fs.readFileSync(INDEX_PATH, 'utf8');
  const re = /data:image\/([^;,]+)(?:;[^,]*)*;base64,([A-Za-z0-9+/=]+)/gi;
  const matches = [...html.matchAll(re)];
  if (!matches.length) throw new Error('Nenhuma imagem base64 encontrada no site.');

  const targetAspect = EXPECTED_WIDTH / EXPECTED_HEIGHT;
  const candidates = [];

  for (const match of matches) {
    try {
      const input = Buffer.from(match[2], 'base64');
      const meta = await sharp(input).metadata();
      if (!meta.width || !meta.height) continue;
      const aspect = meta.width / meta.height;
      const aspectDelta = Math.abs(aspect - targetAspect);
      if (meta.width >= 500 && meta.height >= 550 && aspectDelta <= 0.10) {
        candidates.push({ match, width: meta.width, height: meta.height, aspectDelta, area: meta.width * meta.height });
      }
    } catch (_) {}
  }

  if (!candidates.length) throw new Error('Hero vertical dos três presentes não localizado.');

  candidates.sort((a, b) => {
    if (a.aspectDelta !== b.aspectDelta) return a.aspectDelta - b.aspectDelta;
    return b.area - a.area;
  });

  const hero = candidates[0];
  html = html.replace(hero.match[0], `data:image/webp;base64,${approvedB64}`);

  // Mantém a arte em sua resolução natural máxima e sem filtros externos,
  // para que o navegador não acrescente sombra nem amplie a imagem além de 530 px.
  html = html.replace(
    '.hero-presentes-frame{position:relative;z-index:2;width:min(610px,100%);padding:0;background:transparent;border:0;box-shadow:none}',
    '.hero-presentes-frame{position:relative;z-index:2;width:min(530px,100%);padding:0;background:transparent;border:0;box-shadow:none}'
  );
  html = html.replace(
    '.hero-presentes{display:block;width:100%;height:auto;object-fit:contain;filter:drop-shadow(0 24px 52px rgba(0,0,0,.16))}',
    '.hero-presentes{display:block;width:100%;height:auto;object-fit:contain;filter:none}'
  );
  html = html.replace(
    '.hero-presentes-frame{width:min(560px,100%)}',
    '.hero-presentes-frame{width:min(530px,100%)}'
  );
  html = html.replace(
    '.hero-presentes-frame{width:100%;padding:0}',
    '.hero-presentes-frame{width:min(530px,100%);padding:0}'
  );

  fs.writeFileSync(INDEX_PATH, html, 'utf8');
  fs.writeFileSync('hero-approved-final.webp', approved);

  console.log(`[INSPIRA] Hero completo restaurado integralmente com a arte aprovada ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}.`);
  console.log('[INSPIRA] Exibição protegida contra ampliação acima de 530 px e sem filtro/sombra CSS externa.');
  console.log(`[INSPIRA] Hero anterior: ${hero.width}x${hero.height}. SHA-256 aprovado: ${EXPECTED_SHA256}.`);
}

main().catch((err) => {
  console.error('[INSPIRA] Falha:', err);
  process.exit(1);
});
