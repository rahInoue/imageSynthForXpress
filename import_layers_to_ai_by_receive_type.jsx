#target illustrator

// receiveType別にAIファイルを生成するスクリプト

function main() {
    try {
        var receiveTypes = ["0", "1"]; // 0=イベント受け取り, 1=配送
        var typeNames = {
            "0": "event_pickup",
            "1": "delivery"
        };

        for (var i = 0; i < receiveTypes.length; i++) {
            var receiveType = receiveTypes[i];
            var typeName = typeNames[receiveType];

            $.writeln("\n========================================");
            $.writeln("Processing receiveType=" + receiveType + " (" + typeName + ")");
            $.writeln("========================================");

            processBatchForReceiveType(receiveType, typeName);
        }

        alert("All receiveType processing completed successfully!");
    } catch (e) {
        alert("Error: " + e.toString());
    }
}

function processBatchForReceiveType(receiveType, typeName) {
    var scriptFile = new File($.fileName);
    var scriptFolder = scriptFile.parent;

    // receiveType別の出力フォルダを探す
    var outputFolder = new Folder(scriptFolder + "/output_receive_" + receiveType);

    if (!outputFolder.exists) {
        $.writeln("Warning: Output folder not found for receiveType=" + receiveType);
        $.writeln("Skipping: " + outputFolder.fsName);
        return;
    }

    // 番号付きフォルダを取得
    var folders = outputFolder.getFiles(function(file) {
        return file instanceof Folder && /^\d+$/.test(file.name);
    });

    if (folders.length === 0) {
        $.writeln("No numbered folders found in: " + outputFolder.fsName);
        return;
    }

    $.writeln("Found " + folders.length + " folders for receiveType=" + receiveType);

    // receiveType別のAI出力フォルダを作成
    var aiOutputFolder = new Folder(scriptFolder + "/ai_output_" + typeName);
    if (!aiOutputFolder.exists) {
        aiOutputFolder.create();
    }

    // 各フォルダを処理
    for (var i = 0; i < folders.length; i++) {
        $.writeln("Processing folder " + (i + 1) + " of " + folders.length + ": " + folders[i].name);

        try {
            createAIFromPNGs(folders[i].name, outputFolder, aiOutputFolder);
            $.writeln("✓ Completed: " + typeName + "/" + folders[i].name + ".ai");
        } catch (e) {
            $.writeln("✗ Error processing folder " + folders[i].name + ": " + e.toString());
        }

        // メモリ解放のための小休止
        if (i < folders.length - 1) {
            $.sleep(500);
        }
    }

    $.writeln("Completed processing receiveType=" + receiveType);
    $.writeln("AI files saved to: " + aiOutputFolder.fsName);
}

function createAIFromPNGs(pageNo, baseOutputFolder, aiOutputFolder) {
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

    var inputFolder = new Folder(baseOutputFolder + "/" + pageNo);

    // 最初の画像からサイズを取得
    var firstImagePath = new File(inputFolder + "/" + layerNames[0]);
    if (!firstImagePath.exists) {
        for (var j = 0; j < layerNames.length; j++) {
            firstImagePath = new File(inputFolder + "/" + layerNames[j]);
            if (firstImagePath.exists) break;
        }
    }

    // サイズ取得
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

    // デフォルトのレイヤーを削除
    doc.layers[0].remove();

    // レイヤーを逆順で作成
    for (var i = layerNames.length - 1; i >= 0; i--) {
        var file = new File(inputFolder + "/" + layerNames[i]);
        if (file.exists) {
            var layerName = layerNames[i].replace('.png', '');
            var newLayer = doc.layers.add();
            newLayer.name = layerName;

            var placedItem = newLayer.placedItems.add();
            placedItem.file = file;

            // 画像を配置
            placedItem.position = [0, doc.height];
            placedItem.width = imageWidth;
            placedItem.height = imageHeight;

            // 画像を埋め込み
            try {
                placedItem.embed();
            } catch(e) {
                $.writeln("  Warning: Could not embed " + layerName);
            }
        }
    }

    // AIファイルとして保存
    var saveOptions = new IllustratorSaveOptions();
    saveOptions.compatibility = Compatibility.ILLUSTRATOR24;
    saveOptions.compressed = true;
    saveOptions.pdfCompatible = true;
    saveOptions.embedLinkedFiles = true;
    saveOptions.embedICCProfile = true;

    var outputFile = new File(aiOutputFolder + "/" + pageNo + ".ai");
    doc.saveAs(outputFile, saveOptions);

    doc.close(SaveOptions.DONOTSAVECHANGES);

    // メモリ解放
    $.sleep(200);
    $.gc();
}

// main関数を実行
main();