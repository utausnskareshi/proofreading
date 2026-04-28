/**
 * エントリーポイント
 * オンボーディング → メイン校正画面の遷移制御と
 * 各サブシステム（エディタ、辞書、設定）の初期化を行います。
 */
import './styles.css';
import { initEditor } from './editor.js';
import { initDictionary } from './dictionary.js';
import { initSettings, applySettings } from './settings.js';
import { initHistory } from './history.js';
import { showToast } from './ui.js';

const ONBOARDING_KEY = 'proofreading.onboarding.skip';

function showOnboarding() {
  document.getElementById('onboarding').hidden = false;
  document.getElementById('app').hidden = true;
}

function showApp() {
  document.getElementById('onboarding').hidden = true;
  document.getElementById('app').hidden = false;
}

async function bootstrap() {
  // 設定の即時適用（テーマ等）
  await applySettings();

  // 既存ユーザーはオンボーディングをスキップ
  const skip = localStorage.getItem(ONBOARDING_KEY) === '1';

  if (skip) {
    showApp();
  } else {
    showOnboarding();
  }

  // 「使用開始」ボタン
  document
    .getElementById('start-button')
    .addEventListener('click', () => {
      const checkbox = document.getElementById('skip-onboarding');
      if (checkbox.checked) {
        localStorage.setItem(ONBOARDING_KEY, '1');
      }
      showApp();
    });

  // 各機能の初期化
  await Promise.all([
    initEditor(),
    initDictionary(),
    initSettings(),
    initHistory()
  ]);

  // ヘルプダイアログ
  document.getElementById('open-help').addEventListener('click', () => {
    document.getElementById('help-dialog').showModal();
  });

  // PWAインストール促進（ブラウザに対応している場合）
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  // Web Share Target からの起動（共有された文章を自動でエディタに投入）
  await handleShareTarget();
}

async function handleShareTarget() {
  // クエリ ?text= でも受けられるようにしておく
  const params = new URLSearchParams(location.search);
  const sharedText = params.get('text');
  if (sharedText) {
    const editor = document.getElementById('editor');
    editor.value = sharedText.slice(0, 30000);
    editor.dispatchEvent(new Event('input'));
    showToast('共有された文章を読み込みました');
    // クエリをクリア
    history.replaceState({}, '', location.pathname);
  }
}

// Service Worker は vite-plugin-pwa が自動登録するためここでは触らない
bootstrap().catch((err) => {
  console.error(err);
  showToast('初期化に失敗しました: ' + err.message);
});
