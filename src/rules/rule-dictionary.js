/**
 * 辞書ベースの校正ルール（prh互換）
 *
 * 辞書フォーマット (JSON):
 * {
 *   "version": 1,
 *   "name": "辞書名",
 *   "description": "...",
 *   "rules": [
 *     { "expected": "ください", "patterns": ["下さい"], "severity": "warning", "message": "..." },
 *     ...
 *   ]
 * }
 *
 * 「誤字・脱字・表記ゆれ」「語彙の適切さ」をカバー。
 */

export const ruleDictionary = {
  id: 'dictionary',
  description: '辞書による表記ゆれ・誤字・置き換え提案',
  defaultSeverity: 'warning',

  async run({ text, dictionaries }) {
    const messages = [];
    for (const dict of dictionaries) {
      if (!dict?.rules) continue;
      for (const r of dict.rules) {
        const patterns = Array.isArray(r.patterns) ? r.patterns : (r.patterns ? [r.patterns] : []);
        for (const pat of patterns) {
          const matches = findAll(text, pat);
          for (const m of matches) {
            // 期待形と同一なら除外（patterns に正規表現で expected を含む場合）
            if (m.matched === r.expected) continue;
            messages.push({
              ruleId: `dict:${dict.id}/${r.expected}`,
              severity: r.severity || 'warning',
              message: r.message || `「${m.matched}」は「${r.expected}」が推奨されます`,
              index: m.index,
              length: m.matched.length,
              fix: r.expected ? { text: r.expected } : undefined
            });
          }
        }
      }
    }
    return messages;
  }
};

function findAll(text, pattern) {
  const out = [];
  // /.../ で囲まれていれば正規表現として扱う
  let regex;
  if (typeof pattern === 'string' && pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
    const last = pattern.lastIndexOf('/');
    const body = pattern.slice(1, last);
    const flags = pattern.slice(last + 1);
    regex = new RegExp(body, flags.includes('g') ? flags : flags + 'g');
  } else {
    regex = new RegExp(escapeRegex(String(pattern)), 'g');
  }
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index === regex.lastIndex) regex.lastIndex++;
    out.push({ index: m.index, matched: m[0] });
  }
  return out;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
