/**
 * 主語と述語のねじれの簡易検出
 * 「文法・助詞の誤り」をカバー。
 *
 * 完全な構文解析は行わず、典型的な誤用パターンを正規表現で検出する。
 */

const PATTERNS = [
  {
    pattern: /(私の夢は|目的は|理由は|原因は|目標は|趣味は)([^。！？!?]{2,40}?)(です|だ|である)。/g,
    test: (_, head, body) => {
      // 「私の夢は◯◯することです」のように「こと/もの」で受けていないと違和感がある
      return !/(こと|もの|ため|点|事|もの|ところ)$/.test(body);
    },
    message: '主語と述語の対応を確認してください。「〜は…することです」のように体言で受けると自然です。'
  },
  {
    pattern: /(なぜならば?|というのは)[^。！？!?]+[^かだ]。/g,
    message: '「なぜなら〜から（だ）」「というのは〜からだ」と呼応させると自然です。'
  }
];

export const ruleSubjectPredicate = {
  id: 'subject-predicate',
  description: '主語と述語のねじれの簡易検出',
  defaultSeverity: 'warning',

  async run({ text }) {
    const messages = [];
    for (const p of PATTERNS) {
      let m;
      const re = new RegExp(p.pattern.source, p.pattern.flags);
      while ((m = re.exec(text)) !== null) {
        if (p.test && !p.test(...m)) continue;
        messages.push({
          ruleId: 'subject-predicate',
          severity: 'warning',
          message: p.message,
          index: m.index,
          length: m[0].length
        });
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    }
    return messages;
  }
};
