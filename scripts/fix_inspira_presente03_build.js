const fs = require('fs');
const sharp = require('sharp');

const INDEX_PATH = 'index.html';

const BADGE_PATCH_B64 = "iVBORw0KGgoAAAANSUhEUgAAAE4AAAAQCAIAAAA3TN7NAAACZElEQVR42mP8vWEFw8gATAwjBox6dTgCFvK03X/+MqmzP8bVyclIP6mzn5+be0V9OQcbW2h9m4q0VHtaAgMDw4xN23acPPv1xw8hXp6C0AAJIaGkzn4GBgZGRkYRfr4wR9sQexs0cxgYGJiZmCSEBNN8Pe30dSB2Vcyaf/LaTUdDvbr4qIGP1Y9fv64/fBxZ5NLd+yv3HUr389zQWhvv4fLz12+IeIyr066eFlUZ6anrtzx/+w7NnBhXp41tdb/+/Jm1eTtE5PO3b2dv3mFkZDx29fqPX78G3qty4qIr9x1Cdsr3n78YGBgevHj59cdPLwtTB0M9uNTvP38Z/v/HY9r///+F+Hgh7IMXrvz5+9fVxPDnr99HL18beK96mJmwsjBvQIpYEw1VB0O91QeOhDe0x7X1Xrn/ECK+ZPc+74r620+fZQX4SAoLoZmzZPc+n4qGH79+l4QHQ0T2nb/IxsqS6uPBxMS099zFgfcqKwtzpLPDyv2Hfv35AxFhZmKqj49a31JTHRv+/O272Zt3wJPovv72VQ2VoQ42mObEuDpNKcj6/vPnnK07GBgY3n76fOHOPX1lJRF+Pi152dM3bn3+9m3gS2AfSzNmJqZPX6FOOXvrzoIde37++q2rqMDDycnJzkakOdoKcvYGukcuX3v65u2B85f+//9/+sYtx4KKK/cf/vn79+DFK/QugTEBGytLpLPDlPWbIVw+Lq7jV6+v3n/4779/ipISab4exBvla2W+79zFzcdOXrp7n4+ba01jFSsLy49fv4LrWveeveBjaUaeCxlHG4ajXh316qhXBxcAACRIAB/rJpdjAAAAAElFTkSuQmCC";
const BODY_PATCH_B64 = "iVBORw0KGgoAAAANSUhEUgAAAEcAAAANCAIAAAB0EeRCAAACHUlEQVR42mP8tXw+w7ADTAzDEQxrX73+/Dl30QoIw7Gt7/DN2wwMDH///YubOf/vv3+dW3Z6905JnL3wwsPHcDWObX2BE6avOXUOrh0uHjBh+ooTp+F29G7bnb9k1QDHlYyQ4PLjZ/7DuMdu33356fOyzOTmYL9jd+5BBHVkpPZXFU2Jj1x89MT3X7/heiHi0xOilh8//e3XLwYGhj9//557+PjHr9+vPn0eSF8J83BrSIkfvXUHwuVkY+Pn5ODj4pQREsxytkfRzMjIwMDAyIhuAiMjIyszM0T2+J372tKSNuoqe65ep5uvWLCKRlma1a/bbKmixMDAYKIo//rzl/ZN2xkZGF10NEyVFBgYGK48eebY1sfPxRltZc7Byvr5xw+IRog4AwNDkacLBysrAwPDnqvXHTXV5YQFWzZuj7I0G0hfifDyqEqIHbt9F8L11NP21NP+9edP5oJlyuKikJQ2OS4CU6OOjNSk2PDjd+4vPnLCx1Dv28+fZ+4/LPdx52Jj+/H7991Xr5XFRAfMV9DoWruZgYHh0I3bH79/d9RUf//128dv33/8+s3KwozHREZGRitVpX3Xbpy4c+/912/ffv7y7pkCkdpz5bqy04D6SoyPV01S7PzDx6ZKCjP2HZy1/zArM3OAsYGUoMDrz4TzfYSF6aRd+1iYmFpDA6xUlRgYGB6+eVe5an2aoy0jZkakNmAcbVuM+mpAAQDCrt7hgTpj3AAAAABJRU5ErkJggg==";

async function main() {
  if (!fs.existsSync(INDEX_PATH)) throw new Error(`Arquivo ${INDEX_PATH} não encontrado.`);

  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  const re = /data:image\/(webp|png|jpe?g);base64,([A-Za-z0-9+/=]+)/gi;
  const matches = [...html.matchAll(re)];
  if (!matches.length) throw new Error('Nenhuma imagem raster embutida foi encontrada no index.html.');

  const candidates = [];
  for (const m of matches) {
    try {
      const meta = await sharp(Buffer.from(m[2], 'base64')).metadata();
      const ratio = meta.width && meta.height ? meta.width / meta.height : 0;
      if (meta.width >= 400 && meta.height >= 150 && ratio > 2.40 && ratio < 2.60) {
        candidates.push({ match: m, width: meta.width, height: meta.height });
      }
    } catch (_) {}
  }

  if (!candidates.length) throw new Error('Nenhuma arte horizontal compatível com o Presente 03 foi localizada.');

  // As artes dos presentes aparecem em sequência no HTML; o Presente 03 é a última arte horizontal desse grupo.
  const chosen = candidates[candidates.length - 1];
  const target = chosen.match;
  const input = Buffer.from(target[2], 'base64');
  const sx = chosen.width / 500;
  const sy = chosen.height / 200;

  const badgePatch = await sharp(Buffer.from(BADGE_PATCH_B64, 'base64'))
    .resize(Math.round(78 * sx), Math.round(16 * sy))
    .png()
    .toBuffer();

  const bodyPatch = await sharp(Buffer.from(BODY_PATCH_B64, 'base64'))
    .resize(Math.round(71 * sx), Math.round(13 * sy))
    .png()
    .toBuffer();

  const output = await sharp(input)
    .composite([
      { input: badgePatch, left: Math.round(332 * sx), top: Math.round(28 * sy) },
      { input: bodyPatch, left: Math.round(230 * sx), top: Math.round(132 * sy) }
    ])
    .webp({ quality: 96, smartSubsample: true })
    .toBuffer();

  const newDataUri = `data:image/webp;base64,${output.toString('base64')}`;
  const next = html.replace(target[0], newDataUri);
  if (next === html) throw new Error('A substituição da arte não alterou o HTML.');

  fs.writeFileSync(INDEX_PATH, next, 'utf8');
  console.log(`[INSPIRA] Presente 03 corrigido. Arte: ${chosen.width}x${chosen.height}. Candidatas horizontais: ${candidates.length}.`);
}

main().catch((err) => {
  console.error('[INSPIRA] Falha ao corrigir a arte:', err);
  process.exit(1);
});
