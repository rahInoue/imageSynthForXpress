#!/bin/bash
#
# Knockout検証テストの実行スクリプト
#
# 使用方法:
#   cd imageSynthForXpress
#   ./techTest/run_knockout_test.sh
#
# 出力:
#   techTest/output/*.png - 各レイヤーのPNG画像
#   techTest/ai_output/knockout_test.ai - AIファイル
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "Knockout検証テスト"
echo "========================================"
echo ""
echo "プロジェクトディレクトリ: $PROJECT_DIR"
echo "テストディレクトリ: $SCRIPT_DIR"
echo ""

# 1. PNG生成
echo "========================================"
echo "Step 1: PNG画像生成（3パターン × 6画像 = 18枚）"
echo "========================================"

cd "$PROJECT_DIR"
python3 "$SCRIPT_DIR/generate_knockout_test.py" \
    --input "$SCRIPT_DIR/test.json" \
    --output "$SCRIPT_DIR/output" \
    --sheet 280x580

echo ""
echo "PNG生成完了"
echo ""

# 2. AIファイル生成
echo "========================================"
echo "Step 2: AIファイル生成"
echo "========================================"

# Illustratorが利用可能か確認
if ! command -v osascript &> /dev/null; then
    echo "Warning: osascript not found. AIファイル生成をスキップします。"
    echo "手動で実行: Illustratorで techTest/import_layers_to_ai_test.jsx を実行してください。"
else
    # Illustratorでスクリプトを実行
    osascript -e "
    tell application \"Adobe Illustrator\"
        activate
        do javascript file \"$SCRIPT_DIR/import_layers_to_ai_test.jsx\"
    end tell
    " 2>/dev/null || {
        echo ""
        echo "Note: Illustratorでの自動実行に失敗しました。"
        echo "手動で実行してください:"
        echo "  1. Adobe Illustratorを開く"
        echo "  2. File > Scripts > Other Script..."
        echo "  3. $SCRIPT_DIR/import_layers_to_ai_test.jsx を選択"
        echo ""
    }
fi

echo ""
echo "========================================"
echo "完了"
echo "========================================"
echo ""
echo "出力ファイル:"
echo "  PNG: $SCRIPT_DIR/output/"
ls -la "$SCRIPT_DIR/output/"*.png 2>/dev/null || echo "  (PNGファイルなし)"
echo ""
echo "  AI:  $SCRIPT_DIR/ai_output/"
ls -la "$SCRIPT_DIR/ai_output/"*.ai 2>/dev/null || echo "  (AIファイルなし - 手動でJSXを実行してください)"
echo ""
echo "knockoutパターン:"
echo "  - binary: 2値化（従来方式）"
echo "  - gradient: αに応じたグラデーション"
echo "  - steep: 傾斜グラデーション（低α値も強く黒に寄せる）"
