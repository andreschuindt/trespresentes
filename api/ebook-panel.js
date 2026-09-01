module.exports = (req, res) => {
  res.statusCode = 302;
  res.setHeader('Location', '/tres-presentes-ebook-oficial.png?v=20260901-1');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=31536000');
  res.end();
};
