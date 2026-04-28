# 日本語校正ツール (proofreading)

iPhone / Android でオフライン動作する日本語校正の Progressive Web App (PWA) です。
textlint 互換のルールセットを採用し、辞書のインポート / エクスポートに対応します。

## 主な機能

- ✨ 日本語の校正（誤字・冗長表現・長文・敬語など 8 カテゴリ＋拡張）
- 📚 辞書 6 種類を標準搭載・複数辞書の同時有効化・インポート / エクスポート
- 💾 ドラフト自動保存・校正履歴（最新 5 件）
- 🌓 ダークモード対応・フォントサイズ変更
- ⌨️ ショートカット（Ctrl/⌘+Enter で校正、Ctrl/⌘+S で保存、Ctrl/⌘+K でクリア）
- 🔧 自動修正可能な指摘の一括適用、修正前後の差分表示
- 📤 プレーンテキスト / Markdown / HTML レポート形式でエクスポート
- 🔊 Web Speech API による読み上げ
- 🎯 ルールごとの重要度カスタマイズ（warning↔error、無効化）
- 🚫 指摘の個別 / 全文書での無視
- 📊 読みやすさスコア（文字数・平均文長・漢字率）
- 📱 PWA 共有ターゲット（他アプリから共有メニュー経由でテキスト投入）
- 🛜 完全オフライン動作（一度開けばネット接続不要）

## 校正カテゴリと対応ルール

8 カテゴリ＋拡張カテゴリをカバーするルールを `src/rules/` に実装しています。

| カテゴリ | 対応ルール |
| --- | --- |
| 1. 誤字・脱字・表記ゆれ | `dictionary` (`ja-basic`)、`hiragana-keishikimeishi`、`notation-consistency` |
| 2. 文法・助詞 | `no-doubled-joshi`、`subject-predicate` |
| 3. 文の構造・わかりやすさ | `sentence-length`、`max-comma` |
| 4. 冗長表現 | `redundant-expression`、`no-successive-word`、`dictionary` (`ja-redundant`) |
| 5. 文末・トーン統一 | `no-mix-dearu-desumasu` |
| 6. 語彙の適切さ | `dictionary` (`ja-keigo` / `ja-business` / `ja-tech` / `ja-idiom`) |
| 7. 論理構成 | `no-doubled-conjunction` |
| 8. 読み手への配慮 | `ambiguous-expression` |
| 拡張: 句読点・記号 | `bracket-matching`（カッコ閉じ忘れ・種類不一致） |
| 拡張: 数字・形式 | `number-format`（全角/半角混在、日付形式、単位、金額カンマ） |

## 標準搭載辞書

`public/dictionaries/` にJSON形式で配置されています。

| 辞書 ID | 内容 | デフォルト |
| --- | --- | --- |
| `ja-basic` | 誤字・送り仮名・表記ゆれ（以来→依頼、行なう→行う 等 30 種） | ✅ 有効 |
| `ja-redundant` | 冗長表現（〜することができる→できる 等 17 種） | ✅ 有効 |
| `ja-keigo` | 敬語・二重敬語（おっしゃられる→おっしゃる 等 11 種） | ✅ 有効 |
| `ja-idiom` | 慣用句・四字熟語の誤用（汚名挽回→汚名返上 等 30 種） | ✅ 有効 |
| `ja-tech` | 技術用語の表記統一（JavaScript、GitHub 等 15 種） | ✅ 有効 |
| `ja-business` | ビジネス文書の言い回し（10 種） | ⬜ 任意 |

## セットアップ

```bash
git clone https://github.com/utausnskareshi/proofreading.git
cd proofreading
npm install
npm run dev   # http://localhost:5173/proofreading/
```

### PNG アイコンの生成（任意）

iOS Safari の `apple-touch-icon` 用に PNG を生成します。

```bash
npm install --save-dev sharp
npm run icons
```

## 辞書フォーマット（prh 互換）

```json
{
  "version": 1,
  "name": "辞書名",
  "description": "説明",
  "rules": [
    {
      "expected": "ください",
      "patterns": ["下さい"],
      "severity": "info",
      "message": "補助動詞の「ください」は通常ひらがなで書きます"
    },
    {
      "expected": "依頼",
      "patterns": ["/以来(?=し|する|したい|したく|して|します)/g"],
      "severity": "error",
      "message": "「依頼」の誤りではありませんか？"
    }
  ]
}
```

- `patterns` は文字列（部分一致）または `/regex/flags` 形式（正規表現）
- `severity`: `"error"` / `"warning"` / `"info"`
- `expected`: 自動修正で置換される文字列（`fix` の対象）
- 正規表現には**先読み (`?=...`) / 後読み (`?<=...`)** を活用すると、誤検出を抑制できます

## アーキテクチャ

```
proofreading/
├── index.html                 # 画面定義（オンボーディング + メイン）
├── src/
│   ├── main.js                # エントリーポイント（画面遷移）
│   ├── editor.js              # エディタ・ハイライト・結果表示
│   ├── linter.js              # 校正パイプライン
│   ├── kuromoji-loader.js     # 形態素解析エンジン（pako + IndexedDB キャッシュ）
│   ├── rules/                 # ルール群
│   │   ├── index.js
│   │   ├── rule-dictionary.js          # 辞書ベース校正
│   │   ├── rule-notation-consistency.js # 表記ゆれ検出
│   │   ├── rule-bracket-matching.js     # カッコ閉じ忘れ
│   │   ├── rule-number-format.js        # 数字・日付・単位
│   │   ├── rule-sentence-length.js
│   │   ├── rule-no-mix-dearu-desumasu.js
│   │   ├── rule-no-doubled-joshi.js
│   │   ├── rule-no-doubled-conjunction.js
│   │   ├── rule-redundant-expression.js
│   │   ├── rule-max-comma.js
│   │   ├── rule-no-successive-word.js
│   │   ├── rule-subject-predicate.js
│   │   ├── rule-hiragana-keishikimeishi.js
│   │   └── rule-ambiguous-expression.js
│   ├── dictionary.js          # 辞書管理（IndexedDB）
│   ├── settings.js            # 設定（テーマ、ルール強度）
│   ├── history.js             # 校正履歴
│   ├── storage.js             # IndexedDB ラッパー
│   ├── readability.js         # 読みやすさスコア
│   ├── speech.js              # 読み上げ
│   ├── diff.js                # 差分表示ダイアログ
│   ├── ui.js                  # トースト・共通UI
│   └── styles.css
├── public/
│   ├── icons/                 # PWAアイコン（SVG + PNG）
│   └── dictionaries/          # 標準辞書 (6種類)
├── scripts/
│   └── generate-icons.mjs     # SVG → PNG 変換（任意）
├── .github/
│   └── workflows/deploy.yml   # GitHub Pages 自動デプロイ
├── LICENSE                    # MIT
├── NOTICE.md                  # サードパーティ表示
└── vite.config.js
```

## 技術スタック

| 領域 | 採用 |
| --- | --- |
| フロントエンド | Vanilla JS + Vite |
| PWA | `vite-plugin-pwa`（Workbox 自動生成） |
| 形態素解析 | `kuromoji` + 内蔵 MeCab-IPADic |
| 解凍 | `pako` |
| 永続化 | IndexedDB（`idb` ラッパー） |
| 差分表示 | `diff` |
| デプロイ | GitHub Actions → GitHub Pages |

## 動作要件

- **ブラウザ**: Safari 16.4+ / Chrome 105+ / Edge 105+ / Firefox 105+
  - 正規表現の後読み `(?<=...)` を使うため、古い iOS Safari (16.3 以下) では一部辞書ルールが無効になります
- **初回利用時のみ**: 形態素解析辞書 (約 17MB) をダウンロード（IndexedDB にキャッシュ）。以降は完全オフライン動作
- **ストレージ**: 約 50MB（解凍後辞書）

## ライセンス

このプロジェクト本体のソースコードは **MIT License** で配布されています。詳細は [LICENSE](./LICENSE) を参照してください。

本プロジェクトは以下のサードパーティ・オープンソースソフトウェアを利用しています。各ライブラリのライセンス情報は [NOTICE.md](./NOTICE.md) を参照してください。

- [kuromoji.js](https://github.com/takuyaa/kuromoji.js) (Apache License 2.0)
- [MeCab IPADIC](http://atilika.com/releases/mecab-ipadic/) (Nara Institute of Science and Technology / ICOT Free Software)
- [pako](https://github.com/nodeca/pako) (MIT AND Zlib)
- [idb](https://github.com/jakearchibald/idb) (ISC)
- [diff](https://github.com/kpdecker/jsdiff) (BSD-3-Clause)
- [path-browserify](https://github.com/browserify/path-browserify) (MIT)
- [Vite](https://github.com/vitejs/vite) / [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) / [vite-plugin-static-copy](https://github.com/sapphi-red/vite-plugin-static-copy) (MIT)
