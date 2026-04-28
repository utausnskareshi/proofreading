/**
 * kuromoji.js のロード（進捗付き・builder バイパス版）
 *
 * kuromoji 標準の builder().build() は内部で async ライブラリと XHR を使い、
 * Service Worker・キャッシュ層との相性で稀にコールバックが解決しないことが
 * あったため、ここでは以下の独自フローに置き換えている：
 *
 *   1. 12個の .dat.gz を fetch + ReadableStream で取得し、進捗を逐次報告。
 *   2. pako で gunzip。
 *   3. IndexedDB（idb 経由）に解凍済みバッファをキャッシュ。
 *      2回目以降は IndexedDB から即時取得（オフラインでも動作）。
 *   4. kuromoji の内部モジュール (Tokenizer / DynamicDictionaries) を
 *      直接 import し、解凍済みバッファから Tokenizer を組み立てる。
 *
 * これにより
 *   - 進捗 0〜100% を細かく報告できる
 *   - 失敗時の原因が常に特定可能（HTTP/decompress/build のどこか）
 *   - SW のキャッシュ問題から独立
 */
import pako from 'pako';
import Tokenizer from 'kuromoji/src/Tokenizer.js';
import DynamicDictionaries from 'kuromoji/src/dict/DynamicDictionaries.js';
import { openDB } from 'idb';

// 順序は kuromoji の DictionaryLoader.js と一致させる必要がある
const DICT_FILES = [
  'base.dat.gz',
  'check.dat.gz',
  'tid.dat.gz',
  'tid_pos.dat.gz',
  'tid_map.dat.gz',
  'cc.dat.gz',
  'unk.dat.gz',
  'unk_pos.dat.gz',
  'unk_map.dat.gz',
  'unk_char.dat.gz',
  'unk_compat.dat.gz',
  'unk_invoke.dat.gz'
];

const IDB_NAME = 'kuromoji-cache';
const IDB_STORE = 'dict';
const IDB_VERSION = 1;

const dbPromise = openDB(IDB_NAME, IDB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(IDB_STORE)) {
      db.createObjectStore(IDB_STORE);
    }
  }
});

let _tokenizerPromise = null;

/**
 * @param {(p: {phase: string, percent: number, label: string}) => void} onProgress
 * @returns {Promise<Tokenizer>}
 */
export function ensureKuromoji(onProgress = () => {}) {
  if (_tokenizerPromise) return _tokenizerPromise;
  _tokenizerPromise = loadInternal(onProgress).catch((e) => {
    _tokenizerPromise = null; // 失敗時は次回再試行
    throw e;
  });
  return _tokenizerPromise;
}

async function loadInternal(onProgress) {
  const base = import.meta.env.BASE_URL || '/';
  const dicPath = base.replace(/\/$/, '') + '/kuromoji-dict';

  // 1. 解凍済みバッファを 12個用意する（IDBにあれば再利用、なければダウンロード&解凍）
  const buffers = await loadAllDictBuffers(dicPath, onProgress);

  // 2. kuromoji の内部 API で辞書とトークナイザーを組み立てる
  onProgress({ phase: 'build', percent: 96, label: '形態素解析エンジンを構築中...' });
  await nextTick();

  const dic = new DynamicDictionaries();

  // base.dat & check.dat -> Trie
  dic.loadTrie(toInt32(buffers[0]), toInt32(buffers[1]));

  // tid.dat / tid_pos.dat / tid_map.dat -> TokenInfo
  dic.loadTokenInfoDictionaries(
    toUint8(buffers[2]),
    toUint8(buffers[3]),
    toUint8(buffers[4])
  );

  // cc.dat -> ConnectionCosts (Int16Array)
  dic.loadConnectionCosts(toInt16(buffers[5]));

  // unk.dat / unk_pos.dat / unk_map.dat / unk_char.dat / unk_compat.dat / unk_invoke.dat
  dic.loadUnknownDictionaries(
    toUint8(buffers[6]),
    toUint8(buffers[7]),
    toUint8(buffers[8]),
    toUint8(buffers[9]),
    toUint32(buffers[10]),
    toUint8(buffers[11])
  );

  const tokenizer = new Tokenizer(dic);
  onProgress({ phase: 'done', percent: 100, label: '準備完了' });
  return tokenizer;
}

/**
 * 12個の辞書ファイルを返す。可能なら IDB から、無ければダウンロード&解凍。
 * @returns {Promise<Uint8Array[]>}
 */
async function loadAllDictBuffers(dicPath, onProgress) {
  const db = await dbPromise;
  const result = new Array(DICT_FILES.length);

  // まず IDB からまとめて取り出してみる
  const cachedAll = await Promise.all(
    DICT_FILES.map((fname) => db.get(IDB_STORE, fname))
  );
  const allCached = cachedAll.every((v) => v instanceof Uint8Array && v.byteLength > 0);
  if (allCached) {
    onProgress({ phase: 'cache', percent: 90, label: 'キャッシュから辞書を読み込みました' });
    return cachedAll;
  }

  // ダウンロードが必要なものだけ処理
  const totals = new Array(DICT_FILES.length).fill(0);
  const received = new Array(DICT_FILES.length).fill(0);

  for (let i = 0; i < DICT_FILES.length; i++) {
    if (cachedAll[i]) {
      result[i] = cachedAll[i];
      totals[i] = cachedAll[i].byteLength;
      received[i] = cachedAll[i].byteLength;
      report(i, 'cache', 'キャッシュから読み込み中');
      continue;
    }

    const fname = DICT_FILES[i];
    const url = `${dicPath}/${fname}`;
    report(i, 'download', `ダウンロード中: ${fname}`);

    let response;
    try {
      response = await fetch(url, { cache: 'no-store' });
    } catch (e) {
      throw new Error(`ネットワークエラー: ${fname} - ${e.message}`);
    }
    if (!response.ok) {
      throw new Error(`辞書ファイル取得失敗: ${fname} (HTTP ${response.status})`);
    }

    const lenHeader = response.headers.get('content-length');
    totals[i] = lenHeader ? parseInt(lenHeader, 10) : 0;

    const reader = response.body?.getReader();
    const chunks = [];
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received[i] += value.byteLength;
        report(i, 'download', `ダウンロード中: ${fname}`);
      }
    } else {
      // ReadableStream が使えない場合は arrayBuffer に fallback
      const buf = await response.arrayBuffer();
      chunks.push(new Uint8Array(buf));
      received[i] = buf.byteLength;
      if (totals[i] === 0) totals[i] = buf.byteLength;
    }

    if (totals[i] === 0) totals[i] = received[i];

    // 結合 → gunzip
    report(i, 'decompress', `解凍中: ${fname}`);
    await nextTick();

    const merged = mergeChunks(chunks);
    let decompressed;
    try {
      decompressed = pako.ungzip(merged);
    } catch (e) {
      throw new Error(`辞書ファイルの解凍に失敗: ${fname} - ${e.message}`);
    }

    result[i] = decompressed;

    // IDBに保存
    try {
      await db.put(IDB_STORE, decompressed, fname);
    } catch (e) {
      console.warn('IDB put failed for', fname, e);
    }
    report(i, 'done', `完了: ${fname}`);
  }

  return result;

  function report(i, phase, action) {
    const totalBytes = totals.reduce((a, b) => a + b, 0);
    const recvBytes = received.reduce((a, b) => a + b, 0);
    const filesDone = received.filter((r, idx) => r > 0 && r === totals[idx]).length;
    // 0〜90% の範囲を辞書取得に割当（残りは構築フェーズ）
    const ratio = totalBytes > 0 ? recvBytes / totalBytes : (filesDone / DICT_FILES.length);
    const percent = Math.round(ratio * 90);
    const totalMB = (totalBytes / 1024 / 1024).toFixed(1);
    const recvMB = (recvBytes / 1024 / 1024).toFixed(1);
    onProgress({
      phase,
      percent,
      label: `${action}（${filesDone}/${DICT_FILES.length}ファイル, ${recvMB}/${totalMB} MB）`
    });
  }
}

// === ヘルパ ===

function mergeChunks(chunks) {
  const total = chunks.reduce((a, c) => a + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function toInt32(u8) {
  // Uint8Array → Int32Array（同じ ArrayBuffer を共有）
  return new Int32Array(u8.buffer, u8.byteOffset, Math.floor(u8.byteLength / 4));
}
function toInt16(u8) {
  return new Int16Array(u8.buffer, u8.byteOffset, Math.floor(u8.byteLength / 2));
}
function toUint32(u8) {
  return new Uint32Array(u8.buffer, u8.byteOffset, Math.floor(u8.byteLength / 4));
}
function toUint8(u8) {
  return u8 instanceof Uint8Array ? u8 : new Uint8Array(u8.buffer, u8.byteOffset, u8.byteLength);
}

// メインスレッドの UI 更新を確実にするためのヤィールド
function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
