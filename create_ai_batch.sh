#!/bin/bash

# バッチ処理でAIファイルを生成（シンプル版）

OUTPUT_DIR="./output"
AI_OUTPUT_DIR="./ai_output"

# ai_outputディレクトリを作成
mkdir -p "$AI_OUTPUT_DIR"

# 処理するフォルダを取得
FOLDERS=($(ls -d ${OUTPUT_DIR}/[0-9]* 2>/dev/null | xargs -n1 basename | sort -n))

if [ ${#FOLDERS[@]} -eq 0 ]; then
    echo "No numbered folders found in output directory"
    exit 1
fi

echo "Found ${#FOLDERS[@]} folders to process"

# 各フォルダを処理
for folder in "${FOLDERS[@]}"; do
    echo "Processing folder: $folder"

    # 個別のJSXスクリプトを生成
    cat > "temp_ai_${folder}.jsx" << EOF
#target illustrator

var pageNo = "${folder}";
var scriptFile = new File(\$.fileName);
var scriptFolder = scriptFile.parent;
var outputFolder = new Folder(scriptFolder + "/output");
var aiOutputFolder = new Folder(scriptFolder + "/ai_output");

try {
    var layerNames = [
        'sheet_labels.png',
        'sheet_cutline.png',
        'sheet_glare.png',
        'sheet_logos.png',
        'sheet_logo_knock.png',
        'sheet_character.png',
        'sheet_char_knock.png',
        'sheet_bg_knock.png',
        'sheet_background.png'
    ];

    var inputFolder = new Folder(outputFolder + "/" + pageNo);

    // 画像サイズ取得
    var firstImagePath = null;
    for (var j = 0; j < layerNames.length; j++) {
        var testPath = new File(inputFolder + "/" + layerNames[j]);
        if (testPath.exists) {
            firstImagePath = testPath;
            break;
        }
    }

    if (!firstImagePath) {
        throw new Error("No images found");
    }

    var tempDoc = app.documents.add();
    var tempItem = tempDoc.placedItems.add();
    tempItem.file = firstImagePath;
    var imageWidth = tempItem.width;
    var imageHeight = tempItem.height;
    tempDoc.close(SaveOptions.DONOTSAVECHANGES);

    // 新規ドキュメント作成
    var doc = app.documents.add(DocumentColorSpace.RGB, imageWidth, imageHeight);
    doc.layers[0].remove();

    // レイヤー作成
    for (var i = layerNames.length - 1; i >= 0; i--) {
        var file = new File(inputFolder + "/" + layerNames[i]);
        if (file.exists) {
            var newLayer = doc.layers.add();
            newLayer.name = layerNames[i].replace('.png', '');
            var placedItem = newLayer.placedItems.add();
            placedItem.file = file;
            placedItem.position = [0, doc.height];
            placedItem.width = imageWidth;
            placedItem.height = imageHeight;
        }
    }

    // 保存（高速化オプション）
    var saveOptions = new IllustratorSaveOptions();
    saveOptions.compatibility = Compatibility.ILLUSTRATOR24;
    saveOptions.compressed = true;
    saveOptions.pdfCompatible = false;  // 高速化のため無効
    saveOptions.embedICCProfile = false;

    var outputFile = new File(aiOutputFolder + "/" + pageNo + ".ai");
    doc.saveAs(outputFile, saveOptions);
    doc.close(SaveOptions.DONOTSAVECHANGES);

    \$.writeln("Success: " + pageNo);
} catch(e) {
    \$.writeln("Error: " + pageNo + " - " + e.toString());
}
EOF

    # Illustratorで実行
    osascript -e "tell application id \"com.adobe.illustrator\" to do javascript file \"$(pwd)/temp_ai_${folder}.jsx\""

    if [ $? -eq 0 ]; then
        echo "✓ Completed: ${folder}.ai"
    else
        echo "✗ Failed: ${folder}.ai"
    fi

    # 一時ファイルを削除
    rm -f "temp_ai_${folder}.jsx"

    # 少し待機（メモリ解放のため）
    sleep 0.5
done

echo "✨ All AI files created!"