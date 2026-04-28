/**
 * 数字・年月日の表記ゆれ・形式の検出
 *
 * 検出内容:
 *   - 全角数字と半角数字の混在
 *   - 「2024/3/5」「2024-3-5」「2024年3月5日」「令和6年3月5日」など日付形式の混在
 *   - 金額表記の不整合（1,000円 / 1000円）
 *   - 単位の表記ゆれ（kg/㎏、m/メートル、% /パーセント）
 *
 * 「数字・固有名詞の確認」をカバー。
 */

const KANSUUJI_FULL = /[０１２３４５６７８９]/g;
const KANSUUJI_HALF = /(?<![\w])\d+(?![\w])/g;

const DATE_PATTERNS = [
  { label: 'YYYY/M/D', re: /\d{4}\/\d{1,2}\/\d{1,2}/g },
  { label: 'YYYY-M-D', re: /\d{4}-\d{1,2}-\d{1,2}/g },
  { label: 'YYYY年M月D日', re: /\d{4}年\d{1,2}月\d{1,2}日/g },
  { label: '令和N年M月D日', re: /(令和|平成|昭和|大正|明治)\d+年\d{1,2}月\d{1,2}日/g }
];

const UNIT_GROUPS = [
  {
    canonical: 'kg',
    forms: [
      { label: 'kg', re: /\d\s*kg(?![a-z])/g },
      { label: '㎏', re: /\d\s*㎏/g },
      { label: 'キログラム', re: /\d\s*キログラム/g }
    ]
  },
  {
    canonical: '%',
    forms: [
      { label: '%', re: /\d\s*%/g },
      { label: '％', re: /\d\s*％/g },
      { label: 'パーセント', re: /\d\s*パーセント/g }
    ]
  },
  {
    canonical: 'm',
    forms: [
      { label: 'm', re: /\d\s*m(?![a-zA-Z])/g },
      { label: 'メートル', re: /\d\s*メートル/g }
    ]
  }
];

export const ruleNumberFormat = {
  id: 'number-format',
  description: '全角・半角数字の混在、日付・単位の表記ゆれを検出',
  defaultSeverity: 'info',

  async run({ text }) {
    const messages = [];

    // === 全角・半角数字の混在検出 ===
    const fullMatches = [...text.matchAll(KANSUUJI_FULL)];
    const halfMatches = [...text.matchAll(KANSUUJI_HALF)];
    if (fullMatches.length > 0 && halfMatches.length > 0) {
      // 多数派を主流とする
      const fullCount = fullMatches.length;
      const halfCount = halfMatches.reduce((a, m) => a + m[0].length, 0);
      const dominant = halfCount >= fullCount ? 'half' : 'full';
      const minorityMatches = dominant === 'half' ? fullMatches : halfMatches;

      for (const m of minorityMatches) {
        messages.push({
          ruleId: 'number-format/digit-mix',
          severity: 'info',
          message: `全角数字と半角数字が混在しています。${dominant === 'half' ? '半角' : '全角'}に統一することを推奨します`,
          index: m.index,
          length: m[0].length,
          fix: dominant === 'half'
            ? { text: convertFullToHalf(m[0]) }
            : { text: convertHalfToFull(m[0]) }
        });
      }
    }

    // === 日付形式の混在検出 ===
    const dateOccurrences = DATE_PATTERNS.map((p) => ({
      label: p.label,
      matches: [...text.matchAll(p.re)]
    })).filter((o) => o.matches.length > 0);

    if (dateOccurrences.length >= 2) {
      // 主流以外を指摘
      dateOccurrences.sort((a, b) => b.matches.length - a.matches.length);
      const dominant = dateOccurrences[0];
      for (let i = 1; i < dateOccurrences.length; i++) {
        for (const m of dateOccurrences[i].matches) {
          messages.push({
            ruleId: 'number-format/date-mix',
            severity: 'warning',
            message: `日付形式が混在しています（${dateOccurrences.map((o) => o.label).join('・')}）。「${dominant.label}」に統一することを推奨します`,
            index: m.index,
            length: m[0].length
          });
        }
      }
    }

    // === 単位表記の混在検出 ===
    for (const group of UNIT_GROUPS) {
      const occurrences = group.forms
        .map((f) => ({
          label: f.label,
          matches: [...text.matchAll(new RegExp(f.re.source, f.re.flags))]
        }))
        .filter((o) => o.matches.length > 0);

      if (occurrences.length >= 2) {
        occurrences.sort((a, b) => b.matches.length - a.matches.length);
        const dominant = occurrences[0];
        for (let i = 1; i < occurrences.length; i++) {
          for (const m of occurrences[i].matches) {
            messages.push({
              ruleId: `number-format/unit-mix/${group.canonical}`,
              severity: 'info',
              message: `単位表記が混在しています（${occurrences.map((o) => o.label).join('・')}）。「${dominant.label}」に統一することを推奨します`,
              index: m.index,
              length: m[0].length
            });
          }
        }
      }
    }

    // === 金額のカンマ区切り検出 ===
    // 4桁以上の数字でカンマがないものを警告
    const bigNumbers = [...text.matchAll(/(?<![\d,.])\d{4,}円/g)];
    for (const m of bigNumbers) {
      messages.push({
        ruleId: 'number-format/amount-comma',
        severity: 'info',
        message: `金額は3桁ごとにカンマ区切りを推奨します（例: 1,000円）`,
        index: m.index,
        length: m[0].length,
        fix: { text: addCommaToAmount(m[0]) }
      });
    }

    return messages;
  }
};

function convertFullToHalf(s) {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
}
function convertHalfToFull(s) {
  return s.replace(/[0-9]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xFEE0));
}
function addCommaToAmount(s) {
  return s.replace(/^(\d+)(円)$/, (_, n, suffix) => {
    return n.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suffix;
  });
}
