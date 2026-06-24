# MADOS (Molecular Analysis & Decoding OS) 運用ガイド

このドキュメントでは、MADOSの仕様、プラグインの一覧、および新しい機能の追加方法について詳しく解説します。

## 1. システム概要
MADOSは、ミステリーイベントや脱出ゲーム向けに設計された「デスクトップOSシミュレーター」です。
「Dark Minimalism」をコンセプトに、洗練されたインターフェースと、親機からの遠隔操作機能を備えています。

### 構成
- **子機 (Child App)**: プレイヤーが操作する端末。キオスクモードで動作し、システムへのアクセスを制限します。
- **親機 (Master App)**: 管理者が操作する指令センター。すべての子機の状態監視と遠隔操作を行います。

---

## 2. プラグイン一覧 (子機搭載アプリ)

現在、以下のようなプラグインが標準で組み込まれています。

| ID | 表示名 | 内容 |
| :--- | :--- | :--- |
| `terminal` | CORE_TERMINAL | コマンドライン風のログ表示・ナラティブ演出用。 |
| `calculator` | CALC_UNIT | シンプルな電卓。謎解きのヒントや計算に使用。 |
| `connection` | CONN_LINK | チャット形式の通信アプリ。親機側で送信内容をリアルタイム監視可能。 |

---

## 3. 遠隔管理機能 (親機)

親機から子機に対して、以下の「オーバーライド操作」が可能です。

- **アプリ強制起動**: 指定したプラグインを子機で強制的に開く。
- **システム凍結 (Freeze)**: 子機の入力を一切受け付けないハッキング状態にする。
- **エラーポップアップ**: 偽のシステム警告を表示。
- **画面揺れ (Shake)**: 物理的な衝撃やバグを演出。
- **通知送信**: 画面右上に5秒間だけ表示されるスタイリッシュな通知を送信。
- **リアルタイム監視**:
    - **セキュリティグリッド**: 全子機の前面カメラ映像をタイル状に同時表示。
    - **コネクションログ**: `CONN_LINK` アプリで入力された文字列をリアルタイムで表示。

---

## 4. 開発者向け：新しいプラグインの追加方法

MADOSは拡張性を重視して設計されています。新しいアプリ（プラグイン）を追加する手順は以下の通りです。

### 手順 1: プラグインコンポーネントの作成
`apps/child/src/plugins/` フォルダに新しいファイル（例: `MyNewApp.tsx`）を作成します。

```tsx
import React from 'react';
import { Star } from 'lucide-react'; // アイコン

const MyNewApp: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full text-white">
      新機能の内容
    </div>
  );
};

export const MyNewAppPlugin = {
  id: 'my-new-app',
  title: 'NEW_MODULE',
  icon: <Star size={18} />,
  component: MyNewApp,
};
```

### 手順 2: レジストリへの登録
`apps/child/src/plugins/registry.ts` を開き、作成したプラグインをインポートして配列に追加します。

```typescript
import { MyNewAppPlugin } from './MyNewApp';

export const PLUGINS: PluginDefinition[] = [
  TerminalPlugin,
  CalculatorPlugin,
  ConnectionPlugin,
  MyNewAppPlugin, // ここに追加
];
```

これで、子機のデスクトップとドックに自動的にアイコンが表示されるようになります。

---

## 5. 運用上の注意

- **キオスクモード**: 子機は `Alt+F4` などのショートカットを無効化します。終了には専用のパスワード（デフォルト: `MADREST104`）が必要です。
- **管理者権限**: Windowsでショートカット遮断を完全に行うため、子機アプリは「管理者として実行」される必要があります。
- **カメラアクセス**: 前面カメラへのアクセス許可が必要です。初回起動時にブラウザ/システムで許可してください。
