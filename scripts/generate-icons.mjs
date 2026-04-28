/**
 * SVGアイコンから必要なサイズのPNGを生成する。
 *
 * 使い方:
 *   npm install --save-dev sharp
 *   node scripts/generate-icons.mjs
 *
 * `sharp` を任意の依存にしているため、初回のみインストールが必要。
 * 生成されたPNGは public/icons に配置される。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const SRC = path.join(ROOT, 'public/icons/icon.svg');
const SRC_MASK = path.join(ROOT, 'public/icons/icon-maskable.svg');
const OUT = path.join(ROOT, 'public/icons');

const targets = [
  { src: SRC, name: 'icon-192.png', size: 192 },
  { src: SRC, name: 'icon-512.png', size: 512 },
  { src: SRC_MASK, name: 'maskable-512.png', size: 512 },
  { src: SRC, name: 'apple-touch-icon.png', size: 180 }
];

async function main() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error(
      'sharp が見つかりません。次のコマンドでインストールしてください:\n  npm install --save-dev sharp'
    );
    process.exit(1);
  }

  for (const t of targets) {
    const out = path.join(OUT, t.name);
    const svg = await fs.readFile(t.src);
    await sharp(svg).resize(t.size, t.size).png().toFile(out);
    console.log('  ✔', t.name);
  }
  console.log('完了: public/icons/ に PNG を生成しました');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
