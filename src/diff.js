/**
 * 差分表示ダイアログ
 */
import { diffChars } from 'diff';
import { escapeHTML } from './ui.js';

export function openDiffDialog(before, after, onApply) {
  const dialog = document.getElementById('diff-dialog');
  const view = document.getElementById('diff-view');
  const apply = document.getElementById('apply-diff');

  const parts = diffChars(before, after);
  view.innerHTML = parts
    .map((p) => {
      const safe = escapeHTML(p.value);
      if (p.added) return `<ins>${safe}</ins>`;
      if (p.removed) return `<del>${safe}</del>`;
      return safe;
    })
    .join('');

  // 既存リスナーを除去するため一度クローン
  const newApply = apply.cloneNode(true);
  apply.replaceWith(newApply);
  newApply.addEventListener('click', () => {
    onApply?.(true);
    dialog.close();
  });

  dialog.showModal();
}
