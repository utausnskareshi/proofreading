/**
 * エディタ：入力欄、文字数カウント、ハイライト、ドラフト自動保存、
 * 校正実行、結果表示、ショートカットキー、読みやすさスコアなどを担当。
 */
import { saveDraft, loadDraft, pushHistory, addIgnoreEntry, getSetting } from './storage.js';
import { runProofread } from './linter.js';
import { computeReadability } from './readability.js';
import { showToast, showLoading, setLoadingProgress, hideLoading, escapeHTML, debounce } from './ui.js';
import { openDiffDialog } from './diff.js';
import { speak } from './speech.js';

const MAX_LENGTH = 30000;

// 校正結果の状態
let currentMessages = []; // { ruleId, severity, message, index, length, fix?, ignored, suppressed }
let currentText = '';
let activeFilters = { error: true, warning: true, info: true };

export async function initEditor() {
  const editor = document.getElementById('editor');
  const charCount = document.getElementById('char-count');
  const charProgress = document.getElementById('char-progress');
  const proofreadBtn = document.getElementById('proofread-button');
  const fixAllBtn = document.getElementById('fix-all-button');
  const saveBtn = document.getElementById('save-button');
  const exportBtn = document.getElementById('export-button');
  const clearBtn = document.getElementById('clear-button');
  const pasteBtn = document.getElementById('paste-button');
  const speakBtn = document.getElementById('speak-button');

  // ドラフト復元
  const draft = await loadDraft();
  if (draft) {
    editor.value = draft;
  }
  updateCharCount();

  // 入力イベント
  const debouncedSave = debounce(() => saveDraft(editor.value), 600);
  editor.addEventListener('input', () => {
    if (editor.value.length > MAX_LENGTH) {
      editor.value = editor.value.slice(0, MAX_LENGTH);
      showToast(`${MAX_LENGTH.toLocaleString()}文字を超えるため切り詰めました`);
    }
    updateCharCount();
    debouncedSave();
  });

  // スクロール同期（ハイライトレイヤとの位置合わせ）
  editor.addEventListener('scroll', () => {
    const hl = document.getElementById('editor-highlights');
    hl.scrollTop = editor.scrollTop;
    hl.scrollLeft = editor.scrollLeft;
  });

  // 校正実行
  proofreadBtn.addEventListener('click', runLint);

  // 自動修正一括適用
  fixAllBtn.addEventListener('click', applyAllFixes);

  // 保存
  saveBtn.addEventListener('click', async () => {
    await saveDraft(editor.value);
    await pushHistory({ text: editor.value, messages: currentMessages });
    showToast('保存しました');
  });

  // エクスポート
  exportBtn.addEventListener('click', () => exportDocument());

  // クリア
  clearBtn.addEventListener('click', () => {
    if (editor.value && !confirm('入力内容をクリアします。よろしいですか？')) return;
    editor.value = '';
    updateCharCount();
    clearResults();
    saveDraft('');
  });

  // 貼り付け
  pasteBtn.addEventListener('click', async () => {
    try {
      const txt = await navigator.clipboard.readText();
      const next = (editor.value + txt).slice(0, MAX_LENGTH);
      editor.value = next;
      editor.dispatchEvent(new Event('input'));
      showToast('クリップボードから貼り付けました');
    } catch {
      showToast('クリップボードの読み取りが許可されていません');
    }
  });

  // 読み上げ
  speakBtn.addEventListener('click', () => {
    if (!editor.value.trim()) {
      showToast('読み上げる文章がありません');
      return;
    }
    speak(editor.value);
  });

  // ショートカット
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runLint();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveBtn.click();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      clearBtn.click();
    }
  });

  // フィルタ
  document.querySelectorAll('.results-filter input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      activeFilters[cb.dataset.severity] = cb.checked;
      renderResults();
    });
  });

  function updateCharCount() {
    const n = editor.value.length;
    charCount.textContent = n.toLocaleString();
    charProgress.value = n;
    charProgress.style.accentColor =
      n >= MAX_LENGTH ? 'var(--error)' :
      n >= MAX_LENGTH * 0.9 ? 'var(--warning)' :
      'var(--primary)';
  }

  async function runLint() {
    const text = editor.value;
    if (!text.trim()) {
      showToast('校正する文章を入力してください');
      return;
    }

    proofreadBtn.disabled = true;
    showLoading('校正中...');

    try {
      const messages = await runProofread(text, (progress, label) => {
        setLoadingProgress(label, progress);
      });
      currentText = text;
      currentMessages = messages.map((m) => ({ ...m, ignored: false, suppressed: false }));
      renderResults();
      renderHighlights();
      updateReadability(text);
      const fixCount = currentMessages.filter((m) => m.fix).length;
      fixAllBtn.disabled = fixCount === 0;
      const total = currentMessages.length;
      showToast(`${total}件の指摘${fixCount > 0 ? `（うち${fixCount}件は自動修正可）` : ''}`);

      // 設定: 校正後に自動修正を一括適用
      const autoFix = await getSetting('autoFix', false);
      if (autoFix && fixCount > 0) {
        applyAllFixes();
      }
    } catch (err) {
      console.error(err);
      showToast('校正に失敗しました: ' + err.message);
    } finally {
      proofreadBtn.disabled = false;
      hideLoading();
    }
  }

  function clearResults() {
    currentMessages = [];
    currentText = '';
    renderResults();
    renderHighlights();
    fixAllBtn.disabled = true;
    document.getElementById('readability').hidden = true;
  }

  function renderResults() {
    const list = document.getElementById('results-list');
    const empty = document.getElementById('results-empty');
    list.innerHTML = '';

    const visible = currentMessages.filter(
      (m) => !m.suppressed && activeFilters[m.severity]
    );

    document.getElementById('count-error').textContent = currentMessages.filter((m) => m.severity === 'error' && !m.suppressed).length;
    document.getElementById('count-warning').textContent = currentMessages.filter((m) => m.severity === 'warning' && !m.suppressed).length;
    document.getElementById('count-info').textContent = currentMessages.filter((m) => m.severity === 'info' && !m.suppressed).length;

    if (visible.length === 0) {
      empty.hidden = false;
      empty.textContent = currentMessages.length === 0
        ? '「校正する」を押すと結果がここに表示されます。'
        : '指摘はありません。';
      return;
    }
    empty.hidden = true;

    for (const msg of visible) {
      const li = document.createElement('li');
      li.className = 'result-item' + (msg.ignored ? ' result-item--ignored' : '');
      li.dataset.index = String(currentMessages.indexOf(msg));

      const excerpt = currentText.slice(
        Math.max(0, msg.index - 8),
        Math.min(currentText.length, msg.index + msg.length + 8)
      );

      li.innerHTML = `
        <div class="result-item__head">
          <span class="severity-badge" data-severity="${msg.severity}">${severityLabel(msg.severity)}</span>
          <span class="result-item__rule">${escapeHTML(msg.ruleId)}</span>
        </div>
        <div class="result-item__msg">${escapeHTML(msg.message)}</div>
        <div class="result-item__excerpt">…${escapeHTML(excerpt)}…</div>
        <div class="result-item__actions">
          <button class="button" data-action="jump">該当箇所へ</button>
          ${msg.fix ? `<button class="button" data-action="fix">修正適用</button>` : ''}
          <button class="button" data-action="diff">差分表示</button>
          <button class="button" data-action="ignore">${msg.ignored ? '無視を解除' : '無視'}</button>
          <button class="button" data-action="ignore-all">この指摘を全文書で無視</button>
        </div>
      `;

      li.addEventListener('click', (e) => {
        const action = e.target?.dataset?.action;
        const idx = Number(li.dataset.index);
        const m = currentMessages[idx];
        if (!m) return;

        if (!action || action === 'jump') {
          jumpTo(m);
        } else if (action === 'fix') {
          applyFix(idx);
        } else if (action === 'diff') {
          showDiff(idx);
        } else if (action === 'ignore') {
          m.ignored = !m.ignored;
          renderResults();
          renderHighlights();
        } else if (action === 'ignore-all') {
          ignoreInAllDocs(m);
        }
      });

      list.appendChild(li);
    }
  }

  function severityLabel(s) {
    return { error: 'エラー', warning: '警告', info: '情報' }[s] ?? s;
  }

  function jumpTo(msg) {
    editor.focus();
    editor.setSelectionRange(msg.index, msg.index + msg.length);
    // textarea でのスクロール
    const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 24;
    const before = editor.value.slice(0, msg.index);
    const lineNo = before.split('\n').length;
    editor.scrollTop = (lineNo - 3) * lineHeight;
  }

  function renderHighlights() {
    const hl = document.getElementById('editor-highlights');
    if (!currentText) {
      hl.innerHTML = '';
      return;
    }
    const sorted = currentMessages
      .filter((m) => !m.ignored && !m.suppressed && activeFilters[m.severity])
      .map((m) => ({ ...m, end: m.index + m.length }))
      .sort((a, b) => a.index - b.index);

    let out = '';
    let pos = 0;
    for (const m of sorted) {
      if (m.index < pos) continue; // 重複は無視
      out += escapeHTML(currentText.slice(pos, m.index));
      out += `<mark data-severity="${m.severity}">${escapeHTML(currentText.slice(m.index, m.end))}</mark>`;
      pos = m.end;
    }
    out += escapeHTML(currentText.slice(pos));
    hl.innerHTML = out;
  }

  function applyFix(idx) {
    const m = currentMessages[idx];
    if (!m?.fix) return;
    const before = editor.value.slice(0, m.index);
    const after = editor.value.slice(m.index + m.length);
    editor.value = before + m.fix.text + after;
    editor.dispatchEvent(new Event('input'));
    // 適用された指摘を削除し、以降の index をシフト
    const delta = m.fix.text.length - m.length;
    currentMessages.splice(idx, 1);
    for (const o of currentMessages) {
      if (o.index >= m.index + m.length) o.index += delta;
    }
    renderResults();
    renderHighlights();
    showToast('修正を適用しました');
  }

  function applyAllFixes() {
    // 後ろから適用していけば index がずれない
    const fixable = currentMessages
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.fix && !m.ignored)
      .sort((a, b) => b.m.index - a.m.index);

    let text = editor.value;
    for (const { m } of fixable) {
      text = text.slice(0, m.index) + m.fix.text + text.slice(m.index + m.length);
    }
    editor.value = text;
    editor.dispatchEvent(new Event('input'));
    showToast(`${fixable.length}件の修正を適用しました`);
    runLint();
  }

  function showDiff(idx) {
    const m = currentMessages[idx];
    const original = currentText;
    const fixed = m.fix
      ? original.slice(0, m.index) + m.fix.text + original.slice(m.index + m.length)
      : original;
    openDiffDialog(original, fixed, (apply) => {
      if (apply) {
        editor.value = fixed;
        editor.dispatchEvent(new Event('input'));
        showToast('差分を反映しました');
      }
    });
  }

  async function ignoreInAllDocs(m) {
    const pattern = currentText.slice(m.index, m.index + m.length);
    const key = `${m.ruleId}:${pattern}`;
    await addIgnoreEntry({
      key,
      ruleId: m.ruleId,
      pattern,
      createdAt: Date.now()
    });
    // 同じ ruleId + 文字列の指摘を一括で suppress
    for (const o of currentMessages) {
      if (o.ruleId === m.ruleId && currentText.slice(o.index, o.index + o.length) === pattern) {
        o.suppressed = true;
      }
    }
    renderResults();
    renderHighlights();
    showToast('全文書で無視するリストに追加しました');
  }

  function exportDocument() {
    const text = editor.value;
    if (!text.trim()) {
      showToast('エクスポートする文章がありません');
      return;
    }

    // 形式選択
    const format = prompt('エクスポート形式を入力してください:\n  txt / md / report', 'txt');
    if (!format) return;

    let blob, ext, mime;
    if (format === 'md') {
      blob = new Blob([text], { type: 'text/markdown' });
      ext = 'md';
      mime = 'text/markdown';
    } else if (format === 'report') {
      const html = generateReport(text, currentMessages);
      blob = new Blob([html], { type: 'text/html' });
      ext = 'html';
      mime = 'text/html';
    } else {
      blob = new Blob([text], { type: 'text/plain' });
      ext = 'txt';
      mime = 'text/plain';
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proofread-${new Date().toISOString().slice(0, 10)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('エクスポートしました');
  }

  async function updateReadability(text) {
    const show = await getSetting('showReadability', true);
    const wrap = document.getElementById('readability');
    if (!show) {
      wrap.hidden = true;
      return;
    }
    const r = computeReadability(text);
    wrap.hidden = false;
    document.getElementById('r-chars').textContent = r.chars.toLocaleString();
    document.getElementById('r-sentences').textContent = r.sentences;
    document.getElementById('r-avg-len').textContent = r.avgSentenceLength.toFixed(1) + ' 文字';
    document.getElementById('r-kanji').textContent = (r.kanjiRatio * 100).toFixed(1) + '%';
    document.getElementById('r-score').textContent = r.score + ' / 100';
  }
}

function generateReport(text, messages) {
  const rows = messages.map((m, i) => {
    const excerpt = text.slice(
      Math.max(0, m.index - 8),
      Math.min(text.length, m.index + m.length + 8)
    );
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${m.severity}</td>
        <td>${escapeHTML(m.ruleId)}</td>
        <td>${escapeHTML(m.message)}</td>
        <td><code>…${escapeHTML(excerpt)}…</code></td>
      </tr>
    `;
  }).join('');

  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>校正レポート</title>
<style>
body{font-family:sans-serif;line-height:1.6;max-width:880px;margin:24px auto;padding:0 16px;}
table{width:100%;border-collapse:collapse;}
th,td{border:1px solid #ccc;padding:6px 8px;font-size:14px;vertical-align:top;}
th{background:#f3f3f3;}
pre{white-space:pre-wrap;background:#f6f8fa;padding:12px;border-radius:8px;}
</style></head><body>
<h1>校正レポート</h1>
<p>生成日時: ${new Date().toLocaleString('ja-JP')}</p>
<h2>本文</h2>
<pre>${escapeHTML(text)}</pre>
<h2>指摘一覧 (${messages.length}件)</h2>
<table><thead><tr><th>#</th><th>重要度</th><th>ルール</th><th>メッセージ</th><th>該当箇所</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`;
}
