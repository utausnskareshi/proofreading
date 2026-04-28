/**
 * カッコ・引用符の閉じ忘れ・不一致を検出
 *
 * 対応する記号:
 *   () （） 「」 『』 【】 [] {} 〈〉 《》 “” ‘’ "" ''
 *
 * 「句読点・記号の適正化」をカバー。
 */

const PAIRS = [
  { open: '(', close: ')', name: '半角丸カッコ' },
  { open: '（', close: '）', name: '全角丸カッコ' },
  { open: '「', close: '」', name: 'カギカッコ' },
  { open: '『', close: '』', name: '二重カギカッコ' },
  { open: '【', close: '】', name: '隅付きパーレン' },
  { open: '[', close: ']', name: '角カッコ' },
  { open: '［', close: '］', name: '全角角カッコ' },
  { open: '{', close: '}', name: '波カッコ' },
  { open: '｛', close: '｝', name: '全角波カッコ' },
  { open: '〈', close: '〉', name: '山カッコ' },
  { open: '《', close: '》', name: '二重山カッコ' },
  { open: '“', close: '”', name: 'ダブルクォート' },
  { open: '‘', close: '’', name: 'シングルクォート' }
];

const OPENS = new Set(PAIRS.map((p) => p.open));
const CLOSES = new Set(PAIRS.map((p) => p.close));
const OPEN_TO_CLOSE = new Map(PAIRS.map((p) => [p.open, p.close]));
const CLOSE_TO_OPEN = new Map(PAIRS.map((p) => [p.close, p.open]));
const NAME_OF = new Map(PAIRS.flatMap((p) => [[p.open, p.name], [p.close, p.name]]));

export const ruleBracketMatching = {
  id: 'bracket-matching',
  description: 'カッコ・引用符の閉じ忘れ・不一致を検出',
  defaultSeverity: 'error',

  async run({ text }) {
    const messages = [];
    const stack = []; // {char, index}

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (OPENS.has(ch)) {
        stack.push({ char: ch, index: i });
      } else if (CLOSES.has(ch)) {
        const expected = CLOSE_TO_OPEN.get(ch);
        const top = stack[stack.length - 1];
        if (!top) {
          // 閉じカッコだけがある（開きがない）
          messages.push({
            ruleId: 'bracket-matching/orphan-close',
            severity: 'error',
            message: `${NAME_OF.get(ch)}「${ch}」に対応する開きカッコがありません`,
            index: i,
            length: 1
          });
        } else if (top.char !== expected) {
          // 種類が一致しない
          messages.push({
            ruleId: 'bracket-matching/mismatch',
            severity: 'error',
            message: `${NAME_OF.get(top.char)}「${top.char}」が ${NAME_OF.get(ch)}「${ch}」で閉じられています。種類を揃えてください`,
            index: top.index,
            length: 1
          });
          stack.pop();
        } else {
          stack.pop();
        }
      }
    }

    // 閉じられていない開きカッコ
    for (const o of stack) {
      messages.push({
        ruleId: 'bracket-matching/unclosed',
        severity: 'error',
        message: `${NAME_OF.get(o.char)}「${o.char}」が閉じられていません。対応する「${OPEN_TO_CLOSE.get(o.char)}」を追加してください`,
        index: o.index,
        length: 1
      });
    }

    // ストレートクォート（"' ）の偶奇チェック（ペアになっているか）
    const straightDouble = (text.match(/"/g) || []).length;
    const straightSingle = (text.match(/'/g) || []).length;
    if (straightDouble % 2 !== 0) {
      const lastIdx = text.lastIndexOf('"');
      messages.push({
        ruleId: 'bracket-matching/quote-unbalanced',
        severity: 'warning',
        message: `ダブルクォート (") の数が奇数です。閉じ忘れの可能性があります`,
        index: lastIdx >= 0 ? lastIdx : 0,
        length: 1
      });
    }
    if (straightSingle % 2 !== 0) {
      const lastIdx = text.lastIndexOf("'");
      messages.push({
        ruleId: 'bracket-matching/quote-unbalanced',
        severity: 'info',
        message: `シングルクォート (') の数が奇数です（アポストロフィの場合は無視してください）`,
        index: lastIdx >= 0 ? lastIdx : 0,
        length: 1
      });
    }

    return messages;
  }
};
