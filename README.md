# Embodied Cognitive Mapping

身体性認知科学の理論・概念を3次元空間へ配置し、研究者ごとの見方を作成・比較・共同編集するWebアプリです。

基本操作は[日本語マニュアル](docs/USER_GUIDE_JA.md)を参照してください。

## Implemented

- XYZ軸、グリッド、軸ラベル、10件のサンプル概念
- 球体の直接ドラッグ、回転・ズーム・パン、TransformControlsによる移動と変形
- XYZ座標、基本サイズ、Scale X/Y/Z、カテゴリカル色、透明度、名称、説明、分類の編集
- 3D画面上でのXYZ軸ラベルのインライン編集
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

## 3D interaction

- `Move` モードでは球体を左ドラッグすると、掴んだ位置を保ちながら現在のカメラに平行なscreen-plane上を移動します。ドラッグ中はカメラ回転が停止し、Object EditorのXYZ値がリアルタイムに更新されます。
- `Shift + 左ドラッグ` はワールドZ方向の奥行き操作です。上へドラッグするとZが増え、下へドラッグすると減ります。
- 位置は直接ドラッグ、Transform gizmo、Object EditorのXYZ数値入力の3方式で編集できます。
- 空白部分のドラッグでカメラ回転、ホイールでズーム、右ドラッグでパンします。
- XYZ軸ラベルは3D画面上のラベルをダブルクリックして編集できます。`Enter` またはフォーカスアウトで確定、`Esc` でキャンセルします。軸名はViewごとに保存・同期されます。
- 上部モードは `Move`、`Shape`、`Connect` です。`Connect` は将来実装のため現在disabledです。

## Category and color

通常の色操作は、ダーク背景で識別しやすい12色の離散パレットを使います。スウォッチを選ぶと即時反映され、自由色は `Custom color…` を開いた場合にのみ指定できます。Opacityは色と独立した0.05〜1.0の値です。

各Viewは `PaletteColor { id, name, hex }` と `Category { id, name, defaultColorId }` を保持します。各objectは `categoryId`、`colorId`、`customColor` を持てるため、Category由来の色と明示的な上書きを区別できます。Categoryを変更するとそのCategoryの既定色を適用し、その後スウォッチまたはCustom colorで個別に上書きできます。`Category palette` からCategoryごとの既定色を変更できます。これらはView JSON、Supabase永続化、Realtime同期の対象です。

## View JSON

View JSONは `id`, `roomId`, `name`, `ownerName`, `readOnly`, `axisLabels`, `camera`, `palette`, `categories`, `objects`, `connections`, `layers`, `createdAt`, `updatedAt` を持ちます。各objectは概念情報と、座標・scale・categoryId・colorId・customColor・opacity等のView表現を保持します。

## Deployment

production環境へ `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を登録してからdeployしてください。Service Role Keyを登録してはいけません。

### GitHub Pages static demo

`main` へのpushで `.github/workflows/deploy-pages.yml` が静的デモをGitHub Pagesへ公開します。GitHubの **Settings → Pages** でSourceを **GitHub Actions** に設定してください。公開先は `https://kkodamalab.github.io/embodied-cognitive-mapping/` です。

GitHub Pages版はブラウザ内のLocal modeで動作します。Supabaseの環境変数をGitHub Secretsに設定しない限り、Realtime共同編集は有効になりません。

## Known limitations / TODO

- Compareの重ね合わせ表示とUndo/RedoはVer.2.1予定
- camera位置のデータ領域はあるが、現在のカメラ操作結果の自動保存は未実装
- Ver.2の匿名RLSはRoom URLを知る利用者向け。公開探索や厳密な所有権には認証が必要
- theory connections、layer表示、multimedia、WebXRは将来拡張
