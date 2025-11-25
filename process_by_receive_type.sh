#!/bin/bash

# receiveTypeごとに画像処理からAIファイル生成まで自動実行

set -e  # エラーで停止

echo "========================================="
echo "receiveType別処理を開始します"
echo "========================================="

# Step 1: receiveType=0（イベント受け取り）の処理
echo ""
echo "Step 1: receiveType=0（イベント受け取り）の処理"
echo "-----------------------------------------"

# フィルタリングと画像生成
python3 filter_by_receive_type.py --receive-type 0 --output filtered_images_0.test.json

if [ -f "filtered_images_0.json" ]; then
    echo "Generating images for receiveType=0..."
    python3 index.py --sheet 280x580 \
        --images "$(cat filtered_images_0.test.json)" \
        --output-dir output_receive_0 \
        --knockout-mode normal \
        --knockout-shrink 0.05
    echo "✓ Images generated for receiveType=0"
else
    echo "⚠ No images found for receiveType=0"
fi

# Step 2: receiveType=1（配送）の処理
echo ""
echo "Step 2: receiveType=1（配送）の処理"
echo "-----------------------------------------"

# フィルタリングと画像生成
python3 filter_by_receive_type.py --receive-type 1 --output filtered_images_1.test.json

if [ -f "filtered_images_1.json" ]; then
    echo "Generating images for receiveType=1..."
    python3 index.py --sheet 280x580 \
        --images "$(cat filtered_images_1.test.json)" \
        --output-dir output_receive_1 \
        --knockout-mode normal \
        --knockout-shrink 0.05
    echo "✓ Images generated for receiveType=1"
else
    echo "⚠ No images found for receiveType=1"
fi

# Step 3: AIファイル生成
echo ""
echo "Step 3: AIファイル生成"
echo "-----------------------------------------"
echo "Generating AI files for both receiveTypes..."

osascript import_layers_to_ai_by_receive_type.jsx

# 結果の確認
echo ""
echo "========================================="
echo "処理完了！"
echo "========================================="
echo ""
echo "出力ディレクトリ:"
echo "  画像ファイル:"
echo "    - output_receive_0/ (イベント受け取り)"
echo "    - output_receive_1/ (配送)"
echo "  AIファイル:"
echo "    - ai_output_event_pickup/ (イベント受け取り)"
echo "    - ai_output_delivery/ (配送)"
echo ""

# ファイル数の確認
if [ -d "output_receive_0" ]; then
    EVENT_COUNT=$(find output_receive_0 -name "*.png" | wc -l)
    echo "  イベント受け取り: ${EVENT_COUNT} 画像ファイル"
fi

if [ -d "output_receive_1" ]; then
    DELIVERY_COUNT=$(find output_receive_1 -name "*.png" | wc -l)
    echo "  配送: ${DELIVERY_COUNT} 画像ファイル"
fi

if [ -d "ai_output_event_pickup" ]; then
    AI_EVENT_COUNT=$(find ai_output_event_pickup -name "*.ai" | wc -l)
    echo "  イベント受け取りAI: ${AI_EVENT_COUNT} ファイル"
fi

if [ -d "ai_output_delivery" ]; then
    AI_DELIVERY_COUNT=$(find ai_output_delivery -name "*.ai" | wc -l)
    echo "  配送AI: ${AI_DELIVERY_COUNT} ファイル"
fi