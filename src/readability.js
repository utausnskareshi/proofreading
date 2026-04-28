/**
 * 簡易の読みやすさスコア計算
 * - 文字数 / 文の数 / 平均文長 / 漢字率を集計し総合スコア(0-100)を出す
 *
 * 文字数は「改行・空白を除いた実文字数」をカウント。
 * （上部の文字数カウンタ（30,000文字制限）は textarea の maxlength と一致させるため
 *   改行込みでカウントしているが、本スコアでは平均文長や漢字率の指標を正確にするため
 *   実文字数に統一する）
 */

const KANJI_RE = /[一-鿿]/u;
const SENTENCE_SPLIT = /[。！？\?!]+/u;
const WHITESPACE_RE = /\s/u;

export function computeReadability(text) {
  // 改行・空白・タブ等をすべて除外した実文字数と漢字数を一括集計
  let chars = 0;
  let kanji = 0;
  for (const ch of text) {
    if (WHITESPACE_RE.test(ch)) continue;
    chars++;
    if (KANJI_RE.test(ch)) kanji++;
  }

  const sentences = text
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter((s) => s.length > 0).length || 1;

  const avgSentenceLength = chars / sentences;
  const kanjiRatio = chars > 0 ? kanji / chars : 0;

  // ヒューリスティクス
  // - 平均文長: 30〜50文字を理想（短くても長くてもスコア低下）
  // - 漢字率: 0.25〜0.35を理想（30%前後が読みやすいとされる）
  const lenScore = clamp(100 - Math.abs(avgSentenceLength - 40) * 1.5, 0, 100);
  const kanjiScore = clamp(100 - Math.abs(kanjiRatio - 0.3) * 300, 0, 100);
  const score = Math.round((lenScore + kanjiScore) / 2);

  return { chars, sentences, avgSentenceLength, kanjiRatio, score };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
