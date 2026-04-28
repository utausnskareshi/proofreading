/**
 * 表記ゆれ検出ルール（同概念の別表記が同一文書に共存する）
 *
 * 例:
 *   - 「パソコンとPCがある」  → 「パソコン」「PC」が混在
 *   - 「ユーザーとユーザを区別」 → 長音の有無が混在
 *   - 「Webサイトとウェブサイト」 → 英語/カタカナが混在
 *
 * 各シノニムグループから2つ以上の表記が出現したら、少数派の表記を warning として指摘する。
 * 「誤字・脱字・表記ゆれ」「語彙の適切さ」をカバー。
 */

// シノニムグループ。canonical は推奨表記。
// 各 form は文字列または /regex/ 形式
const SYNONYM_GROUPS = [
  {
    canonical: 'パソコン',
    forms: [
      { label: 'パソコン', re: /パソコン/g },
      { label: 'PC', re: /\bPC\b/g },
      { label: 'コンピューター', re: /コンピューター/g },
      { label: 'コンピュータ', re: /コンピュータ(?!ー)/g }
    ]
  },
  {
    canonical: 'スマートフォン',
    forms: [
      { label: 'スマートフォン', re: /スマートフォン/g },
      { label: 'スマホ', re: /スマホ/g }
    ]
  },
  {
    canonical: 'メール',
    forms: [
      { label: 'メール', re: /(?<![Eeメ電子]|電子)メール/g },
      { label: 'Eメール', re: /[Ee]メール/g },
      { label: '電子メール', re: /電子メール/g }
    ]
  },
  {
    canonical: 'ユーザー',
    forms: [
      { label: 'ユーザー', re: /ユーザー/g },
      { label: 'ユーザ', re: /ユーザ(?!ー)/g },
      { label: '利用者', re: /利用者/g },
      { label: '使用者', re: /使用者/g }
    ]
  },
  {
    canonical: 'インターネット',
    forms: [
      { label: 'インターネット', re: /インターネット/g },
      { label: 'ネット', re: /(?<![イーア-ン])ネット(?![ワ])/g }
    ]
  },
  {
    canonical: 'Webサイト',
    forms: [
      { label: 'Webサイト', re: /[Ww]eb\s*サイト/g },
      { label: 'ウェブサイト', re: /ウェブサイト/g },
      { label: 'WEBサイト', re: /WEB\s*サイト/g },
      { label: 'ホームページ', re: /ホームページ/g }
    ]
  },
  {
    canonical: 'サーバー',
    forms: [
      { label: 'サーバー', re: /サーバー/g },
      { label: 'サーバ', re: /サーバ(?!ー|ント)/g }
    ]
  },
  {
    canonical: 'プリンター',
    forms: [
      { label: 'プリンター', re: /プリンター/g },
      { label: 'プリンタ', re: /プリンタ(?!ー)/g }
    ]
  },
  {
    canonical: 'クッキー',
    forms: [
      { label: 'クッキー', re: /クッキー/g },
      { label: 'Cookie', re: /\bCookie\b/g },
      { label: 'cookie', re: /\bcookie\b/g }
    ]
  },
  {
    canonical: 'スマートフォン',
    forms: [
      { label: 'iPhone', re: /\biPhone\b/g },
      { label: 'アイフォン', re: /アイフォン/g }
    ]
  },
  {
    canonical: 'アプリ',
    forms: [
      { label: 'アプリ', re: /アプリ(?!ケ)/g },
      { label: 'アプリケーション', re: /アプリケーション/g },
      { label: 'app', re: /\bapp\b/g }
    ]
  },
  {
    canonical: 'ファイル',
    forms: [
      { label: 'ファイル', re: /ファイル/g },
      { label: 'file', re: /\bfile\b/g }
    ]
  },
  {
    canonical: 'データ',
    forms: [
      { label: 'データ', re: /データ/g },
      { label: 'data', re: /\bdata\b/g }
    ]
  },
  {
    canonical: 'クライアント',
    forms: [
      { label: 'クライアント', re: /クライアント/g },
      { label: '顧客', re: /顧客/g },
      { label: 'お客様', re: /お客様/g },
      { label: 'お客さま', re: /お客さま/g }
    ]
  },
  // === 送り仮名の混在検出 ===
  {
    canonical: '行う',
    forms: [
      { label: '行う', re: /行う/g },
      { label: '行なう', re: /行なう/g }
    ]
  },
  {
    canonical: '表す',
    forms: [
      { label: '表す', re: /表す(?!こと)/g },
      { label: '表わす', re: /表わす/g }
    ]
  },
  {
    canonical: '受け付け',
    forms: [
      { label: '受け付け', re: /受け付け/g },
      { label: '受付', re: /受付(?![係時間業中])/g }
    ]
  },
  {
    canonical: '取り扱い',
    forms: [
      { label: '取り扱い', re: /取り扱い/g },
      { label: '取扱い', re: /取扱い/g },
      { label: '取扱', re: /取扱(?![いう注説])/g }
    ]
  },
  {
    canonical: '問い合わせ',
    forms: [
      { label: '問い合わせ', re: /問い合わせ/g },
      { label: '問合せ', re: /問合せ/g },
      { label: '問合わせ', re: /問合わせ/g }
    ]
  },
  {
    canonical: '打ち合わせ',
    forms: [
      { label: '打ち合わせ', re: /打ち合わせ/g },
      { label: '打合せ', re: /打合せ/g },
      { label: '打合わせ', re: /打合わせ/g }
    ]
  },
  {
    canonical: '申し込み',
    forms: [
      { label: '申し込み', re: /申し込み/g },
      { label: '申込み', re: /申込み/g },
      { label: '申込', re: /申込(?![みむ書日])/g }
    ]
  },
  {
    canonical: '振り込み',
    forms: [
      { label: '振り込み', re: /振り込み/g },
      { label: '振込み', re: /振込み/g },
      { label: '振込', re: /振込(?![みむ手先金])/g }
    ]
  },
  {
    canonical: '組み合わせ',
    forms: [
      { label: '組み合わせ', re: /組み合わせ/g },
      { label: '組合せ', re: /組合せ/g },
      { label: '組合わせ', re: /組合わせ/g }
    ]
  },
  {
    canonical: '売り上げ',
    forms: [
      { label: '売り上げ', re: /売り上げ/g },
      { label: '売上げ', re: /売上げ/g },
      { label: '売上', re: /売上(?![げ高金])/g }
    ]
  }
];

export const ruleNotationConsistency = {
  id: 'notation-consistency',
  description: '同じ概念の別表記が混在していないか検出（パソコンとPC、ユーザーとユーザ、など）',
  defaultSeverity: 'warning',

  async run({ text }) {
    const messages = [];

    for (const group of SYNONYM_GROUPS) {
      // 各 form の出現箇所を収集
      const occurrences = group.forms.map((f) => {
        const re = new RegExp(f.re.source, f.re.flags.includes('g') ? f.re.flags : f.re.flags + 'g');
        const matches = [];
        let m;
        while ((m = re.exec(text)) !== null) {
          if (m.index === re.lastIndex) re.lastIndex++;
          matches.push({ index: m.index, length: m[0].length, matched: m[0] });
        }
        return { label: f.label, matches };
      });

      // 出現したフォームが1つ以下なら混在ではない
      const usedForms = occurrences.filter((o) => o.matches.length > 0);
      if (usedForms.length < 2) continue;

      // 最も多い表記を「主流」として、他の表記を指摘
      usedForms.sort((a, b) => b.matches.length - a.matches.length);
      const dominant = usedForms[0];
      const dominantLabel = dominant.label;

      const usedLabels = usedForms.map((u) => u.label).join('・');

      // 主流以外のフォームをすべて指摘
      for (let i = 1; i < usedForms.length; i++) {
        const minor = usedForms[i];
        for (const m of minor.matches) {
          messages.push({
            ruleId: `notation-consistency/${group.canonical}`,
            severity: 'warning',
            message: `表記ゆれ: 同じ意味で「${usedLabels}」が混在しています。「${dominantLabel}」に統一することを推奨します。`,
            index: m.index,
            length: m.length,
            fix: { text: dominantLabel }
          });
        }
      }
    }

    return messages;
  }
};
