#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { createWriteStream } = require('fs');

// 環境変数の読み込み
require('dotenv').config();

// R2クライアントの設定
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT_URL || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// 並列ダウンロード数の制限
const MAX_CONCURRENT_DOWNLOADS = Number(process.env.MAX_CONCURRENT_DOWNLOADS) || 5;

/**
 * R2からファイルをダウンロード
 * @param {string} bucket - バケット名
 * @param {string} key - オブジェクトキー
 * @param {string} localPath - ローカル保存先パス
 */
async function downloadFile(bucket, key, localPath) {
  try {
    // ディレクトリが存在しない場合は作成
    const dir = path.dirname(localPath);
    await fs.mkdir(dir, { recursive: true });

    // R2からオブジェクトを取得
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    
    const response = await r2Client.send(command);
    
    // ストリームを使用してファイルに書き込み
    if (response.Body instanceof Readable) {
      await pipeline(response.Body, createWriteStream(localPath));
    } else {
      // Body がストリームでない場合（ブラウザ環境など）
      const buffer = await response.Body.transformToByteArray();
      await fs.writeFile(localPath, buffer);
    }
    
    console.log(`✓ Downloaded: ${key} -> ${localPath}`);
    return { success: true, key, localPath };
  } catch (error) {
    console.error(`✗ Failed to download ${key}: ${error.message}`);
    return { success: false, key, error: error.message };
  }
}

/**
 * 並列ダウンロードを管理
 * @param {Array} tasks - ダウンロードタスクの配列
 * @param {number} maxConcurrent - 最大同時実行数
 */
async function downloadWithConcurrencyLimit(tasks, maxConcurrent) {
  const results = [];
  const executing = [];
  
  for (const task of tasks) {
    const promise = downloadFile(task.bucket, task.key, task.localPath).then(result => {
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });
    
    executing.push(promise);
    results.push(promise);
    
    if (executing.length >= maxConcurrent) {
      await Promise.race(executing);
    }
  }
  
  return Promise.all(results);
}

/**
 * メイン処理
 */
async function main() {
  // コマンドライン引数の処理
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node downloadFromR2.js <download_images.json> [--output-dir <dir>] [--update-json]');
    process.exit(1);
  }

  const jsonFile = args[0];
  const outputDirIndex = args.indexOf('--output-dir');
  const outputDir = outputDirIndex >= 0 ? args[outputDirIndex + 1] : 'images';
  const updateJson = args.includes('--update-json');

  // 環境変数のチェック
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME) {
    console.error('Error: Missing required environment variables.');
    console.error('Please set: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME');
    process.exit(1);
  }

  try {
    // JSONファイルを読み込み
    const jsonContent = await fs.readFile(jsonFile, 'utf-8');
    const imageInfo = JSON.parse(jsonContent);
    
    console.log(`Loading images from ${jsonFile}...`);
    console.log(`Output directory: ${outputDir}`);
    console.log(`Bucket: ${process.env.R2_BUCKET_NAME}`);
    console.log(`Max concurrent downloads: ${MAX_CONCURRENT_DOWNLOADS}`);
    console.log('');

    // ダウンロードタスクを準備
    const tasks = [];
    const updatedImageInfo = [];

    for (const item of imageInfo) {
      const newItem = { ...item };
      
      // キャラクター画像
      if (item.char) {
        const charKey = item.char.replace(/^\//, ''); // 先頭のスラッシュを削除
        const charLocalPath = path.join(outputDir, charKey);
        tasks.push({
          bucket: process.env.R2_BUCKET_NAME,
          key: charKey,
          localPath: charLocalPath,
        });
        newItem.char = charLocalPath;
      }
      
      // 背景画像
      if (item.bg) {
        const bgKey = item.bg.replace(/^\//, ''); // 先頭のスラッシュを削除
        const bgLocalPath = path.join(outputDir, bgKey);
        tasks.push({
          bucket: process.env.R2_BUCKET_NAME,
          key: bgKey,
          localPath: bgLocalPath,
        });
        newItem.bg = bgLocalPath;
      }
      
      updatedImageInfo.push(newItem);
    }

    console.log(`Starting download of ${tasks.length} files...`);
    
    // ダウンロード実行
    const startTime = Date.now();
    const results = await downloadWithConcurrencyLimit(tasks, MAX_CONCURRENT_DOWNLOADS);
    const endTime = Date.now();
    
    // 結果のサマリー
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const elapsed = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('');
    console.log(`Download complete in ${elapsed}s`);
    console.log(`Success: ${successful}, Failed: ${failed}`);
    
    // JSONファイルの更新（オプション）
    if (updateJson && successful > 0) {
      const outputJson = jsonFile.replace('.json', '_local.json');
      await fs.writeFile(outputJson, JSON.stringify(updatedImageInfo, null, 2));
      console.log(`\nUpdated JSON saved to: ${outputJson}`);
    }
    
    // 失敗があった場合はエラーコードで終了
    if (failed > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

// 実行
if (require.main === module) {
  main();
}