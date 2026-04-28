/**
 * 校正エンジン本体
 *
 * textlint と互換のルール思想で実装した、ブラウザネイティブの校正器。
 * - kuromoji.js による形態素解析を共通基盤として、
 *   各カテゴリ（誤字・冗長・文法など）のルールを並列適用する。
 * - 辞書（prh形式互換）はストレージから読み込み、有効な辞書だけを適用。
 * - 結果は { ruleId, severity, message, index, length, fix? } の配列で返す。
 *
 * 将来 textlint のブラウザビルドに置き換えても呼び出し側が変わらないよう、
 * インターフェースを runProofread(text, onProgress) に統一している。
 */
import { ensureKuromoji } from './kuromoji-loader.js';
import { listDictionaries, listIgnoreEntries, getSetting } from './storage.js';
import { rules } from './rules/index.js';

export async function runProofread(text, onProgress = () => {}) {
  onProgress(2, '形態素解析エンジンを準備中...');
  // 辞書ダウンロードの進捗を kuromoji ローダーから受け取って 0〜70% に割り当てる
  const tokenizer = await ensureKuromoji((p) => {
    // p.percent: 0〜100（辞書側の進捗）
    const mapped = Math.round(2 + p.percent * 0.68); // 2〜70%
    onProgress(mapped, p.label);
  });

  onProgress(72, '前処理中...');
  const markdownAware = await getSetting('markdownAware', true);
  // index を維持したままコードブロック・インラインコードを空白化
  const processed = markdownAware ? maskMarkdownCode(text) : text;

  onProgress(74, '辞書を読み込み中...');
  const allDicts = await listDictionaries();
  const enabledDicts = allDicts.filter((d) => d.enabled);

  onProgress(76, '無視リストを読み込み中...');
  const ignoreList = await listIgnoreEntries();

  onProgress(80, '形態素解析中...');
  const tokens = tokenizer.tokenize(processed);

  onProgress(85, 'ルールを適用中...');
  const messages = [];
  let progress = 85;
  const step = 12 / rules.length; // 85〜97% に割当

  for (const rule of rules) {
    try {
      // ルールには前処理後のテキスト（コードブロックがマスクされたもの）を渡す
      const found = await rule.run({ text: processed, tokens, dictionaries: enabledDicts });
      for (const m of found) messages.push(m);
    } catch (err) {
      console.warn(`Rule "${rule.id}" failed:`, err);
    }
    progress += step;
    onProgress(Math.round(progress), `ルールを適用中... (${rule.id})`);
  }

  onProgress(98, '結果を整理中...');
  // 無視リスト適用（key: ruleId:該当文字列 で一致するものを除外）
  const filtered = messages.filter((m) => {
    const target = text.slice(m.index, m.index + m.length);
    return !ignoreList.some((ig) => ig.ruleId === m.ruleId && ig.pattern === target);
  });

  // index 昇順 + severity 降順
  filtered.sort((a, b) => a.index - b.index || sevWeight(b.severity) - sevWeight(a.severity));
  onProgress(100, '完了');
  return filtered;
}

function sevWeight(s) {
  return { error: 3, warning: 2, info: 1 }[s] ?? 0;
}

/**
 * Markdown のコードブロック・インラインコード・URL を空白で置換する。
 * 文字数（インデックス）は保持する。
 */
function maskMarkdownCode(text) {
  const replacers = [
    /```[\s\S]*?```/g,         // フェンスドコードブロック
    /`[^`\n]*`/g,              // インラインコード
    /\bhttps?:\/\/\S+/g,       // URL
    /\!\[[^\]]*\]\([^)]*\)/g,  // 画像
    /\[[^\]]*\]\([^)]*\)/g     // リンク（テキストはそのまま残してもよいが今回は除外）
  ];
  let out = text;
  for (const re of replacers) {
    out = out.replace(re, (m) => ' '.repeat(m.length));
  }
  return out;
}
