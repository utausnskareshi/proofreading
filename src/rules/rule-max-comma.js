/**
 * 1文中の読点（、）が多すぎないかチェック
 * 「文の構造・わかりやすさ」をカバー。
 */

export const ruleMaxComma = {
  id: 'max-comma',
  description: '1文中の読点の数が多すぎないかチェック',
  defaultSeverity: 'info',

  async run({ text }) {
    const messages = [];
    const re = /[^。！？!?]+[。！？!?]?/gu;
    let m;
    const MAX = 4;
    while ((m = re.exec(text)) !== null) {
      const sentence = m[0];
      const commas = (sentence.match(/[、,]/gu) || []).length;
      if (commas > MAX) {
        messages.push({
          ruleId: 'max-comma',
          severity: 'info',
          message: `1文中に読点が${commas}個あります（${MAX}個以下を推奨）。文を分割すると読みやすくなります。`,
          index: m.index,
          length: sentence.length
        });
      }
    }
    return messages;
  }
};
