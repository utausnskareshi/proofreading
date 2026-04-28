/**
 * 1文の長さチェック
 * 80文字を超える長文を warning、120文字超で error。
 * 「文の構造・わかりやすさ」をカバー。
 */
export const ruleSentenceLength = {
  id: 'sentence-length',
  description: '一文の長さが長すぎないかチェック',
  defaultSeverity: 'warning',

  async run({ text }) {
    const messages = [];
    const re = /[^。！？!?]+[。！？!?]?/gu;
    let m;
    while ((m = re.exec(text)) !== null) {
      const sentence = m[0];
      const trimmed = sentence.replace(/\s+$/u, '');
      if (trimmed.length === 0) continue;
      if (trimmed.length > 120) {
        messages.push({
          ruleId: 'sentence-length',
          severity: 'error',
          message: `一文が長すぎます（${trimmed.length}文字）。100文字程度を目安に分割してください。`,
          index: m.index,
          length: trimmed.length
        });
      } else if (trimmed.length > 80) {
        messages.push({
          ruleId: 'sentence-length',
          severity: 'warning',
          message: `一文がやや長めです（${trimmed.length}文字）。読みやすさのため分割を検討してください。`,
          index: m.index,
          length: trimmed.length
        });
      }
    }
    return messages;
  }
};
