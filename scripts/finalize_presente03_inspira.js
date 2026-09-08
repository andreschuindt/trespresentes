const fs = require('fs');
const sharp = require('sharp');

const INDEX_PATH = 'index.html';

const BADGE_PATCH_B64 = "iVBORw0KGgoAAAANSUhEUgAAAE4AAAAQCAIAAAA3TN7NAAACZElEQVR42mP8vWEFw8gATAwjBox6dTgCFvK03X/+MqmzP8bVyclIP6mzn5+be0V9OQcbW2h9m4q0VHtaAgMDw4xN23acPPv1xw8hXp6C0AAJIaGkzn4GBgZGRkYRfr4wR9sQexs0cxgYGJiZmCSEBNN8Pe30dSB2Vcyaf/LaTUdDvbr4qIGP1Y9fv64/fBxZ5NLd+yv3HUr389zQWhvv4fLz12+IeIyr066eFlUZ6anrtzx/+w7NnBhXp41tdb/+/Jm1eTtE5PO3b2dv3mFkZDx29fqPX78G3qty4qIr9x1Cdsr3n78YGBgevHj59cdPLwtTB0M9uNTvP38Z/v/HY9r///+F+Hgh7IMXrvz5+9fVxPDnr99HL18beK96mJmwsjBvQIpYEw1VB0O91QeOhDe0x7X1Xrn/ECK+ZPc+74r620+fZQX4SAoLoZmzZPc+n4qGH79+l4QHQ0T2nb/IxsqS6uPBxMS099zFgfcqKwtzpLPDyv2Hfv35AxFhZmKqj49a31JTHRv+/O272Zt3wJPovv72VQ2VoQ42mObEuDpNKcj6/vPnnK07GBgY3n76fOHOPX1lJRF+Pi152dM3bn3+9m3gS2AfSzNmJqZPX6FOOXvrzoIde37++q2rqMDDycnJzkakOdoKcvYGukcuX3v65u2B85f+//9/+sYtx4KKK/cf/vn79+DFK/QugTEBGytLpLPDlPWbIVw+Lq7jV6+v3n/4779/ipISab4exBvla2W+79zFzcdOXrp7n4+ba01jFSsLy49fv4LrWveeveBjaUaeCxlHG4ajXh316qhXBxcAACRIAB/rJpdjAAAAAElFTkSuQmCC";
const BODY_PATCH_B64 = "iVBORw0KGgoAAAANSUhEUgAAAEcAAAANCAIAAAB0EeRCAAACHUlEQVR42mP8tXw+w7ADTAzDEQxrX73+/Dl30QoIw7Gt7/DN2wwMDH///YubOf/vv3+dW3Z6905JnL3wwsPHcDWObX2BE6avOXUOrh0uHjBh+ooTp+F29G7bnb9k1QDHlYyQ4PLjZ/7DuMdu33356fOyzOTmYL9jd+5BBHVkpPZXFU2Jj1x89MT3X7/heiHi0xOilh8//e3XLwYGhj9//557+PjHr9+vPn0eSF8J83BrSIkfvXUHwuVkY+Pn5ODj4pQREsxytkfRzMjIwMDAyIhuAiMjIyszM0T2+J372tKSNuoqe65ep5uvWLCKRlma1a/bbKmixMDAYKIo//rzl/ZN2xkZGF10NEyVFBgYGK48eebY1sfPxRltZc7Byvr5xw+IRog4AwNDkacLBysrAwPDnqvXHTXV5YQFWzZuj7I0G0hfifDyqEqIHbt9F8L11NP21NP+9edP5oJlyuKikJQ2OS4CU6OOjNSk2PDjd+4vPnLCx1Dv28+fZ+4/LPdx52Jj+/H7991Xr5XFRAfMV9DoWruZgYHh0I3bH79/d9RUf//128dv33/8+s3KwozHREZGRitVpX3Xbpy4c+/912/ffv7y7pkCkdpz5bqy04D6SoyPV01S7PzDx6ZKCjP2HZy1/zArM3OAsYGUoMDrz4TzfYSF6aRd+1iYmFpDA6xUlRgYGB6+eVe5an2aoy0jZkakNmAcbVuM+mpAAQDCrt7hgTpj3AAAAABJRU5ErkJggg==";

function isPink(r, g, b) {
  return r >= 205 && g >= 105 && b >= 105 && r >= g + 25 && r >= b + 20;
}

async function pinkRatio(input) {
  const { data, info } = await sharp(input)
    .resize(100, 40, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let pink = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (isPink(data[i], data[i + 1], data[i + 2])) pink++;
  }
  return pink / (info.width * info.height);
}

async function makePatch(b64, width, height) {
  return sharp(Buffer.from(b64, 'base64'))
    .resize(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)), {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3
    })
    .png()
    .toBuffer();
}

async function patchIsolated(input, width, height) {
  const sx = width / 500;
  const sy = height / 200;
  const badge = await makePatch(BADGE_PATCH_B64, 78 * sx, 16 * sy);
  const body = await makePatch(BODY_PATCH_B64, 71 * sx, 13 * sy);

  return sharp(input)
    .composite([
      { input: badge, left: Math.round(332 * sx), top: Math.round(28 * sy) },
      { input: body, left: Math.round(230 * sx), top: Math.round(132 * sy) }
    ])
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
}

async function findBottomPinkCard(input, width, height) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const rowCounts = new Int32Array(height);
  const startY = Math.floor(height * 0.55);

  for (let y = startY; y < height; y++) {
    let count = 0;
    let p = (y * width) * channels;
    for (let x = 0; x < width; x++, p += channels) {
      if (isPink(data[p], data[p + 1], data[p + 2])) count++;
    }
    rowCounts[y] = count;
  }

  const rowThreshold = Math.floor(width * 0.28);
  const ys = [];
  for (let y = startY; y < height; y++) if (rowCounts[y] >= rowThreshold) ys.push(y);
  if (!ys.length) return null;

  let y0 = ys[0], y1 = ys[ys.length - 1];
  const colCounts = new Int32Array(width);
  for (let y = y0; y <= y1; y++) {
    let p = (y * width) * channels;
    for (let x = 0; x < width; x++, p += channels) {
      if (isPink(data[p], data[p + 1], data[p + 2])) colCounts[x]++;
    }
  }

  const cardH = y1 - y0 + 1;
  const colThreshold = Math.floor(cardH * 0.42);
  const xs = [];
  for (let x = 0; x < width; x++) if (colCounts[x] >= colThreshold) xs.push(x);
  if (!xs.length) return null;

  let x0 = xs[0], x1 = xs[xs.length - 1];

  const denseThreshold = Math.floor(cardH * 0.60);
  const dense = [];
  for (let x = x0; x <= x1; x++) if (colCounts[x] >= denseThreshold) dense.push(x);
  if (dense.length > 20) {
    x0 = dense[0];
    x1 = dense[dense.length - 1];
  }

  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

async function patchFullStack(input, width, height) {
  let box = await findBottomPinkCard(input, width, height);

  if (!box || box.w < width * 0.45 || box.h < height * 0.12) {
    box = {
      x: Math.round(width * 0.108),
      y: Math.round(height * 0.675),
      w: Math.round(width * 0.752),
      h: Math.round(height * 0.250)
    };
  }

  const sx = box.w / 77;
  const sy = box.h / 31;

  const badgeLeft = Math.round(box.x + (66.4 - 11) * sx);
  const badgeTop  = Math.round(box.y + (5.6 - 2) * sy);
  const bodyLeft  = Math.round(box.x + (46.0 - 11) * sx);
  const bodyTop   = Math.round(box.y + (26.4 - 2) * sy);

  const badge = await makePatch(BADGE_PATCH_B64, 15.6 * sx, 3.2 * sy);
  const body = await makePatch(BODY_PATCH_B64, 14.2 * sx, 2.6 * sy);

  const output = await sharp(input)
    .composite([
      { input: badge, left: badgeLeft, top: badgeTop },
      { input: body, left: bodyLeft, top: bodyTop }
    ])
    .webp({ lossless: true, effort: 6 })
    .toBuffer();

  console.log(`[INSPIRA] Hero 1122x1402: card detectado em x=${box.x}, y=${box.y}, w=${box.w}, h=${box.h}.`);
  return output;
}

async function main() {
  if (!fs.existsSync(INDEX_PATH)) throw new Error(`Arquivo ${INDEX_PATH} não encontrado.`);
  let html = fs.readFileSync(INDEX_PATH, 'utf8');

  const re = /data:image\/([^;,]+)(?:;[^,]*)*;base64,([A-Za-z0-9+/=]+)/gi;
  const matches = [...html.matchAll(re)];
  if (!matches.length) throw new Error('Nenhuma imagem embutida em base64 foi encontrada no index.html.');

  const infos = [];
  for (const m of matches) {
    try {
      const input = Buffer.from(m[2], 'base64');
      const meta = await sharp(input).metadata();
      if (!meta.width || !meta.height) continue;
      infos.push({ match: m, input, width: meta.width, height: meta.height });
    } catch (_) {}
  }

  const wide = [];
  for (const item of infos) {
    const aspect = item.width / item.height;
    if (item.width >= 300 && item.height >= 100 && item.height <= 600 && aspect >= 2.15 && aspect <= 2.9) {
      wide.push({ ...item, pink: await pinkRatio(item.input) });
    }
  }
  wide.sort((a, b) => b.pink - a.pink);
  if (wide.length && wide[0].pink > 0.22) {
    const item = wide[0];
    const output = await patchIsolated(item.input, item.width, item.height);
    const uri = `data:image/webp;base64,${output.toString('base64')}`;
    html = html.replace(item.match[0], uri);
    console.log(`[INSPIRA] Card isolado corrigido sem perda: ${item.width}x${item.height}, pink=${item.pink.toFixed(3)}.`);
  }

  const stack = infos.find(item => item.width === 1122 && item.height === 1402);
  if (stack) {
    const output = await patchFullStack(stack.input, stack.width, stack.height);
    const uri = `data:image/webp;base64,${output.toString('base64')}`;
    html = html.replace(stack.match[0], uri);
  }

  fs.writeFileSync(INDEX_PATH, html, 'utf8');
  console.log('[INSPIRA] Correção final aplicada: ALMA CUIDADA -> INSPIRA, sem recompressão com perda.');
}

main().catch((err) => {
  console.error('[INSPIRA] Falha na correção final:', err);
  process.exit(1);
});
