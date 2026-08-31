const sharp = require('sharp');
const jpeg = require('jpeg-js');

module.exports = async function handler(req, res) {
  try {
    const host = req.headers.host || 'trespresentes.vercel.app';
    const sourceUrl = `https://${host}/api/og?v=20260831-01`;
    const source = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'TresPresentes-OG-Generator/1.2' }
    });

    if (!source.ok) {
      throw new Error(`Falha ao carregar imagem-base: HTTP ${source.status}`);
    }

    const input = Buffer.from(await source.arrayBuffer());
    const decoded = jpeg.decode(input, {
      useTArray: true,
      tolerantDecoding: true,
      formatAsRGBA: true
    });

    if (!decoded || !decoded.data || !decoded.width || !decoded.height) {
      throw new Error('Não foi possível decodificar o JPEG-base.');
    }

    const output = await sharp(decoded.data, {
      raw: { width: decoded.width, height: decoded.height, channels: 4 }
    })
      .resize(1200, 1200, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', String(output.length));
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(output);
  } catch (error) {
    console.error('OG 1200 error:', error);
    return res.status(500).send('Erro ao gerar imagem Open Graph.');
  }
};
