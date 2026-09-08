const fs = require('fs');

const INDEX_PATH = 'index.html';
const SITE_URL = 'https://trespresentes.vercel.app/';
const TITLE = 'Você ganhou 3 presentes incríveis! | Projeto INSPIRA';
const DESCRIPTION = 'Receba três presentes do Projeto INSPIRA: o e-book Efeito Girassol, uma sessão terapêutica gratuita de 40 minutos e R$ 10 de desconto na Comunidade INSPIRA.';
const SOCIAL_IMAGE = 'https://trespresentes.vercel.app/og/tres-presentes-1200-v20260831-04.jpg?v=20260831-04';

if (!fs.existsSync(INDEX_PATH)) {
  throw new Error(`Arquivo ${INDEX_PATH} não encontrado.`);
}

let html = fs.readFileSync(INDEX_PATH, 'utf8');

function replaceOrInsertMeta(name, content) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<meta\\s+name=["']${escaped}["'][^>]*>`, 'i');
  const tag = `<meta name="${name}" content="${content}" />`;
  if (re.test(html)) html = html.replace(re, tag);
  else html = html.replace('</head>', `  ${tag}\n</head>`);
}

function replaceOrInsertProperty(property, content) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<meta\\s+property=["']${escaped}["'][^>]*>`, 'i');
  const tag = `<meta property="${property}" content="${content}" />`;
  if (re.test(html)) html = html.replace(re, tag);
  else html = html.replace('</head>', `  ${tag}\n</head>`);
}

// 1) Título, descrição e indexabilidade.
html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${TITLE}</title>`);
replaceOrInsertMeta('description', DESCRIPTION);
replaceOrInsertMeta('robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
replaceOrInsertMeta('googlebot', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
replaceOrInsertMeta('bingbot', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
replaceOrInsertMeta('author', 'Projeto INSPIRA');

// 2) Open Graph e Twitter coerentes com a página pública.
replaceOrInsertProperty('og:title', TITLE);
replaceOrInsertProperty('og:description', DESCRIPTION);
replaceOrInsertProperty('og:url', SITE_URL);
replaceOrInsertProperty('og:locale', 'pt_BR');
replaceOrInsertProperty('og:type', 'website');
replaceOrInsertProperty('og:site_name', 'Três Presentes · Projeto INSPIRA');
replaceOrInsertMeta('twitter:card', 'summary_large_image');
replaceOrInsertMeta('twitter:title', TITLE);
replaceOrInsertMeta('twitter:description', DESCRIPTION);
replaceOrInsertMeta('twitter:image', SOCIAL_IMAGE);
replaceOrInsertMeta('twitter:image:alt', 'Você ganhou três presentes: um e-book, uma sessão terapêutica de 40 minutos e um convite para a Comunidade INSPIRA.');

// 3) Canonical e hreflang válidos.
if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) {
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${SITE_URL}" />`);
} else {
  html = html.replace('</head>', `  <link rel="canonical" href="${SITE_URL}" />\n</head>`);
}
html = html.replace(/\s*<link\s+rel=["']alternate["'][^>]*hreflang=["'](?:pt-BR|x-default)["'][^>]*>\s*/gi, '\n');
html = html.replace(
  /(<link\s+rel=["']canonical["'][^>]*>)/i,
  `$1\n  <link rel="alternate" hreflang="pt-BR" href="${SITE_URL}" />\n  <link rel="alternate" hreflang="x-default" href="${SITE_URL}" />`
);

// 4) Remove âncoras placeholder e mantém destinos rastreáveis.
html = html.replace('<a href="#">Política de Privacidade</a>', '<a href="/privacidade.html">Política de Privacidade</a>');
html = html.replace('<a href="#">Termos</a>', '<a href="/termos.html">Termos</a>');
html = html.replace(/href=["']#["'](\s+id=["']insightsPopupCta["'])/i, 'href="https://wa.me/5522981052618"$1');
html = html.replace(/<a([^>]*?)href=["']#["']([^>]*)>/gi, '<a$1href="/#inicio"$2>');

// 5) Mantém somente UM bloco JSON-LD válido, evitando marcação duplicada.
html = html.replace(/\s*<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi, '\n');
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
      name: TITLE,
      description: DESCRIPTION,
      inLanguage: 'pt-BR',
      isPartOf: { '@id': `${SITE_URL}#website` },
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: SOCIAL_IMAGE,
        width: 1200,
        height: 1200
      },
      about: { '@type': 'Thing', name: 'Projeto INSPIRA' }
    }
  ]
};
html = html.replace('</head>', `  <script id="seo-jsonld" type="application/ld+json">${JSON.stringify(schema)}</script>\n</head>`);

// 6) Validações de segurança antes da publicação.
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
const jsonLdCount = (html.match(/type=["']application\/ld\+json["']/gi) || []).length;
if (jsonLdCount !== 1) {
  throw new Error(`SEO finalizer: quantidade inesperada de JSON-LD: ${jsonLdCount}.`);
}

fs.writeFileSync(INDEX_PATH, html, 'utf8');
console.log('[SEO] Título, descrição, Open Graph e Twitter padronizados.');
console.log('[SEO] Indexabilidade liberada: index,follow.');
console.log('[SEO] Canonical + hreflang pt-BR/x-default aplicados.');
console.log('[SEO] Âncoras placeholder corrigidas para URLs rastreáveis.');
console.log('[SEO] JSON-LD consolidado em um único bloco válido.');
console.log('[SEO] Finalização técnica concluída para mobile e desktop.');
