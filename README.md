# create-wiki-kit

wiki-kit プロジェクトを作成する CLI です。

## 前提条件

- Node.js 20+
- git

## 使い方

```bash
npm create wiki-kit
```

または

```bash
npx create-wiki-kit release-wiki
```

`project-name` には単一ディレクトリ名を指定します。`../release-wiki` や `nested/release-wiki` は使えません。

## 例

```bash
npx create-wiki-kit release-wiki
cd release-wiki
```

## 実行内容

- `wiki-kit-template` からテンプレートを取得する
- git 履歴を削除する
- `.gitkeep` を削除する

## ローカル開発

`wiki-kit-template` をまだ push していない段階でも、ローカルの clone から動作確認できます。

```bash
node index.js release-wiki --template-path ../wiki-kit-template
```

必要なら取得 ref も上書きできます。

```bash
node index.js release-wiki --template-ref main
```

## テンプレート

- リポジトリ: https://github.com/haya-inc/wiki-kit-template
- デフォルト ref: `main`

安定運用に入ったら、`create-discovery-kit` と同様に固定 commit ref へ切り替える想定です。

## リリース

- GitHub Release の tag は `package.json` の version と一致している必要があります。`v` プレフィックスは利用できます。
- prerelease は npm の `next` dist-tag で公開され、stable release のみ `latest` に公開されます。
