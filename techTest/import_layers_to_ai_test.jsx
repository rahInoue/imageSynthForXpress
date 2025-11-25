#target illustrator

/**
 * Knockout検証用のAIファイル生成スクリプト
 *
 * techTest/output/ のPNGファイルをAIファイルに変換
 * char_knockレイヤーには各カードごとに異なるパターンが適用されている
 *
 * レイヤー構成（上から順）:
 * - sheet_labels (ラベル)
 * - sheet_cutline (カットライン)
 * - sheet_glare (グレア効果)
 * - sheet_logos (ロゴ)
 * - sheet_logo_knock (ロゴ用白板)
 * - sheet_character (キャラクター)
 * - sheet_char_knock (混合knockoutパターン)
 * - sheet_bg_knock (背景knock)
 * - sheet_background (背景)
 */

function main() {
    try {
        processTestOutput();
        alert("Knockout検証用AIファイルの生成が完了しました！");
    } catch (e) {
        alert("エラー: " + e.toString());
    }
}

function processTestOutput() {
    var scriptFile = new File($.fileName);
    var scriptFolder = scriptFile.parent;
    var outputFolder = new Folder(scriptFolder + "/output");

    if (!outputFolder.exists) {
        throw new Error("Output folder not found: " + outputFolder.fsName + "\n\nまず generate_knockout_test.py を実行してください。");
    }

    var aiOutputFolder = new Folder(scriptFolder + "/ai_output");
    if (!aiOutputFolder.exists) {
        aiOutputFolder.create();
    }

    $.writeln("\n========================================");
    $.writeln("Knockout検証用AIファイル生成");
    $.writeln("========================================");

    createAIFromPNGs(outputFolder, aiOutputFolder);
}

function createAIFromPNGs(inputFolder, aiOutputFolder) {
    // レイヤー構成（下から上の順で定義）
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

    // 最初の存在する画像からサイズを取得
    var firstImagePath = null;
    for (var j = 0; j < layerNames.length; j++) {
        var testPath = new File(inputFolder + "/" + layerNames[j]);
        if (testPath.exists) {
            firstImagePath = testPath;
            $.writeln("Found: " + layerNames[j]);
            break;
        }
    }

    if (!firstImagePath) {
        throw new Error("No valid images found in: " + inputFolder.fsName);
    }

    // 仮のドキュメントを作成して画像サイズを取得
    var tempDoc = app.documents.add();
    var tempItem = tempDoc.placedItems.add();
    tempItem.file = firstImagePath;

    var imageWidth = tempItem.width;
    var imageHeight = tempItem.height;

    $.writeln("Image size: " + imageWidth + " x " + imageHeight);

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
            placedItem.position = [0, doc.height];
            placedItem.width = imageWidth;
            placedItem.height = imageHeight;

            try {
                placedItem.embed();
                $.writeln("  Embedded: " + layerName);
            } catch(e) {
                $.writeln("  Warning: Could not embed " + layerName);
            }
        } else {
            $.writeln("  Skipped (not found): " + layerNames[i]);
        }
    }

    // AIファイルとして保存
    var saveOptions = new IllustratorSaveOptions();
    saveOptions.compatibility = Compatibility.ILLUSTRATOR24;
    saveOptions.compressed = true;
    saveOptions.pdfCompatible = true;
    saveOptions.embedLinkedFiles = true;
    saveOptions.embedICCProfile = true;

    var outputFile = new File(aiOutputFolder + "/knockout_test.ai");
    doc.saveAs(outputFile, saveOptions);

    $.writeln("\n✓ Saved: " + outputFile.fsName);

    doc.close(SaveOptions.DONOTSAVECHANGES);

    $.sleep(200);
    $.gc();
}

// main関数を実行
main();
