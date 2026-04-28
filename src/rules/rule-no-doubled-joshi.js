/**
 * 同じ助詞の連続使用を検出（「が」「に」「を」「で」「は」など）
 * 例: 「私は彼は好きだ」「資料を確認をお願いします」
 * 「文法・助詞の誤り」をカバー。
 */

const TARGET_JOSHI = new Set(['が', 'を', 'に', 'は', 'で', 'と', 'も']);
const SENTENCE_END = /[。！？!?]/u;

export const ruleNoDoubledJoshi = {
  id: 'no-doubled-joshi',
  description: '同一助詞の連続使用を検出',
  defaultSeverity: 'warning',

  async run({ tokens, text }) {
    const messages = [];
    const seen = new Map(); // joshi -> token

    for (const tok of tokens) {
      // 文末でリセット
      if (tok.surface_form && SENTENCE_END.test(tok.surface_form)) {
        seen.clear();
        continue;
      }
      if (tok.pos !== '助詞') continue;
      if (!TARGET_JOSHI.has(tok.surface_form)) continue;

      if (seen.has(tok.surface_form)) {
        const prev = seen.get(tok.surface_form);
        // 同一助詞が同一文中で2回以上現れた場合に警告
        const distance = tok.word_position - prev.word_position;
        if (distance > 0 && distance < 50) {
          messages.push({
            ruleId: 'no-doubled-joshi',
            severity: 'warning',
            message: `同じ助詞「${tok.surface_form}」が短い間隔で繰り返されています。文を分けるか言い換えを検討してください。`,
            index: tok.word_position - 1, // kuromoji は 1-origin
            length: tok.surface_form.length
          });
        }
      }
      seen.set(tok.surface_form, tok);
    }

    return messages;
  }
};
