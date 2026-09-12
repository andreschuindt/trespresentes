const fs = require('fs');
const path = require('path');

const INDEX_PATH = 'index.html';
const PARTS_DIR = path.join('assets', 'popup-inspira');
const OUTPUT_IMAGE = 'inspira-grupo-500.webp';
const POPUP_TITLE = 'Quer conversar comigo no whatsapp?';

if (!fs.existsSync(INDEX_PATH)) {
  throw new Error(`[POPUP INSPIRA] Arquivo ${INDEX_PATH} não encontrado.`);
}
if (!fs.existsSync(PARTS_DIR)) {
  throw new Error(`[POPUP INSPIRA] Pasta ${PARTS_DIR} não encontrada.`);
}

const parts = fs.readdirSync(PARTS_DIR)
  .filter((name) => /^part\d+\.b64$/i.test(name))
  .sort();

if (!parts.length) {
  throw new Error('[POPUP INSPIRA] Nenhuma parte da arte quadrada foi encontrada.');
}

const encoded = parts
  .map((name) => fs.readFileSync(path.join(PARTS_DIR, name), 'utf8').trim())
  .join('');

const image = Buffer.from(encoded, 'base64');
if (image.length < 10000 || image.subarray(0, 4).toString('ascii') !== 'RIFF' || image.subarray(8, 12).toString('ascii') !== 'WEBP') {
  throw new Error('[POPUP INSPIRA] A arte reconstruída não é um WebP válido.');
}

// Mantém o mesmo caminho público já usado pelo popup, evitando qualquer quebra de referência.
fs.writeFileSync(OUTPUT_IMAGE, image);

let html = fs.readFileSync(INDEX_PATH, 'utf8');

// Preenche integralmente o quadrante esquerdo com a nova arte quadrada.
html = html.replace(
  /\.insights-popup__group-image\{position:relative;[^}]*background:#eadfec;overflow:hidden\}/,
  '.insights-popup__group-image{position:relative;align-self:start;width:100%;aspect-ratio:1/1;min-height:0;background:#eadfec;overflow:hidden}'
);
html = html.replace(
  /\.insights-popup__group-image img\{width:100%;height:100%;object-fit:[^;}]*(?:;background:[^;}]*)?\}/,
  '.insights-popup__group-image img{width:100%;height:100%;object-fit:cover;background:#f7efe9}'
);
html = html.replace(
  /\.insights-popup__group-image\{min-height:205px;max-height:230px\}/,
  '.insights-popup__group-image{aspect-ratio:1/1;min-height:0;max-height:none}'
);

// Atualiza cache e descrição da imagem sem alterar o restante do popup.
html = html.replace(
  /src="\/inspira-grupo-500\.webp\?v=[^"]*"/,
  'src="/inspira-grupo-500.webp?v=20260911-03"'
);
html = html.replace(
  /alt="Caderno aberto, caneca e vela em um ambiente acolhedor, representando práticas semanais de reflexão do grupo INSPIRA\."/,
  'alt="Roda de conversa acolhedora da Comunidade INSPIRA, representando escuta, cuidado e pertencimento."'
);

// Atualiza somente o título principal solicitado para a janela popup.
html = html.replace(
  /<h2 id="insightsPopupTitle">[\s\S]*?<\/h2>/i,
  `<h2 id="insightsPopupTitle">${POPUP_TITLE}</h2>`
);

if (!html.includes('object-fit:cover;background:#f7efe9')) {
  throw new Error('[POPUP INSPIRA] O preenchimento integral da imagem não foi aplicado.');
}
if (!html.includes('/inspira-grupo-500.webp?v=20260911-03')) {
  throw new Error('[POPUP INSPIRA] A nova versão da imagem não foi referenciada no popup.');
}
if (!html.includes(`<h2 id="insightsPopupTitle">${POPUP_TITLE}</h2>`)) {
  throw new Error('[POPUP INSPIRA] O novo título do popup não foi aplicado.');
}

fs.writeFileSync(INDEX_PATH, html, 'utf8');

console.log(`[POPUP INSPIRA] Arte quadrada reconstruída: ${image.length} bytes.`);
console.log('[POPUP INSPIRA] Imagem configurada para preencher integralmente o quadrante do popup.');
console.log(`[POPUP INSPIRA] Título atualizado para: ${POPUP_TITLE}`);
console.log('[POPUP INSPIRA] Demais conteúdos do popup foram preservados.');
