/**
 * IndexedDB ラッパー
 * ストア:
 *  - drafts: 自動保存される最新ドラフト
 *  - history: 校正履歴（最新5件）
 *  - dictionaries: ユーザーが追加した辞書 + 標準辞書のメタ
 *  - ignoreList: 無視リスト（ユーザーが個別に消した指摘）
 *  - settings: アプリ設定
 */
import { openDB } from 'idb';

const DB_NAME = 'proofreading-db';
const DB_VERSION = 1;

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('drafts')) {
      db.createObjectStore('drafts', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('history')) {
      const s = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
      s.createIndex('updatedAt', 'updatedAt');
    }
    if (!db.objectStoreNames.contains('dictionaries')) {
      db.createObjectStore('dictionaries', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('ignoreList')) {
      db.createObjectStore('ignoreList', { keyPath: 'key' });
    }
    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings', { keyPath: 'key' });
    }
  }
});

// === ドラフト ===
export async function saveDraft(text) {
  const db = await dbPromise;
  await db.put('drafts', { id: 'current', text, updatedAt: Date.now() });
}

export async function loadDraft() {
  const db = await dbPromise;
  const v = await db.get('drafts', 'current');
  return v?.text ?? '';
}

// === 履歴 ===
export async function pushHistory(entry) {
  const db = await dbPromise;
  await db.add('history', { ...entry, updatedAt: Date.now() });
  // 5件超過を削除
  const all = await db.getAllFromIndex('history', 'updatedAt');
  if (all.length > 5) {
    const tx = db.transaction('history', 'readwrite');
    for (const e of all.slice(0, all.length - 5)) {
      await tx.store.delete(e.id);
    }
    await tx.done;
  }
}

export async function listHistory() {
  const db = await dbPromise;
  const all = await db.getAllFromIndex('history', 'updatedAt');
  return all.reverse();
}

export async function deleteHistory(id) {
  const db = await dbPromise;
  await db.delete('history', id);
}

// === 辞書 ===
export async function listDictionaries() {
  const db = await dbPromise;
  return await db.getAll('dictionaries');
}

export async function getDictionary(id) {
  const db = await dbPromise;
  return await db.get('dictionaries', id);
}

export async function saveDictionary(dict) {
  const db = await dbPromise;
  await db.put('dictionaries', dict);
}

export async function deleteDictionary(id) {
  const db = await dbPromise;
  await db.delete('dictionaries', id);
}

// === 無視リスト ===
/**
 * ユーザーが「全文書で無視」した指摘を保持。
 * key は ruleId + パターンなどから生成。
 */
export async function addIgnoreEntry(entry) {
  const db = await dbPromise;
  await db.put('ignoreList', entry);
}

export async function listIgnoreEntries() {
  const db = await dbPromise;
  return await db.getAll('ignoreList');
}

export async function deleteIgnoreEntry(key) {
  const db = await dbPromise;
  await db.delete('ignoreList', key);
}

// === 設定 ===
export async function getSetting(key, defaultValue = null) {
  const db = await dbPromise;
  const v = await db.get('settings', key);
  return v ? v.value : defaultValue;
}

export async function setSetting(key, value) {
  const db = await dbPromise;
  await db.put('settings', { key, value });
}

export async function clearAllStorage() {
  const db = await dbPromise;
  for (const s of ['drafts', 'history', 'dictionaries', 'ignoreList', 'settings']) {
    await db.clear(s);
  }
  localStorage.clear();
}
