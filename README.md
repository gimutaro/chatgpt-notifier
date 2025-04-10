# ChatGPT通知ツール

ChatGPTが回答生成を完了したら通知を送るChrome拡張機能です。

## 概要

ChatGPT通知ツールは、ChatGPTが回答の生成を完了したときにデスクトップ通知を送信するChrome拡張機能です。ChatGPTを使用中に他の作業をしていても、回答が完了したことをすぐに知ることができます。

## 主な機能

- ChatGPTの回答生成完了時に通知
- Deep Research（検索機能）の完了時に通知
- 長時間処理の検出と完了通知
- 通知のオン/オフ切り替え
- テスト通知機能

## インストール方法

1. このリポジトリをクローンまたはダウンロードします
2. Chromeブラウザで `chrome://extensions` を開きます
3. 右上の「デベロッパーモード」をオンにします
4. 「パッケージ化されていない拡張機能を読み込む」をクリックします
5. ダウンロードしたフォルダを選択します

## 使用方法

1. 拡張機能をインストールすると、Chromeの右上にアイコンが表示されます
2. アイコンをクリックすると設定画面が開きます
3. トグルスイッチで通知のオン/オフを切り替えられます
4. 「テスト通知を送信」ボタンで通知機能をテストできます
5. ChatGPTを通常通り使用し、回答生成が完了すると通知が届きます

## 技術的な詳細

この拡張機能は以下のコンポーネントで構成されています：

- **manifest.json**: 拡張機能の設定ファイル
- **background.js**: バックグラウンドで動作し、通知を管理するスクリプト
- **content.js**: ChatGPTのページで動作し、回答生成状態を監視するスクリプト
- **popup.html/popup.js**: 設定画面のUIとその制御スクリプト
- **icon48.png/icon128.png**: 拡張機能のアイコン

特に、content.jsでは以下の機能を実装しています：

- DOM要素の監視による回答生成状態の検出
- Deep Research（検索機能）の検出と監視
- 長時間処理の検出と適応的な監視間隔の調整
- エラー回復メカニズム

## 対応サイト

- https://chat.openai.com/
- https://chatgpt.com/

## ライセンス

MITライセンス