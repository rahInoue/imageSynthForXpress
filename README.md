# Image Synthesizer for Xpress

アクリルシート印刷用の画像合成ツールです。キャラクター画像と背景画像を合成し、カットライン、グレア、キャラクターシルエット、背景ノックアウトなど、印刷用の各種レイヤーを生成します。

## 機能

- 複数の画像を1枚のシートにレイアウト
- 350dpi高解像度出力対応
- カットライン自動生成
- 透明PNG対応
- 画像ごとのキー（識別子）表示
- ページ分割機能（多数の画像を複数シートに自動分割）
- 生成されたレイヤー画像からPSDファイルを作成
- Adobe Illustrator形式（.ai）ファイルの自動生成
- 統合処理スクリプトによる自動化

## 必要条件

### Python版

- Python 3.6以上
- 必要なパッケージ:
  - Pillow（PIL）- 画像処理

```bash
pip install Pillow
```

### Node.js版 (PSD生成、R2ダウンロード)

- Node.js 14以上
- 必要なパッケージ:

```bash
npm install
```

### Adobe Illustrator版 (.ai生成)

- Adobe Illustrator（インストール済みであること）
- macOS環境（AppleScriptを使用）

## 使用方法

### 注文ベースのワークフロー（推奨）

注文データから印刷用ファイルを生成する完全なワークフロー：

```bash
# 1. CloudFlare R2から注文の画像をダウンロード
npm run download-order-images

# 2. 注文データから画像リストを生成
npm run make-order-images

# 3. 画像合成・PSD・AI生成を実行
python3 index.py --images "$(cat output/order_images.json)" --sheet 280x580 --prefix sheet
node makePSD.js
./run_ai.sh
```

または、統合処理スクリプトで一括実行：
```bash
# 画像ダウンロードから生成まですべて実行
npm run download-order-images && npm run make-order-images && ./process_all.sh -i output/order_images.json
```

### CloudFlare R2から画像をダウンロード

CloudFlare R2に保存された画像をローカルにダウンロードする2つの方法があります：

#### 1. 環境変数の設定

`.env.example`を`.env`にコピーして、CloudFlare R2の認証情報を設定：

```bash
cp .env.example .env
# .envファイルを編集して認証情報を入力
```

#### 2. 注文リストベースのダウンロード（推奨）

`2025_order_goods_list.json`のような注文リストから必要な画像を自動的に抽出してダウンロード：

```bash
# 注文リストの画像をダウンロード
npm run download-order-images

# 強制ダウンロード（既存ファイルも上書き）
node downloadOrderImages.js 202508/2025_order_goods_list.json --force

# 別のJSONファイルを使用
node downloadOrderImages.js path/to/order_list.json
```

特徴:
- 注文リストから自動的に画像パスを抽出（商品画像、背景画像、ロゴ画像）
- 重複する画像は一度だけダウンロード
- 既存ファイルは自動的にスキップ（`--force`で強制ダウンロード）
- JSONで指定されたパス通りにプロジェクトルートに保存

#### 3. カスタムリストベースのダウンロード

独自の画像リストを使用してダウンロード：

```bash
# download_images.jsonを使用
npm run download-images

# または直接実行
node downloadFromR2.js download_images.json --output-dir images --update-json
```

オプション:
- `--output-dir <dir>` - 出力ディレクトリ（デフォルト: images）
- `--update-json` - ダウンロード後にJSONファイルをローカルパスに更新

### 注文データから画像リストを生成

注文情報と商品リストをマージして、画像合成用のJSONファイルを生成：

```bash
# デフォルト設定で実行
npm run make-order-images

# カスタムファイルを指定
node makeOrderImages.js --order-info 202508/202508_order_info.json --goods-list 202508/2025_order_goods_list.json --output output/order_images.json
```

オプション:
- `--order-info <file>` - 注文情報JSONファイル（デフォルト: 202508/202508_order_info.json）
- `--goods-list <file>` - 商品リストJSONファイル（デフォルト: 202508/2025_order_goods_list.json）
- `--output <file>` - 出力JSONファイル（デフォルト: output/order_images.json）

この処理により、以下の形式のJSONファイルが生成されます：
```json
{
  "key": "9_105212",
  "char": "images/main/105212.png",
  "bg": "illustDisplay/bg/10_su0_Bullbre_W768_H1024.png",
  "logo": "illustDisplay/logo/bullbre_full_logo.png",
  "orderId": "9",
  "userId": "Ktd4NZXlfRhTKrlPpqCjkRt1g0u1",
  "userName": "橋本咲良",
  "amount": 1
}
```

### 統合処理（推奨）

画像合成からPSD生成、AI生成まで一連の処理を自動実行:

```bash
./process_all.sh
```

オプション:
- `-i, --images FILE` - 画像情報JSONファイル（デフォルト: images.json）
- `-s, --sheet SIZE` - シートサイズ mm（デフォルト: 280x580）
- `-o, --output-dir DIR` - 出力ディレクトリ（デフォルト: output）
- `-p, --psd-dir DIR` - PSD出力ディレクトリ（デフォルト: psd_output）
- `-a, --ai-dir DIR` - AI出力ディレクトリ（デフォルト: ai_output）
- `--prefix PREFIX` - ファイル名プレフィックス（デフォルト: sheet）
- `--one-page` - ページ分割せず1シートに出力
- `--skip-ai` - AI生成をスキップ（Adobe Illustratorがない場合など）
- `-h, --help` - ヘルプメッセージを表示

使用例:
```bash
# カスタム設定で実行
./process_all.sh -i custom_images.json -s 300x600

# 単一ページモードで実行
./process_all.sh --one-page

# AI生成をスキップして実行
./process_all.sh --skip-ai
```

**注意**: AI生成はAdobe Illustratorがインストールされている場合のみ実行されます。インストールされていない場合は自動的にスキップされます。

### 個別実行

#### 1. 画像合成（Python版）

```bash
python3 index.py --images "$(cat images.json)" --sheet 280x580 --prefix sheet
```

#### 2. PSD生成（Node.js版）

Python版で生成されたPNG画像から、Adobe Photoshop形式（PSD）ファイルを作成:

```bash
node makePSD.js
```

スクリプトは自動的に`output`ディレクトリ内のすべてのページディレクトリ（数字の名前のフォルダ）を検出し、それぞれに対応するPSDファイルを`psd_output`ディレクトリに生成します。

#### 3. AI生成（Adobe Illustrator版）

PNG画像からAdobe Illustrator形式（.ai）ファイルを生成:

```bash
./run_ai.sh
```

このスクリプトは以下の処理を行います：
1. `output`ディレクトリ内のすべてのページディレクトリを検出
2. Adobe Illustratorを起動
3. 各ページのPNG画像をレイヤーとして読み込み
4. `ai_output`ディレクトリに.aiファイルを保存

**注意**: このスクリプトはmacOS環境でのみ動作し、Adobe Illustratorがインストールされている必要があります。

### コマンドラインオプション（Python版）

| オプション | 説明 | デフォルト値 |
|------------|------|-------------|
| `--images` | 画像情報を記述したJSONファイル（必須） | - |
| `--sheet` | シート寸法（mm）（例: 280x580） | 280x580 |
| `--prefix` | 出力ファイル名の接頭辞 | sheet |
| `--output-dir` | 出力ディレクトリ | output |
| `--one-page` | ページ分割せず1シートにすべて出力（フラグ） | False |


### JSONファイルの形式

```json
[
  {
    "key": "char1",
    "char": "images/character/character1.png",
    "bg": "images/background/bg1.jpg"
  },
  {
    "key": "char2",
    "char": "images/character/character2.png",
    "bg": "images/background/bg2.jpg"
  }
]
```

各要素の説明:
- `key`: 各画像の識別子（カットラインの左側に表示）
- `char`: キャラクター画像のパス（透明PNG推奨）
- `bg`: 背景画像のパス
- `orderId`: 注文ID（オプション）

#### 注文リストJSONファイル形式 (2025_order_goods_list.json)

注文管理システムから出力される形式：

```json
[
  {
    "orderId": 9,
    "shouhinId": 105212,
    "backgroundFlg": 0,
    "amount": 1,
    "shouhinNaiyou": "images/main/105212.png",
    "shouhinKbn": "10",
    "worldId": "Bullbre",
    "bgFlg": null,
    "logoPath": "illustDisplay/logo/bullbre_full_logo.png"
  },
  {
    "orderId": 9,
    "shouhinId": 110817,
    "backgroundFlg": 1,
    "amount": 1,
    "shouhinNaiyou": "images/main/110817.png",
    "shouhinKbn": "Z73",
    "worldId": "Bullbre",
    "bgFlg": "illustDisplay/bg/Z73_bg.png",
    "logoPath": "illustDisplay/logo/Z73_logo.png"
  }
]
```

各フィールド:
- `shouhinNaiyou`: 商品のメイン画像
- `bgFlg`: 背景画像（backgroundFlg=1の場合のみ使用）
- `logoPath`: ロゴ画像

#### カスタムダウンロードJSONファイル形式 (download_images.json)

独自の画像リストを作成する場合：

```json
[
  {
    "key": "char1",
    "char": "character/images_main_139171.png",
    "bg": "bg/illustDisplay_bg_Z98_bg.png",
    "orderId": "ORDER-001"
  },
  {
    "key": "char2",
    "char": "character/images_main_139172.png",
    "bg": "bg/illustDisplay_bg_Z98_bg.png",
    "orderId": "ORDER-002"
  }
]
```

`--update-json`オプションを使用すると、ダウンロード後にパスが自動的にローカルパスに更新されます。

### ページ分割機能の使い方

カード数が多く、1枚のシートに収まらない場合は自動的にページ分割されます。

```bash
# 複数ページに分割（デフォルト動作）
python3 index.py --images "$(cat many_images.json)" --sheet 280x580 --prefix sheet --output-dir output

# 1シートに全て強制出力（はみ出す場合あり）
python3 index.py --images "$(cat many_images.json)" --sheet 280x580 --prefix sheet --one-page
```

出力結果:
- `output/1/sheet_*.png` - 1ページ目のレイヤー画像
- `output/2/sheet_*.png` - 2ページ目のレイヤー画像
- ...

## 出力ファイル

### Python版の出力

以下のレイヤー画像が生成されます:

| ファイル名 | 説明 |
|------------|------|
| `*_cutline.png` | カットライン（黒線）とキーラベル |
| `*_glare.png` | グレア効果（黒色シルエット） |
| `*_character.png` | キャラクター画像 |
| `*_char_knock.png` | キャラクターノックアウト（黒色シルエット） |
| `*_bg_knock.png` | 背景ノックアウト（黒色） |
| `*_background.png` | 背景画像 |
| `*_labels.png` | キーラベル（識別子） |

### PSD生成（makePSD.js）の出力

| ファイル | 説明 |
|------------|------|
| `psd_output/1.psd` | ページ1のPSDファイル |
| `psd_output/2.psd` | ページ2のPSDファイル |
| ... | 各ページのPSDファイル |

各PSDファイルには、以下のレイヤーが含まれます（上から下の順）:
- sheet_background - 背景画像
- sheet_bg_knock - 背景ノックアウト
- sheet_char_knock - キャラクターノックアウト
- sheet_character - キャラクター画像
- sheet_glare - グレア効果
- sheet_cutline - カットライン
- sheet_labels - キーラベル

これらのPSDファイルはAdobe Photoshopやその他の対応するソフトウェアで開くことができ、必要に応じてレイヤーの編集や調整が可能です。

### AI生成（run_ai.sh）の出力

| ファイル | 説明 |
|------------|------|
| `ai_output/1.ai` | ページ1のAIファイル |
| `ai_output/2.ai` | ページ2のAIファイル |
| ... | 各ページのAIファイル |

各AIファイルには、PSDファイルと同じレイヤー構造が含まれます:
- sheet_labels - キーラベル（最前面）
- sheet_cutline - カットライン
- sheet_glare - グレア効果
- sheet_character - キャラクター画像
- sheet_char_knock - キャラクターノックアウト
- sheet_bg_knock - 背景ノックアウト
- sheet_background - 背景画像（最背面）

AIファイルはAdobe Illustratorで開くことができ、ベクター形式での編集や印刷用の詳細な調整が可能です。

## パラメータ調整

コード内の定数を変更することで、出力結果をカスタマイズできます:

```python
# ---- 主要パラメータ ----------------------------------------------------------
CARD_PX = (768, 1024)                # カードサイズ（ピクセル）固定値
CUTLINE_MM = 2.0                     # カットライン（黒線）の幅（ミリメートル）
MARGIN_MM = 10.0                     # シート外周の余白（ミリメートル）
SPACING_MM = 10.0                    # カード間の間隔（ミリメートル）
KNOCKOUT_SHRINK_MM = 0.2             # 白抜き（ノックアウト）の縮小量（ミリメートル）
# -----------------------------------------------------------------------------
```

## 処理フロー

1. **画像情報の準備** - images.jsonファイルに処理する画像のパスと識別子を記載
2. **画像合成処理** - index.pyがPNG形式のレイヤー画像を生成
3. **PSD生成処理** - makePSD.jsが生成されたPNG画像からPSDファイルを作成
4. **AI生成処理** - run_ai.shがAdobe Illustratorを使用してAIファイルを作成

統合処理スクリプト（process_all.sh）を使用することで、これらすべての処理を一度に実行できます。Adobe Illustratorがインストールされていない場合、AI生成は自動的にスキップされます。

## ライセンス

[MIT License](LICENSE)