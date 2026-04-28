/**
 * 辞書管理：標準辞書のロード、ON/OFF、複数有効化、インポート・エクスポート
 *
 * 標準辞書は public/dictionaries/*.json として静的配信される。
 * 初回起動時に IndexedDB へコピーし、以降は IndexedDB の値を正とする。
 */
import {
  listDictionaries, getDictionary, saveDictionary, deleteDictionary
} from './storage.js';
import { showToast } from './ui.js';

const BUILTIN_LIST = [
  { id: 'ja-basic', file: 'ja-basic.json', name: '基本辞書（誤字・表記ゆれ）' },
  { id: 'ja-redundant', file: 'ja-redundant.json', name: '冗長表現辞書' },
  { id: 'ja-keigo', file: 'ja-keigo.json', name: '敬語・丁寧語辞書' },
  { id: 'ja-idiom', file: 'ja-idiom.json', name: '慣用句・四字熟語辞書' },
  { id: 'ja-business', file: 'ja-business.json', name: 'ビジネス文書用辞書' },
  { id: 'ja-tech', file: 'ja-tech.json', name: '技術文書用辞書' }
];

export async function initDictionary() {
  await ensureBuiltinDictionaries();

  // ボタンイベント
  document.getElementById('open-dictionary').addEventListener('click', openDialog);
  document.getElementById('import-dict').addEventListener('click', () => {
    document.getElementById('dict-file-input').click();
  });
  document.getElementById('export-dict').addEventListener('click', exportSelected);
  document.getElementById('dict-file-input').addEventListener('change', handleImport);
}

async function ensureBuiltinDictionaries() {
  const existing = await listDictionaries();
  const existingMap = new Map(existing.map((d) => [d.id, d]));

  // デフォルトで有効化する辞書
  const defaultEnabled = new Set(['ja-basic', 'ja-redundant', 'ja-tech', 'ja-keigo', 'ja-idiom']);

  for (const meta of BUILTIN_LIST) {
    try {
      const url = `${import.meta.env.BASE_URL}dictionaries/${meta.file}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      const prev = existingMap.get(meta.id);
      // 既にある場合は enabled 状態を維持しつつ rules を最新版に更新する
      await saveDictionary({
        id: meta.id,
        name: json.name || meta.name,
        description: json.description || '',
        builtin: true,
        enabled: prev ? prev.enabled : defaultEnabled.has(meta.id),
        version: json.version || 1,
        rules: json.rules || []
      });
    } catch (err) {
      console.warn('Failed to load builtin dictionary', meta.id, err);
    }
  }
}

async function openDialog() {
  await renderList();
  document.getElementById('dictionary-dialog').showModal();
}

async function renderList() {
  const all = await listDictionaries();
  const list = document.getElementById('dictionary-list');
  list.innerHTML = '';

  for (const dict of all) {
    const li = document.createElement('li');
    li.className = 'dictionary-item';
    li.innerHTML = `
      <input type="checkbox" data-id="${dict.id}" ${dict.enabled ? 'checked' : ''} aria-label="${dict.name}を有効化" />
      <div style="flex:1; min-width:0;">
        <div class="dictionary-item__name">${escapeHTML(dict.name)} ${dict.builtin ? '<span class="hint">(標準)</span>' : ''}</div>
        <div class="dictionary-item__meta">${dict.rules.length}件のルール${dict.description ? ' / ' + escapeHTML(dict.description) : ''}</div>
      </div>
      <button type="button" class="button" data-action="export" data-id="${dict.id}" title="エクスポート">📤</button>
      ${dict.builtin ? '' : `<button type="button" class="button" data-action="delete" data-id="${dict.id}" title="削除">🗑️</button>`}
    `;
    li.querySelector('input').addEventListener('change', async (e) => {
      const target = await getDictionary(dict.id);
      target.enabled = e.target.checked;
      await saveDictionary(target);
    });
    li.querySelector('[data-action="export"]').addEventListener('click', () => exportOne(dict.id));
    li.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
      if (!confirm(`「${dict.name}」を削除します。よろしいですか？`)) return;
      await deleteDictionary(dict.id);
      await renderList();
      showToast('辞書を削除しました');
    });
    list.appendChild(li);
  }
}

async function exportOne(id) {
  const dict = await getDictionary(id);
  if (!dict) return;
  const data = {
    version: dict.version || 1,
    name: dict.name,
    description: dict.description,
    rules: dict.rules
  };
  download(`${id}.json`, JSON.stringify(data, null, 2));
}

async function exportSelected() {
  const all = await listDictionaries();
  const enabled = all.filter((d) => d.enabled);
  if (enabled.length === 0) {
    showToast('有効な辞書がありません');
    return;
  }
  const data = {
    version: 1,
    name: '統合辞書',
    exportedAt: new Date().toISOString(),
    dictionaries: enabled.map((d) => ({ id: d.id, name: d.name, rules: d.rules }))
  };
  download(`dictionaries-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
}

async function handleImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const json = JSON.parse(text);

    // 単一辞書 or 複数まとめてエクスポート されたもの
    if (Array.isArray(json.dictionaries)) {
      for (const d of json.dictionaries) {
        await saveDictionary({
          id: 'user-' + (d.id || crypto.randomUUID()),
          name: d.name || '名称未設定',
          description: d.description || '',
          builtin: false,
          enabled: true,
          version: 1,
          rules: d.rules || []
        });
      }
      showToast(`${json.dictionaries.length}個の辞書を読み込みました`);
    } else if (Array.isArray(json.rules)) {
      await saveDictionary({
        id: 'user-' + (json.id || crypto.randomUUID()),
        name: json.name || file.name.replace(/\.json$/, ''),
        description: json.description || '',
        builtin: false,
        enabled: true,
        version: json.version || 1,
        rules: json.rules
      });
      showToast('辞書を読み込みました');
    } else {
      throw new Error('不正な辞書フォーマットです');
    }
    await renderList();
  } catch (err) {
    console.error(err);
    alert('インポートに失敗しました: ' + err.message);
  } finally {
    e.target.value = '';
  }
}

function download(filename, content) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHTML(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
