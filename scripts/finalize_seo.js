const fs = require('fs');

const INDEX_PATH = 'index.html';
const SITE_URL = 'https://trespresentes.vercel.app/';
const DESCRIPTION = 'Receba três presentes do Projeto INSPIRA: o e-book Efeito Girassol, uma sessão terapêutica gratuita de 40 minutos e R$ 10 de desconto na Comunidade INSPIRA.';

if (!fs.existsSync(INDEX_PATH)) {
  throw new Error(`Arquivo ${INDEX_PATH} não encontrado.`);
}

let html = fs.readFileSync(INDEX_PATH, 'utf8');

function replaceOrInsertMeta(name, content) {
  const re = new RegExp(`<meta\\s+name=["']${name}["'][^>]*>`, 'i');
  const tag = `<meta name="${name}" content="${content}" />`;
  if (re.test(html)) html = html.replace(re, tag);
  else html = html.replace('</head>', `  ${tag}\n</head>`);
}

function replaceOrInsertProperty(property, content) {
  const re = new RegExp(`<meta\\s+property=["']${property.replace(':', '\\:')}["'][^>]*>`, 'i');
  const tag = `<meta property="${property}" content="${content}" />`;
  if (re.test(html)) html = html.replace(re, tag);
  else html = html.replace('</head>', `  ${tag}\n</head>`);
}

// 1) Indexabilidade: remove o bloqueio que derrubava fortemente o Lighthouse SEO.
replaceOrInsertMeta('robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
replaceOrInsertMeta('googlebot', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
replaceOrInsertMeta('bingbot', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
replaceOrInsertMeta('description', DESCRIPTION);
replaceOrInsertMeta('author', 'Projeto INSPIRA');

// 2) Open Graph consistente com o conteúdo público e indexável.
replaceOrInsertProperty('og:title', 'Você ganhou 3 presentes incríveis! | Projeto INSPIRA');
replaceOrInsertProperty('og:description', DESCRIPTION);
replaceOrInsertProperty('og:url', SITE_URL);
replaceOrInsertProperty('og:locale', 'pt_BR');
replaceOrInsertProperty('og:type', 'website');
replaceOrInsertProperty('og:site_name', 'Três Presentes · Projeto INSPIRA');

// 3) Canonical e hreflang válidos.
html = html.replace(
  /<link\s+rel=["']canonical["'][^>]*>/i,
  `<link rel="canonical" href="${SITE_URL}" />`
);
html = html.replace(/\s*<link\s+rel=["']alternate["'][^>]*hreflang=["']pt-BR["'][^>]*>\s*/gi, '\n');
html = html.replace(/\s*<link\s+rel=["']alternate["'][^>]*hreflang=["']x-default["'][^>]*>\s*/gi, '\n');
html = html.replace(
  /(<link\s+rel=["']canonical["'][^>]*>)/i,
  `$1\n  <link rel="alternate" hreflang="pt-BR" href="${SITE_URL}" />\n  <link rel="alternate" hreflang="x-default" href="${SITE_URL}" />`
);

// 4) Corrige âncoras placeholder (#), que podem ser consideradas não rastreáveis.
html = html.replace(
  '<a href="#">Política de Privacidade</a>',
  '<a href="/privacidade.html">Política de Privacidade</a>'
);
html = html.replace(
  '<a href="#">Termos</a>',
  '<a href="/termos.html">Termos</a>'
);
html = html.replace(
  /href=["']#["'](\s+id=["']insightsPopupCta["'])/i,
  'href="https://wa.me/5522981052618"$1'
);

// Qualquer outro href="#" residual em <a> vira um fragmento interno rastreável real.
html = html.replace(/<a([^>]*?)href=["']#["']([^>]*)>/gi, '<a$1href="/#inicio"$2>');

// 5) Dados estruturados válidos (não entram na nota, mas melhoram o SEO técnico).
html = html.replace(/\s*<script\s+id=["']seo-jsonld["'][\s\S]*?<\/script>\s*/i, '\n');
const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}#website`,
      url: SITE_URL,
      name: 'Três Presentes · Projeto INSPIRA',
      inLanguage: 'pt-BR'
    },
    {
      '@type': 'WebPage',
      '@id': `${SITE_URL}#webpage`,
      url: SITE_URL,
      name: 'Você ganhou 3 presentes incríveis! | Projeto INSPIRA',
      description: DESCRIPTION,
      inLanguage: 'pt-BR',
      isPartOf: { '@id': `${SITE_URL}#website` },
      about: { '@type': 'Thing', name: 'Projeto INSPIRA' }
    }
  ]
};
html = html.replace(
  '</head>',
  `  <script id="seo-jsonld" type="application/ld+json">${JSON.stringify(schema)}</script>\n</head>`
);

// 6) Validações de segurança antes de publicar.
const robotsMatch = html.match(/<meta\s+name=["']robots["'][^>]*content=["']([^"']+)["'][^>]*>/i);
if (!robotsMatch || /noindex|nofollow/i.test(robotsMatch[1])) {
  throw new Error('SEO finalizer: robots ainda contém noindex/nofollow.');
}
if (/href=["']#["']/i.test(html)) {
  throw new Error('SEO finalizer: ainda existe âncora href="#" no HTML.');
}
if (!/rel=["']canonical["'][^>]*https:\/\/trespresentes\.vercel\.app\//i.test(html)) {
  throw new Error('SEO finalizer: canonical não foi aplicado corretamente.');
}
if (!/hreflang=["']pt-BR["']/i.test(html)) {
  throw new Error('SEO finalizer: hreflang pt-BR ausente.');
}

fs.writeFileSync(INDEX_PATH, html, 'utf8');
console.log('[SEO] Indexabilidade liberada: index,follow.');
console.log('[SEO] Canonical + hreflang pt-BR/x-default aplicados.');
console.log('[SEO] Âncoras placeholder corrigidas para URLs rastreáveis.');
console.log('[SEO] JSON-LD WebSite/WebPage aplicado.');
console.log('[SEO] Finalização técnica concluída para mobile e desktop.');
