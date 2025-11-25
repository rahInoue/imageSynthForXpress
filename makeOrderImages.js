#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

/**
 * 注文情報と商品リストをマージして、index.py用の画像情報を生成
 * @param {string} orderInfoPath - 注文情報JSONファイルのパス
 * @param {string} goodsListPath - 商品リストJSONファイルのパス
 * @param {string} outputPath - 出力JSONファイルのパス
 */
async function processOrderInfo(orderInfoPath, goodsListPath, outputPath) {
  try {
    // JSONファイルを読み込み
    console.log(`Loading order info from: ${orderInfoPath}`);
    console.log(`Loading goods list from: ${goodsListPath}`);
    
    const orderInfoContent = await fs.readFile(orderInfoPath, 'utf-8');
    const goodsListContent = await fs.readFile(goodsListPath, 'utf-8');
    
    const orderInfo = JSON.parse(orderInfoContent);
    const goodsList = JSON.parse(goodsListContent);
    
    console.log(`Found ${orderInfo.length} orders`);
    console.log(`Found ${goodsList.length} goods items`);
    
    // orderIdをキーとして注文情報をマップ化
    const orderMap = new Map();
    orderInfo.forEach(order => {
      orderMap.set(order.orderId, order);
    });
    
    // 商品リストを処理して最終的な形式に変換
    const processedItems = [];
    const missingOrders = new Set();
    
    goodsList.forEach((item, index) => {
      const order = orderMap.get(item.orderId);
      
      if (!order) {
        missingOrders.add(item.orderId);
        console.warn(`Warning: Order ID ${item.orderId} not found in order info`);
        return;
      }
      
      // 基本情報の設定
      const processedItem = {
        key: `${item.orderId}_${item.shouhinId}`,
        char: item.shouhinNaiyou,
        bg: null,
        logo: null,
        orderId: String(item.orderId),
        userId: order.userId,
        userName: order.userName || "名前未設定",
        amount: item.amount
      };
      
      // 背景画像の設定（backgroundFlgが1の場合のみ）
      if (item.backgroundFlg === 1 && item.bgFlg) {
        processedItem.bg = item.bgFlg;
      }
      
      // ロゴ画像の設定
      if (item.logoPath) {
        processedItem.logo = item.logoPath;
      }
      
      processedItems.push(processedItem);
    });
    
    // 警告メッセージ
    if (missingOrders.size > 0) {
      console.warn(`\nWarning: ${missingOrders.size} order IDs were not found in order info:`, Array.from(missingOrders));
    }
    
    // orderIdでソート（数値として正しくソート）
    processedItems.sort((a, b) => {
      const orderIdA = parseInt(a.orderId);
      const orderIdB = parseInt(b.orderId);
      if (orderIdA !== orderIdB) {
        return orderIdA - orderIdB;
      }
      // 同じorderIdの場合はshouhinIdでソート
      const shouhinIdA = parseInt(a.key.split('_')[1]);
      const shouhinIdB = parseInt(b.key.split('_')[1]);
      return shouhinIdA - shouhinIdB;
    });
    
    // 結果を出力
    console.log(`\nProcessed ${processedItems.length} items successfully`);
    
    // ファイルに保存
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });
    
    await fs.writeFile(outputPath, JSON.stringify(processedItems, null, 2));
    console.log(`Output saved to: ${outputPath}`);
    
    // サンプル出力
    if (processedItems.length > 0) {
      console.log('\nSample output (first item):');
      console.log(JSON.stringify(processedItems[0], null, 2));
    }
    
    return processedItems;
    
  } catch (error) {
    console.error(`Error processing order info: ${error.message}`);
    throw error;
  }
}

/**
 * メイン処理
 */
async function main() {
  // コマンドライン引数の処理
  const args = process.argv.slice(2);
  
  // デフォルト値の設定
  let orderInfoPath = '202508/202508_order_info.test.json';
  let goodsListPath = '202508/2025_order_goods_list.test.json';
  let outputPath = 'output/order_images.test.json';
  
  // 引数の解析
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--order-info':
      case '-o':
        orderInfoPath = args[++i];
        break;
      case '--goods-list':
      case '-g':
        goodsListPath = args[++i];
        break;
      case '--output':
      case '-out':
        outputPath = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`Usage: node makeOrderImages.js [options]
        
Options:
  -o, --order-info <file>   Order info JSON file (default: 202508/202508_order_info.json)
  -g, --goods-list <file>   Goods list JSON file (default: 202508/2025_order_goods_list.json)
  -out, --output <file>     Output JSON file (default: output/order_images.json)
  -h, --help                Show this help message`);
        process.exit(0);
      default:
        if (!args[i].startsWith('-')) {
          // 引数なしの場合は最初の引数を出力ファイルとして扱う
          outputPath = args[i];
        }
    }
  }
  
  try {
    await processOrderInfo(orderInfoPath, goodsListPath, outputPath);
  } catch (error) {
    console.error('Failed to process order info');
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