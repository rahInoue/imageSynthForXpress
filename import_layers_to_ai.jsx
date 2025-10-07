#target illustrator

// メイン処理
function main() {
    try {
        processBatch();
        alert("Processing completed successfully!");
    } catch (e) {
        alert("Error: " + e.toString());
    }
}

function processBatch() {
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
        $.writeln("\n========================================");
        $.writeln("Processing folder " + (i + 1) + " of " + folders.length + ": " + folders[i].name);
        $.writeln("========================================");
        
        try {
            createAIFromPNGs(folders[i].name, outputFolder, aiOutputFolder);
            $.writeln("✓ Completed: " + folders[i].name + ".ai");
        } catch (e) {
            $.writeln("✗ Error processing folder " + folders[i].name + ": " + e.toString());
        }
        
        // 各ファイル処理後に少し待機
        if (i < folders.length - 1) {
            $.writeln("Waiting before next file...");
            $.sleep(2000); // 2秒待機
        }
    }
}

function createAIFromPNGs(pageNo, baseOutputFolder, aiOutputFolder) {
    var layerNames = [
        'sheet_labels.png',
        'sheet_cutline.png',
        'sheet_glare.png',
        'sheet_logos.png',      // ロゴレイヤーを追加（characterの上）
        'sheet_character.png',
        'sheet_char_knock.png',
        'sheet_bg_knock.png',
        'sheet_background.png'
    ];

    var inputFolder = new Folder(baseOutputFolder + "/" + pageNo);

    // 最初の画像からサイズを取得
    var firstImagePath = new File(inputFolder + "/" + layerNames[0]);
    if (!firstImagePath.exists) {
        // どれか存在する画像を探す
        for (var j = 0; j < layerNames.length; j++) {
            firstImagePath = new File(inputFolder + "/" + layerNames[j]);
            if (firstImagePath.exists) break;
        }
    }

    // 仮のドキュメントを作成して画像を配置し、サイズを取得
    var tempDoc = app.documents.add();
    var tempItem = tempDoc.placedItems.add();
    tempItem.file = firstImagePath;

    // 画像の実際のサイズを取得
    var imageWidth = tempItem.width;
    var imageHeight = tempItem.height;

    tempDoc.close(SaveOptions.DONOTSAVECHANGES);

    // 正しいサイズで新規ドキュメント作成
    var doc = app.documents.add(
        DocumentColorSpace.RGB,
        imageWidth,
        imageHeight
    );

    // デフォルトのレイヤーを削除
    doc.layers[0].remove();

    // レイヤーを逆順で作成（最後が一番上になるように）
    for (var i = layerNames.length - 1; i >= 0; i--) {
        var file = new File(inputFolder + "/" + layerNames[i]);
        if (file.exists) {
            var layerName = layerNames[i].replace('.png', '');
            var newLayer = doc.layers.add();
            newLayer.name = layerName;

            var placedItem = newLayer.placedItems.add();
            placedItem.file = file;
            
            // 画像を埋め込み処理にする
            placedItem.embed();

            // 画像を左上に配置（Illustratorの座標系は左下が原点）
            placedItem.position = [0, doc.height];

            // 画像のサイズを確認し、必要に応じて調整
            placedItem.width = imageWidth;
            placedItem.height = imageHeight;
        }
    }

    // レイヤーの表示順を確認（最初のレイヤーが最前面）
    // sheet_labelsが最前面に来るように

    // AIファイルとして保存
    var saveOptions = new IllustratorSaveOptions();
    saveOptions.compatibility = Compatibility.ILLUSTRATOR24;
    saveOptions.compressed = true;
    saveOptions.pdfCompatible = true; // PDF互換性を有効化

    var outputFile = new File(aiOutputFolder + "/" + pageNo + ".ai");
    doc.saveAs(outputFile, saveOptions);

    // ドキュメントを閉じる（保存済みなのでSaveOptions.SAVECHANGESは不要）
    doc.close(SaveOptions.DONOTSAVECHANGES);
    
    // メモリ解放のための小休止
    $.sleep(1000); // 1秒待機
    
    // ガベージコレクションを促す（JSXでは限定的）
    $.gc();
}

// main関数を実行
main();