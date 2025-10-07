
#target illustrator
var pageNo = "17";  // This will be replaced
var scriptFile = new File($.fileName);
var scriptFolder = scriptFile.parent;
var outputFolder = new Folder(scriptFolder + "/output");
var aiOutputFolder = new Folder(scriptFolder + "/ai_output");

function createAIFromPNG() {
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

    if (!firstImagePath) return;

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

    // 保存
    var saveOptions = new IllustratorSaveOptions();
    saveOptions.compatibility = Compatibility.ILLUSTRATOR24;
    saveOptions.compressed = true;
    saveOptions.pdfCompatible = false;  // 高速化のため無効

    var outputFile = new File(aiOutputFolder + "/" + pageNo + ".ai");
    doc.saveAs(outputFile, saveOptions);
    doc.close(SaveOptions.DONOTSAVECHANGES);
}

createAIFromPNG();
    