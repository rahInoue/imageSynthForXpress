#!/bin/bash

# Acrylic Sheet Generator - 統合処理スクリプト
# このスクリプトは画像合成からPSD生成まで一連の処理を自動実行します

set -e  # エラーが発生したら即座に停止

# カラー定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# デフォルト値
IMAGES_FILE="images.json"
SHEET_SIZE="280x580"
OUTPUT_DIR="output"
PSD_OUTPUT_DIR="psd_output"
PREFIX="sheet"

# ヘルプメッセージ
show_help() {
    echo "使用方法: $0 [オプション]"
    echo ""
    echo "オプション:"
    echo "  -i, --images FILE        画像情報JSONファイル (デフォルト: $IMAGES_FILE)"
    echo "  -s, --sheet SIZE         シートサイズ mm (デフォルト: $SHEET_SIZE)"
    echo "  -o, --output-dir DIR     出力ディレクトリ (デフォルト: $OUTPUT_DIR)"
    echo "  -p, --psd-dir DIR        PSD出力ディレクトリ (デフォルト: $PSD_OUTPUT_DIR)"
    echo "  --prefix PREFIX          ファイル名プレフィックス (デフォルト: $PREFIX)"
    echo "  --one-page               ページ分割せず1シートに出力"
    echo "  -h, --help               このヘルプメッセージを表示"
    echo ""
    echo "例:"
    echo "  $0 -i custom_images.json -s 300x600"
    echo "  $0 --one-page"
}

# 引数解析
ONE_PAGE_FLAG=""
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--images)
            IMAGES_FILE="$2"
            shift 2
            ;;
        -s|--sheet)
            SHEET_SIZE="$2"
            shift 2
            ;;
        -o|--output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -p|--psd-dir)
            PSD_OUTPUT_DIR="$2"
            shift 2
            ;;
        --prefix)
            PREFIX="$2"
            shift 2
            ;;
        --one-page)
            ONE_PAGE_FLAG="--one-page"
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}エラー: 不明なオプション: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# 実行開始
echo -e "${GREEN}=== Acrylic Sheet Generator 統合処理開始 ===${NC}"
echo ""

# 環境チェック
echo -e "${YELLOW}1. 環境チェック中...${NC}"

# Python3の確認
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}エラー: Python3が見つかりません。インストールしてください。${NC}"
    exit 1
fi
echo "  ✓ Python3が利用可能です"

# Node.jsの確認
if ! command -v node &> /dev/null; then
    echo -e "${RED}エラー: Node.jsが見つかりません。インストールしてください。${NC}"
    exit 1
fi
echo "  ✓ Node.jsが利用可能です"

# 画像情報ファイルの確認
if [ ! -f "$IMAGES_FILE" ]; then
    echo -e "${RED}エラー: 画像情報ファイル '$IMAGES_FILE' が見つかりません。${NC}"
    exit 1
fi
echo "  ✓ 画像情報ファイル: $IMAGES_FILE"

# 必要なPythonパッケージの確認
echo ""
echo -e "${YELLOW}2. Pythonパッケージチェック中...${NC}"
if python3 -c "import PIL" 2>/dev/null; then
    echo "  ✓ Pillowがインストールされています"
else
    echo -e "${RED}  × Pillowがインストールされていません${NC}"
    echo "    インストールコマンド: pip install Pillow"
    exit 1
fi

# 必要なNode.jsパッケージの確認
echo ""
echo -e "${YELLOW}3. Node.jsパッケージチェック中...${NC}"
if [ -f "package.json" ] && [ -d "node_modules" ]; then
    if [ -d "node_modules/ag-psd" ] && [ -d "node_modules/canvas" ]; then
        echo "  ✓ 必要なパッケージがインストールされています"
    else
        echo "  × 必要なパッケージが不足しています"
        echo "    インストールコマンド: npm install"
        exit 1
    fi
else
    echo "  × node_modulesが見つかりません"
    echo "    インストールコマンド: npm install"
    exit 1
fi

# ステップ1: 画像合成処理
echo ""
echo -e "${YELLOW}4. 画像合成処理を開始します...${NC}"
echo "  設定:"
echo "    - シートサイズ: $SHEET_SIZE mm"
echo "    - 出力ディレクトリ: $OUTPUT_DIR"
echo "    - プレフィックス: $PREFIX"
if [ -n "$ONE_PAGE_FLAG" ]; then
    echo "    - 単一ページモード"
fi

# 既存の出力ディレクトリをクリア（オプション）
if [ -d "$OUTPUT_DIR" ]; then
    echo ""
    read -p "  既存の出力ディレクトリを削除しますか？ (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$OUTPUT_DIR"
        echo "  出力ディレクトリを削除しました"
    fi
fi

# Python処理実行
python3 index.py \
    --images "$(cat "$IMAGES_FILE")" \
    --sheet "$SHEET_SIZE" \
    --prefix "$PREFIX" \
    --output-dir "$OUTPUT_DIR" \
    $ONE_PAGE_FLAG

if [ $? -ne 0 ]; then
    echo -e "${RED}エラー: 画像合成処理が失敗しました${NC}"
    exit 1
fi

echo -e "${GREEN}  ✓ 画像合成処理が完了しました${NC}"

# ステップ2: PSD生成処理
echo ""
echo -e "${YELLOW}5. PSD生成処理を開始します...${NC}"

# 既存のPSD出力ディレクトリをクリア（オプション）
if [ -d "$PSD_OUTPUT_DIR" ]; then
    echo ""
    read -p "  既存のPSD出力ディレクトリを削除しますか？ (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$PSD_OUTPUT_DIR"
        echo "  PSD出力ディレクトリを削除しました"
    fi
fi

# Node.js処理実行
node makePSD.js

if [ $? -ne 0 ]; then
    echo -e "${RED}エラー: PSD生成処理が失敗しました${NC}"
    exit 1
fi

echo -e "${GREEN}  ✓ PSD生成処理が完了しました${NC}"

# 結果サマリー
echo ""
echo -e "${GREEN}=== 処理完了 ===${NC}"
echo ""
echo "生成されたファイル:"

# 出力ディレクトリの内容を表示
if [ -d "$OUTPUT_DIR" ]; then
    PAGE_COUNT=$(find "$OUTPUT_DIR" -maxdepth 1 -type d -name '[0-9]*' | wc -l)
    echo "  - PNG画像: $OUTPUT_DIR/ ($PAGE_COUNT ページ)"
fi

# PSDファイルの確認
if [ -d "$PSD_OUTPUT_DIR" ]; then
    PSD_COUNT=$(find "$PSD_OUTPUT_DIR" -name '*.psd' | wc -l)
    echo "  - PSDファイル: $PSD_OUTPUT_DIR/ ($PSD_COUNT ファイル)"
    echo ""
    echo "PSDファイル一覧:"
    find "$PSD_OUTPUT_DIR" -name '*.psd' -exec basename {} \; | sort | sed 's/^/    - /'
fi

echo ""
echo -e "${GREEN}すべての処理が正常に完了しました！${NC}"