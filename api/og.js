const part0 = require('./og-small-00');
const part1 = require('./og-small-01');

module.exports = (req, res) => {
  const image = Buffer.from(part0 + part1, 'base64');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Content-Length', String(image.length));
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=31536000, immutable');
  res.end(image);
};
