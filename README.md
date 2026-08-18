# Embodied Cognitive Mapping

身体性認知科学の理論・概念を3次元空間に配置し、位置関係を探索・議論するためのWebアプリです。現在は段階開発中で、Phase 1として3Dマッピング空間を実装しています。

## Current status: Phase 1

- XYZ軸、グリッド、原点、軸ラベル
- 10件のサンプル概念を球体とラベルで表示
- マウスによる回転、ズーム、パン
- 球体の選択とハイライト、位置情報の表示
- PCを優先したレスポンシブレイアウト

## Technology

- React 19 / TypeScript
- vinext / Vite
- Three.js
- React Three Fiber / Drei
- Supabase Database / Realtime（Phase 4–5で導入予定）

## Requirements

- Node.js 22.13.0以上
- pnpm 11以上

## Install and run locally

```bash
pnpm install
pnpm dev
```

表示されたローカルURLをブラウザで開いてください。

## Build

```bash
pnpm build
```

## Environment variables and Supabase

`.env` と `.env.*` はGitの追跡対象外です。クライアントでは公開用のSupabase URLとAnon Keyだけを使用し、Service Role Keyは絶対に設定しません。

Phase 4では次の雛形を `.env.example` として追加します。

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

RLSを有効にし、Room単位の最小権限ポリシーを設定する予定です。

## Deployment

Phase 5の共同編集確認後、GitHub連携またはSites / Vercel / Netlify等で公開できる構成にします。環境変数は各ホスティングサービスの設定画面で登録し、GitHubには保存しません。

## Room creation

Room機能はPhase 4で実装予定です。完成後は `/room/{roomId}` を作成し、同じURLを開いた利用者が同じViewを編集できます。

## Planned JSON format

```json
{
  "id": "view-id",
  "name": "Default View",
  "axisLabels": { "x": "...", "y": "...", "z": "..." },
  "objects": [],
  "cameraPosition": [12, 10, 14],
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

各objectは `id`, `name`, `x`, `y`, `z`, `size`, `color`, `description`, `category` を基本フィールドとして持ちます。

## Roadmap

- Phase 2: object選択・直接ドラッグ・編集・追加・複製・削除
- Phase 3: View保存・読込・JSON import/export・Undo/Redo
- Phase 4: Supabase、Room、永続化
- Phase 5: Realtime共同編集と編集プレゼンス
- Later: theory connections, layers, multimedia, WebXR

## Security

- `.env`、秘密鍵、Service Role Keyをコミットしない
- ブラウザにはAnon Key以外の権限キーを置かない
- Supabase導入時はRow Level Securityを有効にする
- ImportするJSONはスキーマ検証してから利用する
