const p1 = require('./hero-parts/p1');
const p2 = require('./hero-parts/p2');
const p3 = require('./hero-parts/p3');
const p4 = require('./hero-parts/p4');

module.exports = function handler(req, res) {
  try {
    const image = Buffer.from(p1 + p2 + p3 + p4, 'base64');
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).send(image);
  } catch (error) {
    res.status(500).send('Erro ao carregar a imagem.');
  }
};
