/**
 * 冗長表現の検出（自動修正可）
 * 「冗長表現の削減」をカバー。
 */

const PATTERNS = [
  // 「〜することができる」→「〜できる」
  { pattern: /([ぁ-んァ-ン一-鿿]{1,8}?)することができ(る|ます)/g, replace: (_, v, e) => `${v}でき${e === 'ます' ? 'ます' : 'る'}`, message: '「〜することができる」は「〜できる」と簡潔にできます' },
  { pattern: /することが可能(です|だ|である)/g, replace: '可能$1', message: '「〜することが可能」は冗長です' },
  // 重複表現
  { pattern: /まず最初に/g, replace: 'まず', message: '「まず最初に」は重複表現です。「まず」または「最初に」のみで十分です' },
  { pattern: /いちばん最初/g, replace: '最初', message: '「いちばん最初」は重複表現です' },
  { pattern: /過半数を超え/g, replace: '半数を超え', message: '「過半数を超える」は重複表現です' },
  { pattern: /従来から/g, replace: '従来', message: '「従来から」は重複表現です' },
  { pattern: /射程距離/g, replace: '射程', message: '「射程距離」は重複表現です' },
  { pattern: /頭痛が痛い/g, replace: '頭が痛い', message: '「頭痛が痛い」は重複表現です' },
  // ビジネス文書の冗長
  { pattern: /行うことに/g, replace: 'することに', message: '「行うこと」は「すること」で十分な場合があります', severity: 'info' },
  { pattern: /〜という事/g, replace: 'ということ', message: '形式名詞「こと」は通常ひらがなで書きます' },
  // 「〜というふうに」
  { pattern: /というふうに/g, replace: 'というように', message: '「というふうに」は冗長です' }
];

export const ruleRedundantExpression = {
  id: 'redundant-expression',
  description: '冗長な日本語表現を検出',
  defaultSeverity: 'info',

  async run({ text }) {
    const messages = [];
    for (const p of PATTERNS) {
      let m;
      const re = new RegExp(p.pattern.source, p.pattern.flags);
      while ((m = re.exec(text)) !== null) {
        const matched = m[0];
        const fixText = typeof p.replace === 'function'
          ? p.replace(matched, ...m.slice(1))
          : matched.replace(p.pattern, p.replace);
        messages.push({
          ruleId: 'redundant-expression',
          severity: p.severity || 'info',
          message: p.message,
          index: m.index,
          length: matched.length,
          fix: { text: fixText }
        });
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    }
    return messages;
  }
};
