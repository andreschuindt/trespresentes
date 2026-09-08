const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

module.exports = async (req, res) => {
  try {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const re = /data:image\/([^;,]+)(?:;[^,]*)*;base64,([A-Za-z0-9+/=]+)/gi;
    const matches = [...html.matchAll(re)];
    const candidates = [];
    for (const m of matches) {
      try {
        const buf = Buffer.from(m[2], 'base64');
        const meta = await sharp(buf).metadata();
        if (!meta.width || !meta.height) continue;
        const aspect = meta.width / meta.height;
        if (meta.width >= 700 && meta.height >= 900 && aspect >= 0.55 && aspect <= 1.05) {
          candidates.push({ buf, width: meta.width, height: meta.height });
        }
      } catch (_) {}
    }
    if (!candidates.length) {
      res.statusCode = 404;
      return res.end('Hero não localizado');
    }
    candidates.sort((a,b) => b.width*b.height - a.width*a.height);
    const out = await sharp(candidates[0].buf).webp({ lossless: true }).toBuffer();
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 200;
    res.end(out);
  } catch (err) {
    res.statusCode = 500;
    res.end(String(err && err.message || err));
  }
};
