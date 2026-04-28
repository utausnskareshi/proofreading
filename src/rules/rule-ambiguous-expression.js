/**
 * 曖昧表現・読み手への配慮の検出
 * - 「など」「等」「いくつか」「適宜」など曖昧な指示
 * - 二重否定
 * - 「思います」連発
 *
 * 「文の構造・わかりやすさ」「読み手への配慮」をカバー。
 */

const PATTERNS = [
  {
    regex: /(基本的に(は)?|原則として|だいたい|おおむね|たぶん|多分|おそらく|思われます?|考えられます?)/g,
    message: '曖昧な表現です。可能であれば具体的に記述してください。',
    severity: 'info'
  },
  {
    // 二重否定の代表例「ないとは言えない」「なくはない」
    regex: /(?:ないとは言えない|なくはない|ないわけではない|ないこともない)/g,
    message: '二重否定は読み手の負担になります。肯定表現に書き換えを検討してください。',
    severity: 'warning'
  },
  {
    // 「〜と思います」の3連発以上
    regex: /(と思います[。、].*?){3,}/gs,
    message: '「思います」が連発しています。断定または別の表現に置き換えてください。',
    severity: 'info'
  },
  {
    // 「適宜」「随時」など指示が曖昧
    regex: /(適宜|随時|しかるべく|よしなに)/g,
    message: '指示が曖昧です。具体的な条件や時期を示してください。',
    severity: 'info'
  }
];

export const ruleAmbiguousExpression = {
  id: 'ambiguous-expression',
  description: '曖昧表現・二重否定の検出',
  defaultSeverity: 'info',

  async run({ text }) {
    const messages = [];
    for (const p of PATTERNS) {
      let m;
      const re = new RegExp(p.regex.source, p.regex.flags);
      while ((m = re.exec(text)) !== null) {
        messages.push({
          ruleId: 'ambiguous-expression',
          severity: p.severity || 'info',
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
