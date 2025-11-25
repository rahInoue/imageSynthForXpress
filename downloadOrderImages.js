#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { createWriteStream, existsSync } = require('fs');

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
 * ファイルが既に存在するかチェック
 * @param {string} filePath - チェックするファイルパス
 * @returns {boolean} - ファイルが存在する場合true
 */
function fileExists(filePath) {
  return existsSync(filePath);
}

/**
 * R2からファイルをダウンロード
 * @param {string} bucket - バケット名
 * @param {string} key - オブジェクトキー
 * @param {string} localPath - ローカル保存先パス
 * @param {boolean} skipExisting - 既存ファイルをスキップするか
 */
async function downloadFile(bucket, key, localPath, skipExisting = true) {
  try {
    // 既にファイルが存在する場合はスキップ
    if (skipExisting && fileExists(localPath)) {
      console.log(`⏭️  Skipped (exists): ${localPath}`);
      return { success: true, key, localPath, skipped: true };
    }

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
    return { success: true, key, localPath, skipped: false };
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
    const promise = downloadFile(task.bucket, task.key, task.localPath, task.skipExisting).then(result => {
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
 * 2025_order_goods_list.jsonから画像パスを抽出
 * @param {Array} orderList - 注文リスト
 * @returns {Set} - ユニークな画像パスのセット
 */
function extractImagePaths(orderList) {
  const imagePaths = new Set();
  
  for (const item of orderList) {
    // メイン画像
    if (item.shouhinNaiyou) {
      imagePaths.add(item.shouhinNaiyou);
    }
    
    // 背景画像
    if (item.bgFlg && item.backgroundFlg === 1) {
      imagePaths.add(item.bgFlg);
    }
    
    // ロゴ画像
    if (item.logoPath) {
      imagePaths.add(item.logoPath);
    }
  }
  
  return imagePaths;
}

/**
 * メイン処理
 */
async function main() {
  // コマンドライン引数の処理
  const args = process.argv.slice(2);
  const jsonFile = args[0] || '202508/2025_order_goods_list.test.json';
  const forceDownload = args.includes('--force');
  
  // 環境変数のチェック
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME) {
    console.error('Error: Missing required environment variables.');
    console.error('Please set: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME');
    process.exit(1);
  }

  try {
    // JSONファイルを読み込み
    const jsonContent = await fs.readFile(jsonFile, 'utf-8');
    const orderList = JSON.parse(jsonContent);
    
    console.log(`Loading order list from ${jsonFile}...`);
    console.log(`Found ${orderList.length} items in order list`);
    console.log(`Bucket: ${process.env.R2_BUCKET_NAME}`);
    console.log(`Force download: ${forceDownload}`);
    console.log(`Max concurrent downloads: ${MAX_CONCURRENT_DOWNLOADS}`);
    console.log('');

    // 画像パスを抽出
    const imagePaths = extractImagePaths(orderList);
    console.log(`Unique image paths found: ${imagePaths.size}`);
    console.log('');

    // ダウンロードタスクを準備
    const tasks = [];
    
    for (const imagePath of imagePaths) {
      // R2のキー（先頭のスラッシュを削除）
      const key = imagePath.replace(/^\//, '');
      
      // ローカルのパス（ルートフォルダに保存）
      const localPath = path.join(process.cwd(), imagePath);
      
      tasks.push({
        bucket: process.env.R2_BUCKET_NAME,
        key: key,
        localPath: localPath,
        skipExisting: !forceDownload,
      });
    }

    console.log(`Starting download of ${tasks.length} files...`);
    
    // ダウンロード実行
    const startTime = Date.now();
    const results = await downloadWithConcurrencyLimit(tasks, MAX_CONCURRENT_DOWNLOADS);
    const endTime = Date.now();
    
    // 結果のサマリー
    const successful = results.filter(r => r.success && !r.skipped).length;
    const skipped = results.filter(r => r.success && r.skipped).length;
    const failed = results.filter(r => !r.success).length;
    const elapsed = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('');
    console.log(`Download complete in ${elapsed}s`);
    console.log(`Downloaded: ${successful}, Skipped: ${skipped}, Failed: ${failed}`);
    
    // 失敗した画像の詳細を表示
    if (failed > 0) {
      console.log('\nFailed downloads:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.key}: ${r.error}`);
      });
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