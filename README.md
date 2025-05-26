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
- 統合処理スクリプトによる自動化

## 必要条件

### Python版

- Python 3.6以上
- Pillow（PIL）ライブラリ

```bash
pip install Pillow
```

### Node.js版 (PSD生成)

- Node.js 14以上
- 必要なパッケージ: ag-psd, canvas

```bash
npm install ag-psd canvas
```

## 使用方法

### 統合処理（推奨）

画像合成からPSD生成まで一連の処理を自動実行:

```bash
./process_all.sh
```

オプション:
- `-i, --images FILE` - 画像情報JSONファイル（デフォルト: images.json）
- `-s, --sheet SIZE` - シートサイズ mm（デフォルト: 280x580）
- `-o, --output-dir DIR` - 出力ディレクトリ（デフォルト: output）
- `-p, --psd-dir DIR` - PSD出力ディレクトリ（デフォルト: psd_output）
- `--prefix PREFIX` - ファイル名プレフィックス（デフォルト: sheet）
- `--one-page` - ページ分割せず1シートに出力
- `-h, --help` - ヘルプメッセージを表示

使用例:
```bash
# カスタム設定で実行
./process_all.sh -i custom_images.json -s 300x600

# 単一ページモードで実行
./process_all.sh --one-page
```

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

統合処理スクリプト（process_all.sh）を使用することで、これらの処理を一度に実行できます。

## ライセンス

[MIT License](LICENSE)