/**
 * 校正履歴（最新5件）
 */
import { listHistory, deleteHistory } from './storage.js';
import { showToast } from './ui.js';

export async function initHistory() {
  document.getElementById('open-history').addEventListener('click', openDialog);
}

async function openDialog() {
  const list = document.getElementById('history-list');
  list.innerHTML = '';

  const items = await listHistory();
  if (items.length === 0) {
    list.innerHTML = '<li class="hint" style="padding:12px;">履歴はまだありません。「保存」ボタンで保存できます。</li>';
  }
  for (const e of items) {
    const li = document.createElement('li');
    li.className = 'history-item';
    const preview = e.text.slice(0, 60).replaceAll('\n', ' ');
    li.innerHTML = `
      <div style="flex:1; min-width:0;">
        <div><strong>${new Date(e.updatedAt).toLocaleString('ja-JP')}</strong></div>
        <div class="hint" style="text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${escapeHTML(preview)}…</div>
        <div class="hint">${e.text.length.toLocaleString()}文字 / 指摘 ${e.messages?.length ?? 0}件</div>
      </div>
      <button type="button" class="button" data-action="restore">復元</button>
      <button type="button" class="button" data-action="delete">削除</button>
    `;
    li.querySelector('[data-action="restore"]').addEventListener('click', () => {
      document.getElementById('editor').value = e.text;
      document.getElementById('editor').dispatchEvent(new Event('input'));
      document.getElementById('history-dialog').close();
      showToast('履歴から復元しました');
    });
    li.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      await deleteHistory(e.id);
      openDialog();
    });
    list.appendChild(li);
  }

  document.getElementById('help-dialog').close?.();
  document.getElementById('history-dialog').showModal();
}

function escapeHTML(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
