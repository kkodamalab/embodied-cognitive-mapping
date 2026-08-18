# Embodied Cognitive Mapping

身体性認知科学の理論・概念を3次元空間へ配置し、研究者ごとの見方を作成・比較・共同編集するWebアプリです。

## Implemented

- XYZ軸、グリッド、軸ラベル、10件のサンプル概念
- 回転・ズーム・パン、TransformControlsによる移動と変形
- XYZ座標、基本サイズ、Scale X/Y/Z、色、透明度、名称、説明、分類の編集
- object追加・複製・削除・位置リセット
- 研究者別Viewタブ、New・Rename・Duplicate・Save・Delete・Read only
- Viewごとの軸ラベル・camera・connections/layers拡張領域
- JSON Import / Export
- Room作成・参加・URLコピー
- Supabase Database永続化、View単位Realtime同期、簡易プレゼンス
- Supabase未設定時のローカル保存モード

## Technology

React 19、TypeScript、vinext/Vite、Three.js、React Three Fiber/Drei、Supabase Database/Realtime。

## Local setup

Node.js 22.13以上とpnpm 11以上が必要です。

```bash
pnpm install
Copy-Item .env.example .env.local   # Windows PowerShell
pnpm dev
```

macOS/Linuxでは `cp .env.example .env.local` を使用してください。Supabaseなしでもローカルモードで起動します。

## Supabase setup

1. Supabaseで新規Projectを作成します。
2. SQL Editorで `supabase/migrations/202608180001_create_ecm_views.sql` を実行します。
3. Project Settings → APIからProject URLとAnon Keyを取得します。
4. `.env.local` を設定します。

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Service Role Keyはブラウザや `.env.local` に設定しないでください。`.env*` は `.gitignore` 対象で、`.env.example` のみ追跡されます。

Ver.2はアカウントを持たず、推測困難なRoom URLを共有キーとして使用します。公開運用では、認証と所有者ベースのRLSへ移行してください。

## Build

```bash
pnpm lint
pnpm build
```

## Rooms and Views

- `New room` でRoom IDを生成し、`Copy URL` で共同研究者へ共有します。
- 同じ `/room/{roomId}` を開くと同じView一覧を読み込みます。
- 同じViewを開いた利用者にだけ、そのViewのRealtime変更が反映されます。
- `Duplicate` で他者Viewを自分の編集可能なViewとして複製できます。

## View JSON

View JSONは `id`, `roomId`, `name`, `ownerName`, `readOnly`, `axisLabels`, `camera`, `objects`, `connections`, `layers`, `createdAt`, `updatedAt` を持ちます。各objectは概念情報と、座標・scale・色・opacity等のView表現を保持します。

## Deployment

production環境へ `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を登録してからdeployしてください。Service Role Keyを登録してはいけません。

## Known limitations / TODO

- Compareの重ね合わせ表示とUndo/RedoはVer.2.1予定
- camera位置のデータ領域はあるが、現在のカメラ操作結果の自動保存は未実装
- Ver.2の匿名RLSはRoom URLを知る利用者向け。公開探索や厳密な所有権には認証が必要
- theory connections、layer表示、multimedia、WebXRは将来拡張
