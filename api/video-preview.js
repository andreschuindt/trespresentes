module.exports = async (req, res) => {
  try {
    const response = await fetch('https://trespresentes.vercel.app/', {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; TresPresentesPreview/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`Falha ao carregar o site oficial: ${response.status}`);
    }

    let html = await response.text();

    // Mantém todos os caminhos relativos apontando para o site oficial.
    html = html.replace(
      /<head([^>]*)>/i,
      '<head$1><base href="https://trespresentes.vercel.app/">'
    );

    const videoBlock = `
<section id="tp-video-preview" aria-label="Vídeo de apresentação" style="visibility:hidden;width:100%;box-sizing:border-box;margin:28px auto 34px;padding:0 18px;position:relative;z-index:2;">
  <div style="max-width:920px;margin:0 auto;box-sizing:border-box;">
    <div style="text-align:center;margin:0 auto 18px;max-width:760px;">
      <div style="display:inline-block;margin-bottom:10px;padding:7px 11px;border-radius:999px;background:#f3ebf7;color:#6f2f86;font:700 11px/1.2 Arial,Helvetica,sans-serif;letter-spacing:.06em;text-transform:uppercase;">
        Prévia visual · vídeo demonstrativo
      </div>
      <h2 style="margin:0 0 10px;color:#342d37;font:700 clamp(24px,4vw,36px)/1.15 Arial,Helvetica,sans-serif;">
        Assista e conheça os 3 presentes
      </h2>
      <p style="margin:0;color:#625967;font:400 16px/1.65 Arial,Helvetica,sans-serif;">
        Um convite breve para entender como essa jornada pode apoiar seu cuidado, autoconhecimento e desenvolvimento emocional.
      </p>
    </div>

    <div style="position:relative;width:100%;padding-top:56.25%;overflow:hidden;border-radius:18px;background:#1f1b22;box-shadow:0 16px 38px rgba(38,25,43,.14);">
      <iframe
        src="https://www.youtube.com/embed/M7lc1UVf-VE?rel=0&modestbranding=1"
        title="Vídeo demonstrativo do Projeto INSPIRA"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
        style="position:absolute;inset:0;width:100%;height:100%;border:0;"
      ></iframe>
    </div>

    <p style="margin:11px 0 0;text-align:center;color:#8a808d;font:400 12px/1.4 Arial,Helvetica,sans-serif;">
      Vídeo usado apenas para demonstrar o posicionamento. Na versão final entra o seu link do YouTube.
    </p>
  </div>
</section>`;

    const placementScript = `
<script>
(function () {
  function positionVideoPreview() {
    var block = document.getElementById('tp-video-preview');
    if (!block) return;

    var main = document.querySelector('main') || document.body;
    var h1 = main.querySelector('h1');
    var form = main.querySelector('form');
    var placed = false;

    // Preferência: depois da mensagem principal e antes da conversão/formulário.
    if (h1) {
      var headingContainer = h1.parentElement;
      var intro = headingContainer && headingContainer.querySelector('p');

      if (intro && intro.parentNode) {
        intro.insertAdjacentElement('afterend', block);
        placed = true;
      } else if (h1.parentNode) {
        h1.insertAdjacentElement('afterend', block);
        placed = true;
      }
    }

    // Se não houver H1 utilizável, posiciona imediatamente antes do primeiro formulário.
    if (!placed && form && form.parentNode) {
      form.parentNode.insertBefore(block, form);
      placed = true;
    }

    // Último fallback: começo do conteúdo principal.
    if (!placed) {
      main.insertBefore(block, main.firstChild);
    }

    block.style.visibility = 'visible';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', positionVideoPreview, { once: true });
  } else {
    positionVideoPreview();
  }
})();
</script>`;

    html = html.replace(/<body([^>]*)>/i, `<body$1>${videoBlock}`);
    html = html.replace(/<\/body>/i, `${placementScript}</body>`);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.end(html);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Não foi possível gerar a prévia com vídeo. ' + String(error && error.message ? error.message : error));
  }
};
