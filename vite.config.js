import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'node:path';

// GitHub Pages のサブパス。リポジトリ名が proofreading なので /proofreading/ 固定
const BASE = '/proofreading/';

export default defineConfig({
  base: BASE,
  plugins: [
    // kuromoji の辞書ファイル（dict/*.dat.gz）を public へコピーして配信
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/kuromoji/dict/*',
          dest: 'kuromoji-dict'
        }
      ]
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/icon.svg',
        'icons/icon-maskable.svg',
        'icons/apple-touch-icon.png',
        'dictionaries/*.json'
      ],
      manifest: {
        name: '日本語校正ツール',
        short_name: '校正',
        description: 'textlint互換の日本語校正をオフラインで実行できるPWA',
        lang: 'ja',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#1f6feb',
        icons: [
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'icons/icon-maskable.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable'
          },
          // PNG（npm run icons で生成）も登録しておく。存在しなくてもエラーにはならない
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ],
        share_target: {
          action: BASE + 'share',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url'
          }
        }
      },
      workbox: {
        // 辞書ファイル(.dat.gz, 計17MB) は precache に含めず、初回校正時に runtime cache する
        // これにより PWA インストール直後の白画面を防ぎつつ、辞書ファイルは
        // 進捗バー付きでダウンロード→以降オフラインで利用できる。
        globPatterns: [
          '**/*.{js,css,html,json,png,svg,webmanifest}'
        ],
        // 個別ファイル上限
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // SPA 用ナビゲーションフォールバック（ただし辞書 URL は除外する）
        navigateFallback: BASE,
        navigateFallbackDenylist: [/kuromoji-dict\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/kuromoji-dict/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'kuromoji-dict',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 },
              // Range リクエスト等にも対応
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /dictionaries\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'builtin-dictionaries' }
          }
        ]
      }
    })
  ],
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          kuromoji: ['kuromoji']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['kuromoji', 'idb', 'diff']
  },
  worker: {
    format: 'es'
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
      // kuromoji がブラウザで Node の path モジュールを参照するためポリフィル
      path: 'path-browserify'
    }
  }
});
