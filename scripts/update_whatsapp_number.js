const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SELF = path.resolve(__filename);
const ALLOWED_EXTENSIONS = new Set(['.html', '.htm', '.js', '.mjs', '.cjs', '.json', '.css', '.xml', '.txt', '.md']);
const SKIP_DIRS = new Set(['.git', '.vercel', 'node_modules']);

const replacements = [
  ['+55 22 98105-2618', '+55 19 98137-0555'],
  ['+55 (22) 98105-2618', '+55 (19) 98137-0555'],
  ['55 22 98105-2618', '55 19 98137-0555'],
  ['(22) 98105-2618', '(19) 98137-0555'],
  ['22 98105-2618', '19 98137-0555'],
  ['22 98105 2618', '19 98137 0555'],
  ['5522981052618', '5519981370555'],
  ['22981052618', '19981370555']
];

let filesChanged = 0;
let replacementsMade = 0;

function replaceAll(content) {
  let output = content;
  let count = 0;

  for (const [from, to] of replacements) {
    if (!output.includes(from)) continue;
    const parts = output.split(from);
    count += parts.length - 1;
    output = parts.join(to);
  }

  return { output, count };
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!entry.isFile() || fullPath === SELF) continue;
    if (!ALLOWED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;

    let content;
    try {
      content = fs.readFileSync(fullPath, 'utf8');
    } catch {
      continue;
    }

    const { output, count } = replaceAll(content);
    if (!count) continue;

    fs.writeFileSync(fullPath, output, 'utf8');
    filesChanged += 1;
    replacementsMade += count;
    console.log(`[WhatsApp] Atualizado: ${path.relative(ROOT, fullPath)} (${count} ocorrência(s))`);
  }
}

walk(ROOT);

console.log(`[WhatsApp] Revisão concluída: ${replacementsMade} ocorrência(s) substituída(s) em ${filesChanged} arquivo(s). Novo número: 5519981370555.`);
