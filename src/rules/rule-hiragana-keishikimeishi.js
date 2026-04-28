/**
 * 形式名詞の漢字使用を検出
 * 「事」「物」「時」「所」など、形式名詞として使う場合はひらがなが推奨される。
 * 「語彙の適切さ」をカバー。
 */

const PATTERNS = [
  // 「〜する事」→「〜すること」
  { regex: /([ぁ-ん一-鿿ー]{1,8})する事(?![質物])/g, expected: 'すること', label: '事' },
  { regex: /([ぁ-ん一-鿿ー]{1,8})した事(?![質物])/g, expected: 'したこと', label: '事' },
  // 「〜する時」→「〜するとき」
  { regex: /する時(?![計間期点])/g, expected: 'するとき', label: '時' },
  { regex: /した時(?![計間期点])/g, expected: 'したとき', label: '時' },
  // 「〜出来る」→「〜できる」
  { regex: /出来(る|ます|た|ました|ない|ません)/g, expected: 'でき$1', label: '出来' },
  // 「下さい」→「ください」（補助動詞用法）
  { regex: /([ぁ-んァ-ン一-鿿ー]+て)下さい/g, expected: '$1ください', label: '下さい' },
  // 「〜という風に」
  { regex: /という風に/g, expected: 'というように', label: '風' },
  // 「〜の様な」
  { regex: /の様な/g, expected: 'のような', label: '様' },
  { regex: /の様に/g, expected: 'のように', label: '様' }
];

export const ruleHiraganaKeishikimeishi = {
  id: 'hiragana-keishikimeishi',
  description: '形式名詞・補助動詞の漢字使用を検出（ひらがな推奨）',
  defaultSeverity: 'info',

  async run({ text }) {
    const messages = [];
    for (const p of PATTERNS) {
      let m;
      const re = new RegExp(p.regex.source, p.regex.flags);
      while ((m = re.exec(text)) !== null) {
        const matched = m[0];
        const fixText = matched.replace(p.regex, p.expected);
        messages.push({
          ruleId: `hiragana-keishikimeishi/${p.label}`,
          severity: 'info',
          message: `形式名詞・補助動詞は通常ひらがなで書きます（「${matched}」→「${fixText}」）。`,
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
