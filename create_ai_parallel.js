#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// 並列処理でAIファイルを生成
async function createAIParallel(maxConcurrent = 3) {
    const outputDir = path.join(__dirname, 'output');
    const aiOutputDir = path.join(__dirname, 'ai_output');

    // ai_outputディレクトリを作成
    if (!fs.existsSync(aiOutputDir)) {
        fs.mkdirSync(aiOutputDir, { recursive: true });
    }

    // 番号付きフォルダを取得
    const folders = fs.readdirSync(outputDir)
        .filter(f => /^\d+$/.test(f) && fs.statSync(path.join(outputDir, f)).isDirectory())
        .sort((a, b) => parseInt(a) - parseInt(b));

    if (folders.length === 0) {
        console.error('No numbered folders found in output directory');
        return;
    }

    console.log(`Found ${folders.length} folders to process`);
    console.log(`Processing with ${maxConcurrent} concurrent operations`);

    // 個別処理用のJSXスクリプトを作成
    const singleProcessScript = `
#target illustrator
var pageNo = "${folders[0]}";  // This will be replaced
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
    `;

    // バッチ処理
    const processBatch = async (batch) => {
        const promises = batch.map(folder => {
            return new Promise((resolve, reject) => {
                // 個別のJSXファイルを作成
                const scriptContent = singleProcessScript.replace(`var pageNo = "${folders[0]}"`, `var pageNo = "${folder}"`);
                const tempScriptPath = path.join(__dirname, `temp_ai_${folder}.jsx`);
                fs.writeFileSync(tempScriptPath, scriptContent);

                // osascriptで実行
                const command = `osascript -e 'tell application id "com.adobe.illustrator" to do javascript file "${tempScriptPath}"'`;

                exec(command, (error, stdout, stderr) => {
                    // 一時ファイルを削除
                    try {
                        fs.unlinkSync(tempScriptPath);
                    } catch (e) {
                        // ignore
                    }

                    if (error) {
                        console.error(`Error processing folder ${folder}:`, error.message);
                        reject(error);
                    } else {
                        console.log(`✓ Completed: ${folder}.ai`);
                        resolve();
                    }
                });
            });
        });

        return Promise.all(promises);
    };

    // フォルダをバッチに分割
    const batches = [];
    for (let i = 0; i < folders.length; i += maxConcurrent) {
        batches.push(folders.slice(i, i + maxConcurrent));
    }

    // バッチごとに処理
    for (let i = 0; i < batches.length; i++) {
        console.log(`\nProcessing batch ${i + 1}/${batches.length}...`);
        try {
            await processBatch(batches[i]);
        } catch (error) {
            console.error('Batch processing error:', error);
        }

        // バッチ間で少し待機
        if (i < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    console.log('\n✨ All AI files created successfully!');
}

// コマンドライン引数から並列数を取得
const maxConcurrent = parseInt(process.argv[2]) || 3;

// 実行
createAIParallel(maxConcurrent)
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });