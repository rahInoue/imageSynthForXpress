#target illustrator

// 高速版 - PDF互換性を無効化、埋め込みをスキップ可能
function main() {
    try {
        var config = {
            embedImages: true,      // 画像を埋め込む（共有のため必須）
            pdfCompatible: true,    // PDF互換性を有効化（互換性のため）
            waitTime: 100,         // 待機時間を最小に
            skipLabels: false      // ラベルレイヤーをスキップするオプション
        };

        processBatch(config);
        alert("Processing completed successfully!");
    } catch (e) {
        alert("Error: " + e.toString());
    }
}

function processBatch(config) {
    var scriptFile = new File($.fileName);
    var scriptFolder = scriptFile.parent;
    var outputFolder = new Folder(scriptFolder + "/output");

    if (!outputFolder.exists) {
        throw new Error("Output folder not found: " + outputFolder.fsName);
    }

    var folders = outputFolder.getFiles(function(file) {
        return file instanceof Folder && /^\d+$/.test(file.name);
    });

    if (folders.length === 0) {
        throw new Error("No numbered folders found in: " + outputFolder.fsName);
    }

    var aiOutputFolder = new Folder(scriptFolder + "/ai_output");
    if (!aiOutputFolder.exists) {
        aiOutputFolder.create();
    }

    for (var i = 0; i < folders.length; i++) {
        $.writeln("Processing folder " + (i + 1) + " of " + folders.length + ": " + folders[i].name);

        try {
            createAIFromPNGs(folders[i].name, outputFolder, aiOutputFolder, config);
            $.writeln("✓ Completed: " + folders[i].name + ".ai");
        } catch (e) {
            $.writeln("✗ Error: " + e.toString());
        }

        // 待機時間を最小化
        if (i < folders.length - 1 && config.waitTime > 0) {
            $.sleep(config.waitTime);
        }
    }
}

function createAIFromPNGs(pageNo, baseOutputFolder, aiOutputFolder, config) {
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

    // ラベルをスキップする場合
    if (config.skipLabels) {
        layerNames.shift(); // sheet_labels.pngを除外
    }

    var inputFolder = new Folder(baseOutputFolder + "/" + pageNo);

    // 最初の画像からサイズを取得（簡略化）
    var firstImagePath = null;
    for (var j = 0; j < layerNames.length; j++) {
        var testPath = new File(inputFolder + "/" + layerNames[j]);
        if (testPath.exists) {
            firstImagePath = testPath;
            break;
        }
    }

    if (!firstImagePath) {
        throw new Error("No images found in: " + inputFolder.fsName);
    }

    // サイズ取得を高速化（一度だけドキュメント作成）
    var tempDoc = app.documents.add();
    var tempItem = tempDoc.placedItems.add();
    tempItem.file = firstImagePath;
    var imageWidth = tempItem.width;
    var imageHeight = tempItem.height;
    tempDoc.close(SaveOptions.DONOTSAVECHANGES);

    // 新規ドキュメント作成
    var doc = app.documents.add(
        DocumentColorSpace.RGB,
        imageWidth,
        imageHeight
    );

    // デフォルトレイヤーを利用（削除しない）
    var defaultLayer = doc.layers[0];
    defaultLayer.name = "temp";

    // バッチでレイヤーを作成
    var layersToRemove = [];
    for (var i = layerNames.length - 1; i >= 0; i--) {
        var file = new File(inputFolder + "/" + layerNames[i]);
        if (file.exists) {
            var layerName = layerNames[i].replace('.png', '');
            var newLayer = (i === layerNames.length - 1) ? defaultLayer : doc.layers.add();
            newLayer.name = layerName;

            var placedItem = newLayer.placedItems.add();
            placedItem.file = file;

            // 埋め込みオプション
            if (config.embedImages) {
                placedItem.embed();
            }

            // 位置とサイズを一括設定
            placedItem.position = [0, doc.height];
            placedItem.width = imageWidth;
            placedItem.height = imageHeight;
        }
    }

    // 保存オプション（高速化）
    var saveOptions = new IllustratorSaveOptions();
    saveOptions.compatibility = Compatibility.ILLUSTRATOR24;
    saveOptions.compressed = true;
    saveOptions.pdfCompatible = config.pdfCompatible;
    saveOptions.embedICCProfile = false;  // ICCプロファイル埋め込みをスキップ
    saveOptions.embedLinkedFiles = config.embedImages;

    var outputFile = new File(aiOutputFolder + "/" + pageNo + ".ai");
    doc.saveAs(outputFile, saveOptions);
    doc.close(SaveOptions.DONOTSAVECHANGES);

    // メモリ解放（最小限）
    if (config.waitTime > 0) {
        $.sleep(config.waitTime);
    }
}

// main関数を実行
main();