/**
 * 共通UIユーティリティ（トースト、ローディング表示など）
 */

let toastTimer = null;

export function showToast(message, durationMs = 2400) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, durationMs);
}

export function showLoading(text = '読み込み中...') {
  const el = document.getElementById('loading');
  document.getElementById('loading-text').textContent = text;
  el.hidden = false;
}

export function setLoadingProgress(text, value) {
  const t = document.getElementById('loading-text');
  const p = document.getElementById('loading-progress');
  if (text != null) t.textContent = text;
  if (value != null) p.value = value;
}

export function hideLoading() {
  document.getElementById('loading').hidden = true;
}

/** HTMLエスケープ */
export function escapeHTML(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** デバウンス */
export function debounce(fn, delay = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}
