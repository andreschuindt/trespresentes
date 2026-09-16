const p1 = require('./hero-v32/p1');
const p2 = require('./hero-v32/p2');
const p3 = require('./hero-v32/p3');
const p4 = require('./hero-v32/p4');
const p5 = require('./hero-v32/p5');
const p6 = require('./hero-v32/p6');
const p7 = require('./hero-v32/p7');
const p8 = require('./hero-v32/p8');

module.exports = function handler(req, res) {
  try {
    const image = Buffer.from(p1 + p2 + p3 + p4 + p5 + p6 + p7 + p8, 'base64');
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Content-Length', String(image.length));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).send(image);
  } catch (error) {
    res.status(500).send('Erro ao carregar a imagem.');
  }
};
