module.exports = async function handler(req, res) {
  const IMAGE_URL = 'https://raw.githubusercontent.com/andreschuindt/trespresentes/b21b9d0b6c75bf6dd2fcff8d968241cd6ffd4c8f/site/hero-community-v35.webp';
  try {
    const response = await fetch(IMAGE_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`GitHub respondeu ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== 47258) throw new Error(`Tamanho inesperado: ${bytes.length}`);
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Content-Length', String(bytes.length));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).send(bytes);
  } catch (error) {
    console.error('hero-image-v35', error);
    return res.status(500).send('Erro ao carregar a imagem.');
  }
};
