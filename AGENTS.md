# AGENTS.md

## Project name

Repository name: rental-photo-ledger

App display name: 賃貸写真台帳メーカー

## Project purpose

このプロジェクトは、賃貸物件の入居時・退去時の状態を写真、間取り図、カテゴリー、コメント、日付と一緒に記録し、PDF台帳として出力するPWAを開発するためのものです。

このアプリは法律判断を行いません。

目的は、状態の記録、整理、共有補助です。
また、特定の個人を特定できる情報（物件名や住所など）を入力はできる限り避けてください。

## Hard rules

- 絶対に `git push` しない。
- 絶対に `gh pr create` しない。
- 絶対に外部クラウドサービスを勝手に追加しない。
- 絶対に有料APIを勝手に追加しない。
- 絶対に認証機能を勝手に追加しない。
- 絶対に秘密情報、APIキー、トークン、パスワードを作成・変更・読み取りしない。
- `.env`、`.env.local`、`.env.production` などの環境変数ファイルは勝手に作成・変更・読み取りしない。
- 依存関係を追加する前に、理由、候補、影響を説明する。
- 一度に大きく作りすぎない。
- 作業は小さな単位に分ける。
- 変更後は可能な範囲で検証コマンドを実行する。
- 失敗したテストやビルドを放置しない。
- pushは禁止だが、明確な作業単位ごとのローカルコミットは許可する。

## Git policy

作業開始時に必ず実行してください。

```bash
git status
```

作業後も必ず実行してください。

```bash
git status
```

ローカルコミットを行う場合、コミットメッセージは日本語で分かりやすくしてください。

例:

```text
初期画面を作成
物件データの型定義を追加
間取りPDFアップロード機能を追加
番号ピンの保存処理を追加
```

禁止:

```bash
git push
```

禁止:

```bash
gh pr create
```

禁止:

```bash
npm publish
```

禁止:

```bash
vercel deploy
```

禁止:

```bash
firebase deploy
```

## Development environment

想定環境:

- Windows
- GitHub
- SourceTree
- Codex app
- Node.js
- npm
- React
- TypeScript
- Vite

## Technical direction

MVPではバックエンドを持たないPWAとして開発します。

推奨技術:

- React
- TypeScript
- Vite
- Tailwind CSS
- IndexedDB
- Dexie
- pdf.js
- pdf-lib
- Web Share API
- Vitest
- Playwright

MVPではサーバー保存を行いません。

写真、PDF、台帳データはブラウザ内のローカル保存を基本にします。

## Product boundaries

このアプリは、法律判断をしてはいけません。

禁止表現:

- 証拠になります
- 退去費用を減らせます
- 請求を拒否できます
- これは貸主負担です
- これは借主負担です
- 法的に有効です
- 原状回復費用を回避できます

推奨表現:

- 状態を記録します
- 写真台帳を作成します
- 共有しやすくします
- 確認漏れを減らします
- 記録日時を残します
- 入居時の状態を整理します
- 管理会社や仲介会社に共有しやすい形式にまとめます

## MVP scope

最初のMVPでは、以下を作成します。

1. 物件作成
2. 物件一覧
3. 物件詳細
4. 間取りPDFアップロード
5. 間取りPDFプレビュー
6. 間取り図への番号ピン配置
7. 番号ピンごとの場所名入力
8. 番号ピンごとの写真登録
9. 写真ごとのカテゴリー選択
10. 写真ごとのコメント入力
11. 入居時チェックリスト
12. 日付入りPDF台帳出力
13. PDF保存
14. Web Share APIによる共有
15. Web Share APIが使えない場合の代替表示

## Out of scope for MVP

MVPでは以下を作らないでください。

- ログイン機能
- 会員登録
- クラウド同期
- 決済
- 有料プラン
- 管理会社向け管理画面
- AIによる傷や汚れの自動判定
- 法律アドバイス
- チャット相談
- サーバー保存
- 外部データベース連携
- 本番デプロイ

## Data model direction

最低限、以下のデータを扱えるようにしてください。

### Property

物件情報。

- id
- name
- address
- moveInDate
- moveOutDate
- createdAt
- updatedAt

### FloorPlan

間取りPDF情報。

- id
- propertyId
- fileName
- fileBlob
- pageCount
- createdAt
- updatedAt

### FloorPlanPin

間取り上の番号ピン。

- id
- propertyId
- floorPlanId
- label
- placeName
- x
- y
- createdAt
- updatedAt

x と y は、表示サイズに依存しない正規化座標で保存してください。

例: 0.0 から 1.0 の範囲。

### PhotoRecord

写真記録。

- id
- propertyId
- pinId
- category
- comment
- imageBlob
- imageFileName
- takenAt
- createdAt
- updatedAt

### ChecklistItem

入居時チェックリスト項目。

- id
- propertyId
- room
- label
- isChecked
- note
- createdAt
- updatedAt

### ExportHistory

PDF出力履歴。

- id
- propertyId
- fileName
- exportedAt

## Category list

MVPでは以下のカテゴリーを使用してください。

- 壁
- 床
- 天井
- ドア
- 窓
- 収納
- キッチン
- 浴室
- 洗面
- トイレ
- 水回り
- エアコン
- 電気設備
- 備え付け設備
- ベランダ
- その他

## UI policy

- スマートフォン優先
- ボタンは大きくする
- 1画面1目的を基本にする
- 初心者に分かりやすい文言にする
- 専門用語をできるだけ避ける
- エラーメッセージは日本語にする
- 操作に迷ったときの説明を表示する
- 写真登録までの導線を短くする

## PDF export policy

PDF台帳には以下を含めてください。

### 表紙

- アプリ名
- 作成日
- 注意書き

注意書き:

```text
この台帳は、部屋の状態を記録・整理することを目的としたものです。法律判断や費用負担の判断を行うものではありません。
```

### 間取り図ページ

- 読み込んだ間取りPDF
- 番号ピン

### 写真台帳ページ

- ピン番号
- 場所名
- カテゴリー
- コメント
- 登録日時
- 写真

