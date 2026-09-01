const parts = [
  require('../data/ebook-panel-data-00'),
  require('../data/ebook-panel-data-01'),
  require('../data/ebook-panel-data-02'),
  require('../data/ebook-panel-data-03'),
  require('../data/ebook-panel-data-04')
];

module.exports = (req, res) => {
  const data = Buffer.from(parts.join(''), 'base64');
  res.setHeader('Content-Type', 'image/webp');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.statusCode = 200;
  res.end(data);
};
