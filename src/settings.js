/**
 * 設定（テーマ、フォントサイズ、ルール強度の上書き、データ削除）
 */
import { getSetting, setSetting, clearAllStorage } from './storage.js';
import { ruleMeta } from './rules/index.js';
import { showToast } from './ui.js';

const SEVERITIES = ['off', 'info', 'warning', 'error'];

const _ruleSeverityMap = new Map();

export function getRuleSeverityOverride(ruleId) {
  // 完全一致 / プレフィックス一致（dict:〜 など）
  if (_ruleSeverityMap.has(ruleId)) {
    const v = _ruleSeverityMap.get(ruleId);
    return v === 'off' ? null : v; // off はメッセージ自体を抑制したいが、ここでは severity 判定のみ
  }
  for (const [key, val] of _ruleSeverityMap) {
    if (ruleId.startsWith(key + '/')) return val === 'off' ? null : val;
  }
  return null;
}

export function isRuleDisabled(ruleId) {
  return _ruleSeverityMap.get(ruleId) === 'off';
}

export async function applySettings() {
  // テーマ
  const theme = await getSetting('theme', 'auto');
  applyTheme(theme);

  // フォントサイズ
  const fontSize = await getSetting('fontSize', '16');
  document.documentElement.style.setProperty('--font-base', fontSize + 'px');

  // ルール重要度
  const overrides = await getSetting('ruleSeverity', {});
  _ruleSeverityMap.clear();
  for (const [k, v] of Object.entries(overrides)) _ruleSeverityMap.set(k, v);
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export async function initSettings() {
  document.getElementById('open-settings').addEventListener('click', openDialog);

  const themeSel = document.getElementById('setting-theme');
  themeSel.value = await getSetting('theme', 'auto');
  themeSel.addEventListener('change', async () => {
    await setSetting('theme', themeSel.value);
    applyTheme(themeSel.value);
  });

  const fontSel = document.getElementById('setting-font-size');
  fontSel.value = await getSetting('fontSize', '16');
  fontSel.addEventListener('change', async () => {
    await setSetting('fontSize', fontSel.value);
    document.documentElement.style.setProperty('--font-base', fontSel.value + 'px');
  });

  const autoFix = document.getElementById('setting-auto-fix');
  autoFix.checked = await getSetting('autoFix', false);
  autoFix.addEventListener('change', () => setSetting('autoFix', autoFix.checked));

  const md = document.getElementById('setting-markdown');
  md.checked = await getSetting('markdownAware', true);
  md.addEventListener('change', () => setSetting('markdownAware', md.checked));

  const sr = document.getElementById('setting-show-readability');
  sr.checked = await getSetting('showReadability', true);
  sr.addEventListener('change', () => setSetting('showReadability', sr.checked));

  // ルール重要度UI
  await renderRuleSeverity();

  document.getElementById('clear-storage').addEventListener('click', async () => {
    if (!confirm('保存されたドラフト・履歴・辞書・設定をすべて削除します。よろしいですか？')) return;
    await clearAllStorage();
    showToast('ローカルデータを削除しました。再読み込みします');
    setTimeout(() => location.reload(), 800);
  });
}

async function renderRuleSeverity() {
  const wrap = document.getElementById('rule-severity-list');
  wrap.innerHTML = '';
  const overrides = await getSetting('ruleSeverity', {});

  for (const r of ruleMeta) {
    const row = document.createElement('label');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1fr auto';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    row.style.marginBottom = '6px';

    const current = overrides[r.id] || r.defaultSeverity;
    row.innerHTML = `
      <span title="${r.description}">${r.id} <span class="hint">(既定: ${r.defaultSeverity})</span></span>
      <select data-rule="${r.id}">
        ${SEVERITIES.map((s) => `<option value="${s}" ${current === s ? 'selected' : ''}>${labelOf(s)}</option>`).join('')}
      </select>
    `;
    row.querySelector('select').addEventListener('change', async (e) => {
      const next = await getSetting('ruleSeverity', {});
      next[r.id] = e.target.value;
      await setSetting('ruleSeverity', next);
      _ruleSeverityMap.set(r.id, e.target.value);
    });
    wrap.appendChild(row);
  }
}

function labelOf(s) {
  return { off: '無効', info: '情報', warning: '警告', error: 'エラー' }[s] ?? s;
}

function openDialog() {
  document.getElementById('settings-dialog').showModal();
}
