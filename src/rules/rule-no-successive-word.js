/**
 * 同じ単語の連続使用を検出
 * 例: 「とてもとても」「すごくすごく」
 * 「冗長表現の削減」をカバー。
 */

export const ruleNoSuccessiveWord = {
  id: 'no-successive-word',
  description: '同じ単語の連続使用を検出',
  defaultSeverity: 'warning',

  async run({ tokens }) {
    const messages = [];
    for (let i = 1; i < tokens.length; i++) {
      const prev = tokens[i - 1];
      const cur = tokens[i];
      // 名詞・副詞・形容詞のみ対象。記号や助詞の連続はノイズ
      const targetPos = ['名詞', '副詞', '形容詞', '動詞'];
      if (!targetPos.includes(cur.pos)) continue;
      if (cur.surface_form !== prev.surface_form) continue;
      if (cur.surface_form.length < 2) continue;

      messages.push({
        ruleId: 'no-successive-word',
        severity: 'warning',
        message: `同じ単語「${cur.surface_form}」が連続しています。`,
        index: cur.word_position - 1,
        length: cur.surface_form.length,
        fix: { text: '' }
      });
    }
    return messages;
  }
};
