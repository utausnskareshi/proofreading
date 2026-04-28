/**
 * 「ですます調」と「である調・常体」の混在を検出
 * 「語調・トーンの統一」をカバー。
 *
 * 検出方法:
 *   1. 文末の表現を解析して文体を分類（desumasu / dearu / unknown）
 *   2. 多数派と異なる文体の文末を指摘する
 */

// ですます調（敬体）
const DESUMASU_PATTERNS = [
  /です(?:ね|よ|か)?$/,
  /ます(?:ね|よ|か)?$/,
  /でした$/,
  /ました$/,
  /でしょう$/,
  /ましょう$/,
  /ません$/
];

// である調・常体（普通体）の代表パターン
// 動詞の終止形・連体形（〜る／〜た／〜ない／〜だ／〜である）など
const DEARU_PATTERNS = [
  /である$/,
  /であった$/,
  /だった$/,
  /(?<![くぐ])だ$/,           // 「〜だ」（形容動詞・名詞＋だ）
  /(?:[うくぐすつぬぶむゆる])$/, // 動詞の終止形（う/く/ぐ/す/つ/ぬ/ぶ/む/ゆ/る）
  /(?:[ぁ-ん]ない)$/,         // 「〜ない」
  /(?:[ぁ-ん]た)$/,           // 「〜た」（過去）
  /[一-鿿]た$/                // 漢字＋た
];

function classifySentence(s) {
  // 末尾の句読点と空白を除去
  const trimmed = s.replace(/[。！？!?\s]+$/u, '');
  if (!trimmed) return 'empty';
  for (const re of DESUMASU_PATTERNS) {
    if (re.test(trimmed)) return 'desumasu';
  }
  for (const re of DEARU_PATTERNS) {
    if (re.test(trimmed)) return 'dearu';
  }
  return 'unknown';
}

export const ruleNoMixDearuDesumasu = {
  id: 'no-mix-dearu-desumasu',
  description: '「です・ます調」と「である・常体」の混在を検出',
  defaultSeverity: 'warning',

  async run({ text }) {
    const messages = [];
    const sentenceRe = /[^。！？!?]+[。！？!?]?/gu;
    const sentences = [];
    let m;
    while ((m = sentenceRe.exec(text)) !== null) {
      const s = m[0];
      if (s.trim() === '') continue;
      sentences.push({
        text: s,
        index: m.index,
        type: classifySentence(s)
      });
    }

    const desumasuCount = sentences.filter((s) => s.type === 'desumasu').length;
    const dearuCount = sentences.filter((s) => s.type === 'dearu').length;
    if (desumasuCount === 0 || dearuCount === 0) return messages;

    // 多数派を主流とする
    const dominant = desumasuCount >= dearuCount ? 'desumasu' : 'dearu';
    const minorityType = dominant === 'desumasu' ? 'dearu' : 'desumasu';
    const minorityLabel = minorityType === 'desumasu' ? 'ですます調' : 'である調・常体';
    const dominantLabel = dominant === 'desumasu' ? 'ですます調' : 'である調・常体';

    for (const s of sentences) {
      if (s.type !== minorityType) continue;
      // 文末の最後の数文字を強調
      const tail = s.text.replace(/[。！？!?\s]+$/u, '');
      const tailStart = s.index + (s.text.length - tail.length - 1 < 0 ? 0 : 0);
      // 末尾7文字くらいをハイライトする
      const hlLength = Math.min(8, tail.length);
      const hlIndex = s.index + (tail.length - hlLength);
      messages.push({
        ruleId: 'no-mix-dearu-desumasu',
        severity: 'warning',
        message: `${minorityLabel}の文が混在しています（主流は ${dominantLabel}）。文体を統一してください。`,
        index: hlIndex,
        length: hlLength
      });
    }
    return messages;
  }
};
