# GOV-CORE OS なぞ解き公演用必須アセット・ファイル一覧構成表

本ドキュメントでは、GOV-CORE OS プレイヤー端末（子機 / Player OS）および管理端末（親機 / Management OS）をビルド・パッケージング、または本番運用する際に必要となるアセット・メディアファイルのファイル一覧、格納パス、およびビルド設定について解説します。

---

## 📁 1. 必須メディア・アセットファイル一覧

すべてのメディア、PDFドキュメント、および音源は、子機の `apps/child/public/` ディレクトリ配下に配置します。
これにより、Viteビルド時に自動的に `dist/` ディレクトリにコピーされ、Electron Builderパッケージへ封入されます。

### 子機（Player OS）側必須アセット一覧
| アセット分類 | 必須ファイル名 / フォルダ | 格納先相対パス（開発時） | 役割・用途 |
| :--- | :--- | :--- | :--- |
| **BGM (音源)** | `bgm.mp3` | `apps/child/public/bgm.mp3` | 親機のスタート待機中（PREPARE）から終了までループ再生されるバックグラウンドミュージック（※未配置の場合は電子合成音が自動再生されるセーフティ機構付） |
| **映像 ( unskippable )**| `start/` フォルダ内の動画 | `apps/child/public/videos/start/` | 親機で「なぞ解きスタート」を押した際、カウントダウン前に全員で一斉上映される強制介入ビデオファイル |
| **映像 ( unskippable )**| `admin/` フォルダ内の動画 | `apps/child/public/videos/admin/` | 管理者モード起動3秒後に再生される、全画面「緊急強制システム介入配信」ビデオファイル |
| **映像 ( 解説用 )**| `commentary/` フォルダ内の動画 | `apps/child/public/videos/commentary/` | 解説時などに使用するチュートリアルまたは解説ビデオファイル |
| **映像 ( 監視用 )**| `cam1.mp4` | `apps/child/public/videos/cam1.mp4` | ビデオセキュリティ監視グリッド 1ch 用のループ映像ファイル |
| **映像 ( 監視用 )**| `cam2.mp4` | `apps/child/public/videos/cam2.mp4` | ビデオセキュリティ監視グリッド 2ch 用のループ映像ファイル |
| **PDF (謎解き本編用)** | `doc1.pdf` | `apps/child/public/documents/doc1.pdf` | ロック解除後に表示される「機密文書 1」としてのフルスクリーン PDF ドキュメント |
| **PDF (謎解き本編用)** | `doc2.pdf` | `apps/child/public/documents/doc2.pdf` | 管理者デスクトップ内で閲覧する「機密文書 2」としての PDF ドキュメント |

---

## ⚙️ 2. ビルド・パッケージング構成設定

本番運用向けに Windows ポータブル実行ファイル（`.exe`）をパッケージする際、上記のアセットが確実にビルドに含まれるように、`apps/child/package.json` 内で以下のように明示設定を行っています。

### `apps/child/package.json`（抜粋）
```json
  "build": {
    "appId": "com.mad.child",
    "productName": "MAD-OS-CHILD",
    "directories": {
      "output": "../../dist/child"
    },
    "files": [
      "dist/**/*",
      "main.js",
      "preload.js",
      "package.json",
      "public/**/*"
    ],
    "win": {
      "target": "portable",
      "requestedExecutionLevel": "requireAdministrator"
    }
  }
```

*   `"dist/**/*"`: Vite によって高速ビルド・バンドルされた React レンダラーソース一式を含めます。
*   `"public/**/*"`: 上記の `bgm.mp3`、`doc1.pdf`、`cam1.mp4` などの巨大なアセットを含むディレクトリをそのままコピーしてパッケージングします。これにより、インストール不要なポータブルEXE単体で、すべての動画・音響演出がスタンドアロン動作可能となります。
