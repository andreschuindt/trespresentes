const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');

const INDEX_PATH = 'index.html';
const HERO_PARTS = Array.from({ length: 8 }, (_, i) =>
  `assets/hero-full-approved/part${String(i + 1).padStart(2, '0')}.b64`
);
const CARD_PARTS = Array.from({ length: 14 }, (_, i) =>
  `assets/presente03-approved/part${String(i + 1).padStart(2, '0')}.b64`
);

const HERO_EXPECTED_B64_LENGTH = 72092;
const HERO_EXPECTED_SHA256 = '6933213dfe51a0840308d394fd85bac8436262232b0089fccc3477afd1872a20';
const CARD_EXPECTED_B64_LENGTH = 47428;
const CARD_EXPECTED_SHA256 = '99be72ae0fd5a81896e9d9e96fbb43c71b14fedd24689020c7ed6c1b3bd03cf1';

const HERO_WIDTH = 530;
const HERO_HEIGHT = 626;
const CLEAN_TOP = 390;
const CLEAN_HEIGHT = HERO_HEIGHT - CLEAN_TOP;
const BLEND_HEIGHT = 28;
const CARD_CANVAS_WIDTH = 460;
const CARD_LEFT = Math.round((HERO_WIDTH - CARD_CANVAS_WIDTH) / 2);
const CARD_TOP_ABSOLUTE = 417;
const CARD_TOP = CARD_TOP_ABSOLUTE - CLEAN_TOP;
const FEATHER = 18;

function readParts(paths, expectedLength, label) {
  const b64 = paths.map((path) => fs.readFileSync(path, 'utf8').replace(/\s+/g, '')).join('');
  if (b64.length !== expectedLength) {
    throw new Error(`${label} incompleta: ${b64.length}/${expectedLength}.`);
  }
  return b64;
}

function assertHash(buffer, expected, label) {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  if (hash !== expected) throw new Error(`Hash inválido de ${label}: ${hash}.`);
  return hash;
}

async function sampleAverage(input, left, top, width, height) {
  const { data } = await sharp(input)
    .extract({ left, top, width, height })
    .resize(1, 1, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return [data[0], data[1], data[2]];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

async function buildCleanBackground(hero) {
  const tl = await sampleAverage(hero, 0, CLEAN_TOP, 25, 15);
  const tr = await sampleAverage(hero, HERO_WIDTH - 25, CLEAN_TOP, 25, 15);
  const bl = await sampleAverage(hero, 0, HERO_HEIGHT - 16, 25, 16);
  const br = await sampleAverage(hero, HERO_WIDTH - 25, HERO_HEIGHT - 16, 25, 16);

  const data = Buffer.alloc(HERO_WIDTH * CLEAN_HEIGHT * 4);
  for (let y = 0; y < CLEAN_HEIGHT; y++) {
    const v = CLEAN_HEIGHT <= 1 ? 0 : y / (CLEAN_HEIGHT - 1);
    const left = [lerp(tl[0], bl[0], v), lerp(tl[1], bl[1], v), lerp(tl[2], bl[2], v)];
    const right = [lerp(tr[0], br[0], v), lerp(tr[1], br[1], v), lerp(tr[2], br[2], v)];
    const alpha = y >= BLEND_HEIGHT ? 255 : Math.round(255 * y / BLEND_HEIGHT);

    for (let x = 0; x < HERO_WIDTH; x++) {
      const u = HERO_WIDTH <= 1 ? 0 : x / (HERO_WIDTH - 1);
      const idx = (y * HERO_WIDTH + x) * 4;
      data[idx] = Math.round(lerp(left[0], right[0], u));
      data[idx + 1] = Math.round(lerp(left[1], right[1], u));
      data[idx + 2] = Math.round(lerp(left[2], right[2], u));
      data[idx + 3] = alpha;
    }
  }

  return sharp(data, {
    raw: { width: HERO_WIDTH, height: CLEAN_HEIGHT, channels: 4 }
  }).png().toBuffer();
}

async function featherCard(input) {
  const { data, info } = await sharp(input)
    .resize({ width: CARD_CANVAS_WIDTH })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const d = Math.min(x, y, info.width - 1 - x, info.height - 1 - y);
      const factor = Math.max(0, Math.min(1, d / FEATHER));
      const idx = (y * info.width + x) * channels + 3;
      data[idx] = Math.round(data[idx] * factor);
    }
  }

  return {
    png: await sharp(data, { raw: info }).png().toBuffer(),
    width: info.width,
    height: info.height
  };
}

async function buildApprovedHero(hero, card) {
  const cleanBackground = await buildCleanBackground(hero);
  const approvedCard = await featherCard(card);

  if (CARD_TOP < 0 || CARD_TOP + approvedCard.height > CLEAN_HEIGHT) {
    throw new Error(`Presente 03 fora da área segura: top=${CARD_TOP}, altura=${approvedCard.height}, área=${CLEAN_HEIGHT}.`);
  }

  return sharp(hero)
    .composite([
      { input: cleanBackground, left: 0, top: CLEAN_TOP },
      { input: approvedCard.png, left: CARD_LEFT, top: CARD_TOP_ABSOLUTE }
    ])
    .webp({ quality: 95, smartSubsample: true })
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(INDEX_PATH)) throw new Error(`Arquivo ${INDEX_PATH} não encontrado.`);

  const heroB64 = readParts(HERO_PARTS, HERO_EXPECTED_B64_LENGTH, 'Arte vertical dos três presentes');
  const cardB64 = readParts(CARD_PARTS, CARD_EXPECTED_B64_LENGTH, 'Arte aprovada do Presente 03');
  const hero = Buffer.from(heroB64, 'base64');
  const card = Buffer.from(cardB64, 'base64');

  assertHash(hero, HERO_EXPECTED_SHA256, 'hero-base');
  assertHash(card, CARD_EXPECTED_SHA256, 'Presente 03 aprovado');

  const heroMeta = await sharp(hero).metadata();
  const cardMeta = await sharp(card).metadata();
  if (heroMeta.width !== HERO_WIDTH || heroMeta.height !== HERO_HEIGHT) {
    throw new Error(`Dimensão inesperada do hero-base: ${heroMeta.width}x${heroMeta.height}.`);
  }
  if (cardMeta.width !== 800 || cardMeta.height !== 335) {
    throw new Error(`Dimensão inesperada do Presente 03 aprovado: ${cardMeta.width}x${cardMeta.height}.`);
  }

  const finalHero = await buildApprovedHero(hero, card);
  const finalMeta = await sharp(finalHero).metadata();
  if (finalMeta.width !== HERO_WIDTH || finalMeta.height !== HERO_HEIGHT) {
    throw new Error(`Hero final ficou com dimensão inválida: ${finalMeta.width}x${finalMeta.height}.`);
  }

  let html = fs.readFileSync(INDEX_PATH, 'utf8');
  const re = /data:image\/([^;,]+)(?:;[^,]*)*;base64,([A-Za-z0-9+/=]+)/gi;
  const matches = [...html.matchAll(re)];
  if (!matches.length) throw new Error('Nenhuma imagem base64 encontrada no site.');

  const targetAspect = HERO_WIDTH / HERO_HEIGHT;
  const candidates = [];
  for (const match of matches) {
    try {
      const input = Buffer.from(match[2], 'base64');
      const meta = await sharp(input).metadata();
      if (!meta.width || !meta.height) continue;
      const aspectDelta = Math.abs(meta.width / meta.height - targetAspect);
      if (meta.width >= 500 && meta.height >= 550 && aspectDelta <= 0.10) {
        candidates.push({ match, width: meta.width, height: meta.height, aspectDelta, area: meta.width * meta.height });
      }
    } catch (_) {}
  }

  if (!candidates.length) throw new Error('Hero vertical dos três presentes não localizado no HTML.');
  candidates.sort((a, b) => a.aspectDelta - b.aspectDelta || b.area - a.area);
  const chosen = candidates[0];
  const finalB64 = finalHero.toString('base64');
  html = html.replace(chosen.match[0], `data:image/webp;base64,${finalB64}`);

  html = html.replace(
    '.hero-presentes-frame{position:relative;z-index:2;width:min(610px,100%);padding:0;background:transparent;border:0;box-shadow:none}',
    '.hero-presentes-frame{position:relative;z-index:2;width:min(530px,100%);padding:0;background:transparent;border:0;box-shadow:none}'
  );
  html = html.replace(
    '.hero-presentes{display:block;width:100%;height:auto;object-fit:contain;filter:drop-shadow(0 24px 52px rgba(0,0,0,.16))}',
    '.hero-presentes{display:block;width:100%;height:auto;object-fit:contain;filter:none}'
  );
  html = html.replace('.hero-presentes-frame{width:min(560px,100%)}', '.hero-presentes-frame{width:min(530px,100%)}');
  html = html.replace('.hero-presentes-frame{width:100%;padding:0}', '.hero-presentes-frame{width:min(530px,100%);padding:0}');

  fs.writeFileSync(INDEX_PATH, html, 'utf8');
  fs.writeFileSync('hero-approved-final.webp', finalHero);

  const finalHash = crypto.createHash('sha256').update(finalHero).digest('hex');
  console.log(`[INSPIRA] Hero final refinado em ${HERO_WIDTH}x${HERO_HEIGHT}.`);
  console.log('[INSPIRA] Presente 03 aplicado uma única vez, centralizado, sem sobreposição e com transição de fundo suavizada.');
  console.log(`[INSPIRA] Presente 03 fonte: ${cardMeta.width}x${cardMeta.height}; canvas ${CARD_CANVAS_WIDTH}px; x=${CARD_LEFT}; y=${CARD_TOP_ABSOLUTE}.`);
  console.log(`[INSPIRA] Hero anterior no HTML: ${chosen.width}x${chosen.height}. SHA-256 final: ${finalHash}.`);
}

main().catch((err) => {
  console.error('[INSPIRA] Falha:', err);
  process.exit(1);
});
