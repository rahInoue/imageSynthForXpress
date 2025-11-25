# アクリルスタンド画像処理システム - アップデート情報

## 📋 概要
アクリルスタンド印刷用の画像処理システムに対する2025年10月の改善内容をまとめたドキュメントです。

## 🆕 最新機能: receiveType別処理（2025-10-08追加）
受け取り方法（イベント受け取り/配送）ごとに分けて処理する機能を追加しました。

---

## 🎯 主な改善点

### 1. 白板（ノックアウト）処理の改善
印刷品質向上のため、白板処理を大幅に改善しました。

#### 問題点と解決策
- **問題**: 半透明部分の印刷品質が不安定、細い線が消える、透過画像が印刷されない
- **解決**:
  - 収縮量を0.2mm → 0.1mmに削減
  - 完全2値化処理を実装（半透明の白板を排除）
  - 3つの処理モードを追加

#### 白板処理モード

| モード | threshold | 説明 | 用途 |
|--------|-----------|------|------|
| **aggressive** | 10/255 (4%) | 最も緩い設定、ほぼ全てを白板化 | 透過画像が多い場合 |
| **normal** | 20/255 (8%) | バランス型（推奨） | 通常のイラスト |
| **minimal** | 50/255 (20%) | 最も厳しい設定 | 細かいディテール重視 |

### 2. ロゴレイヤーのサポート追加
- `sheet_logos.png`: ロゴ画像レイヤー
- `sheet_logo_knock.png`: ロゴ用白板レイヤー（新規追加）
- AIファイル、PSDファイルの両方に対応

### 3. 並列処理による高速化
- **index_parallel.py**: 画像処理の並列化版を追加
- 画像読み込みと各ページ生成を並列処理
- 処理時間を約50-70%短縮

### 4. AIファイル生成の改善
- 画像の埋め込み処理を修正（リンク切れ防止）
- 高速版スクリプト追加（import_layers_to_ai_fast.jsx）
- 待機時間の最適化

### 5. receiveType別処理機能（NEW!）
- 受け取り方法（イベント/配送）で自動分類
- 別々のディレクトリに出力
- 一括処理スクリプト付き

---

## 📁 ファイル構成

### メインスクリプト
- `index.py` - 標準版画像処理スクリプト
- `index_parallel.py` - 並列処理版（高速）
- `import_layers_to_ai.jsx` - AIファイル生成
- `import_layers_to_ai_fast.jsx` - AIファイル生成（高速版）
- `makePSD.js` - PSDファイル生成

### 補助スクリプト
- `create_ai_batch.sh` - AIファイルバッチ処理
- `run_ai.sh` - AIファイル生成実行スクリプト

### receiveType別処理スクリプト（NEW!）
- `filter_by_receive_type.py` - receiveTypeでフィルタリング
- `import_layers_to_ai_by_receive_type.jsx` - receiveType別AI生成
- `process_by_receive_type.sh` - 一括自動処理

---

## 🚀 使い方

### 基本的な使用方法（推奨）

```bash
# 1. 画像生成（normalモード、収縮0.05mm）
python3 index.py --sheet 280x580 \
  --images "$(cat 202508/order_images.test.json)" \
  --output-dir output \
  --knockout-mode normal \
  --knockout-shrink 0.05

# 2. AIファイル生成
osascript import_layers_to_ai.jsx
```

### 高速処理（並列版）

```bash
# 1. 画像生成（並列処理版）
python3 index_parallel.py --sheet 280x580 \
  --images "$(cat 202508/order_images.test.json)" \
  --output-dir output \
  --knockout-mode normal \
  --knockout-shrink 0.05 \
  --workers 8

# 2. AIファイル生成（高速版）
osascript import_layers_to_ai_fast.jsx
```

### receiveType別処理（NEW!）

#### 完全自動処理（推奨）
```bash
# receiveType別に画像生成からAIファイル作成まで全自動
./process_by_receive_type.sh
```

#### 個別処理

**receiveType=0（イベント受け取り）のみ：**
```bash
# フィルタリングして処理
python3 filter_by_receive_type.py --receive-type 0 --run-command

# AIファイル生成
osascript import_layers_to_ai_by_receive_type.jsx
```

**receiveType=1（配送）のみ：**
```bash
# フィルタリングして処理
python3 filter_by_receive_type.py --receive-type 1 --run-command

# AIファイル生成
osascript import_layers_to_ai_by_receive_type.jsx
```

#### 出力ディレクトリ構成
```
📁 プロジェクト/
├── 📁 output_receive_0/        # イベント受け取り用画像
├── 📁 output_receive_1/        # 配送用画像
├── 📁 ai_output_event_pickup/  # イベント受け取り用AI
└── 📁 ai_output_delivery/      # 配送用AI
```

### 用途別の設定例

#### 透過画像が多い場合
```bash
python3 index.py --sheet 280x580 \
  --images "$(cat 202508/order_images.test.json)" \
  --output-dir output \
  --knockout-mode aggressive \
  --knockout-shrink 0
```

#### 細かいディテール重視
```bash
python3 index.py --sheet 280x580 \
  --images "$(cat 202508/order_images.test.json)" \
  --output-dir output \
  --knockout-mode minimal \
  --knockout-shrink 0.15
```

---

## 📊 処理時間の比較

39ページ（約700枚のカード）処理時の目安：

| 方法 | 画像処理 | AI生成 | 合計 |
|------|---------|--------|------|
| 通常版 | 約2分 | 約10分 | 約12分 |
| 最適化版 | 約2分 | 約5分 | 約7分 |
| 並列処理版 | 約30秒 | 約3分 | 約3.5分 |

---

## 🔧 コマンドラインオプション

### index.py / index_parallel.py

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| --sheet | 280x580 | シート寸法（mm） |
| --images | (必須) | 画像情報のJSON |
| --output-dir | output | 出力ディレクトリ |
| --knockout-mode | normal | 白板処理モード |
| --knockout-shrink | 0.1 | 白板収縮量（mm） |
| --workers | CPUコア数 | 並列ワーカー数（parallel版のみ） |

---

## 📝 レイヤー構成

生成される画像レイヤー（上から順）:

1. **sheet_labels.png** - ユーザー名ラベル
2. **sheet_cutline.png** - カットライン
3. **sheet_glare.png** - グレア効果
4. **sheet_logos.png** - ロゴ画像
5. **sheet_logo_knock.png** - ロゴ用白板（新規）
6. **sheet_character.png** - キャラクター画像
7. **sheet_char_knock.png** - キャラクター用白板
8. **sheet_bg_knock.png** - 背景用白板
9. **sheet_background.png** - 背景画像

---

## ⚠️ 注意事項

### 白板処理について
- アクリル印刷では白板は完全2値化（0または255）である必要があります
- 半透明の白板は印刷品質の低下を引き起こします
- normalモードが最もバランスが良い設定です

### AIファイルについて
- 画像は必ず埋め込まれます（リンク切れ防止）
- PDF互換性が有効になっています
- 共有時も画像が正しく表示されます

### 並列処理について
- CPUコア数に応じて自動的に最適化されます
- メモリ使用量が増加するため、大量処理時は注意が必要です

---

## 🛠️ トラブルシューティング

### Q: 画像の一部が切れて印刷される
A: `--knockout-mode aggressive --knockout-shrink 0` を試してください

### Q: 細い線が消える
A: `--knockout-mode minimal --knockout-shrink 0.2` を試してください

### Q: AIファイルの画像がリンク切れする
A: 最新版の import_layers_to_ai.jsx を使用してください（埋め込み処理済み）

### Q: 処理が遅い
A: index_parallel.py を使用し、--workers オプションで並列数を増やしてください

---

## 📅 更新履歴

### 2025-10-08
- receiveType別処理機能追加
- フィルタリングスクリプト作成
- 自動振り分け処理実装

### 2025-10-07
- 白板処理の完全2値化実装
- ロゴ用白板レイヤー追加
- 並列処理版スクリプト作成
- AIファイル埋め込み処理修正
- 処理モード（normal/aggressive/minimal）追加

### 2025-09-03
- ロゴレイヤーのサポート追加

### 2025-05-26
- 初版作成

---

## 📞 問題報告

問題が発生した場合は、以下の情報と共に報告してください：
- 使用したコマンド
- エラーメッセージ
- 画像の特徴（透過の有無、サイズなど）