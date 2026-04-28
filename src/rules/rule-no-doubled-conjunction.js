/**
 * 同じ接続詞の連続使用を検出
 * 例: 「しかし、〜。しかし、〜。」
 * 「論理構成」をカバー。
 */

const CONJUNCTIONS = [
  'しかし', 'けれども', 'だが', 'でも',
  'また', 'さらに', 'そして',
  'つまり', 'すなわち',
  'なぜなら', 'というのは',
  'したがって', 'よって', 'そのため',
  'ところで', 'ちなみに'
];

export const ruleNoDoubledConjunction = {
  id: 'no-doubled-conjunction',
  description: '同じ接続詞の連続使用を検出',
  defaultSeverity: 'warning',

  async run({ text }) {
    const messages = [];
    let lastConj = null;
    let lastIndex = -1;

    // 文ごとに先頭の接続詞を抽出
    const sentences = text.split(/(?<=[。！？!?])/u);
    let pos = 0;
    for (const s of sentences) {
      const trimmed = s.trimStart();
      const offset = s.length - trimmed.length;
      for (const conj of CONJUNCTIONS) {
        if (trimmed.startsWith(conj)) {
          if (lastConj === conj && lastIndex !== -1) {
            messages.push({
              ruleId: 'no-doubled-conjunction',
              severity: 'warning',
              message: `直前の文と同じ接続詞「${conj}」が続いています。表現を変えるか文を統合してください。`,
              index: pos + offset,
              length: conj.length
            });
          }
          lastConj = conj;
          lastIndex = pos + offset;
          break;
        }
      }
      pos += s.length;
    }

    return messages;
  }
};
