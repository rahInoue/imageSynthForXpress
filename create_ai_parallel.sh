#!/bin/bash

# 並列処理でAIファイルを生成

OUTPUT_DIR="./output"
AI_OUTPUT_DIR="./ai_output"
MAX_PARALLEL=${1:-3}  # デフォルト3並列

# ai_outputディレクトリを作成
mkdir -p "$AI_OUTPUT_DIR"

# 処理するフォルダを取得
FOLDERS=($(ls -d ${OUTPUT_DIR}/[0-9]* 2>/dev/null | xargs -n1 basename | sort -n))

if [ ${#FOLDERS[@]} -eq 0 ]; then
    echo "No numbered folders found in output directory"
    exit 1
fi

echo "Found ${#FOLDERS[@]} folders to process"
echo "Processing with ${MAX_PARALLEL} parallel jobs"

# 単一フォルダを処理する関数
process_folder() {
    local folder=$1
    local jsx_file="temp_ai_${folder}_$$.jsx"

    # JSXスクリプトを生成
    cat > "${jsx_file}" << EOF
#target illustrator

var pageNo = "${folder}";
var scriptFile = new File(\$.fileName);
var scriptFolder = scriptFile.parent;

try {
    var layerNames = [
        'sheet_labels.png', 'sheet_cutline.png', 'sheet_glare.png',
        'sheet_logos.png', 'sheet_logo_knock.png', 'sheet_character.png',
        'sheet_char_knock.png', 'sheet_bg_knock.png', 'sheet_background.png'
    ];

    var inputFolder = new Folder(scriptFolder + "/output/" + pageNo);
    var aiOutputFolder = new Folder(scriptFolder + "/ai_output");

    // 最初の画像からサイズ取得
    var firstImagePath = null;
    for (var j = 0; j < layerNames.length; j++) {
        var testPath = new File(inputFolder + "/" + layerNames[j]);
        if (testPath.exists) {
            firstImagePath = testPath;
            break;
        }
    }

    if (!firstImagePath) throw new Error("No images");

    // サイズ取得
    var tempDoc = app.documents.add();
    var tempItem = tempDoc.placedItems.add();
    tempItem.file = firstImagePath;
    var w = tempItem.width, h = tempItem.height;
    tempDoc.close(SaveOptions.DONOTSAVECHANGES);

    // 新規ドキュメント
    var doc = app.documents.add(DocumentColorSpace.RGB, w, h);
    doc.layers[0].remove();

    // レイヤー作成
    for (var i = layerNames.length - 1; i >= 0; i--) {
        var file = new File(inputFolder + "/" + layerNames[i]);
        if (file.exists) {
            var layer = doc.layers.add();
            layer.name = layerNames[i].replace('.png', '');
            var item = layer.placedItems.add();
            item.file = file;
            item.position = [0, doc.height];
            item.width = w;
            item.height = h;
        }
    }

    // 保存
    var opt = new IllustratorSaveOptions();
    opt.compatibility = Compatibility.ILLUSTRATOR24;
    opt.compressed = true;
    opt.pdfCompatible = false;

    doc.saveAs(new File(aiOutputFolder + "/" + pageNo + ".ai"), opt);
    doc.close(SaveOptions.DONOTSAVECHANGES);

    \$.writeln("OK:" + pageNo);
} catch(e) {
    \$.writeln("ERR:" + pageNo);
}
EOF

    # Illustratorで実行（バックグラウンド）
    osascript -e "tell application id \"com.adobe.illustrator\" to do javascript file \"$(pwd)/${jsx_file}\"" >/dev/null 2>&1

    local result=$?
    rm -f "${jsx_file}"

    if [ $result -eq 0 ]; then
        echo "✓ Completed: ${folder}.ai"
    else
        echo "✗ Failed: ${folder}.ai"
    fi

    return $result
}

# Export function for parallel execution
export -f process_folder

# GNU parallelを使用（インストールされている場合）
if command -v parallel &> /dev/null; then
    echo "Using GNU parallel..."
    printf "%s\n" "${FOLDERS[@]}" | parallel -j ${MAX_PARALLEL} process_folder {}
else
    echo "Using xargs for parallel processing..."
    printf "%s\n" "${FOLDERS[@]}" | xargs -n 1 -P ${MAX_PARALLEL} -I {} bash -c 'process_folder "$@"' _ {}
fi

echo "✨ All AI files created!"