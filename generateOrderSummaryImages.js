#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');

// 定数定義
const CANVAS_WIDTH = 1400; // 幅を拡張して多くの画像を表示できるようにする
const CARD_PADDING = 20;
const THUMBNAIL_WIDTH = 300;
const THUMBNAIL_HEIGHT = 300;
const LINE_HEIGHT = 30;
const FONT_SIZE_TITLE = 24;
const FONT_SIZE_NORMAL = 18;
const FONT_SIZE_SMALL = 16;

/**
 * 画像のリサイズ（アスペクト比を保持）
 */
function calculateResizedDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
  const aspectRatio = originalWidth / originalHeight;
  
  let width = maxWidth;
  let height = maxWidth / aspectRatio;
  
  if (height > maxHeight) {
    height = maxHeight;
    width = maxHeight * aspectRatio;
  }
  
  return { width, height };
}

/**
 * 単一の注文カードを描画
 */
async function drawOrderCard(ctx, order, goods, yOffset) {
  // サムネイルのグリッド設定
  const THUMBNAILS_PER_ROW = 5; // 1行に表示するサムネイル数
  const THUMBNAIL_SPACING = 10;
  const SMALL_THUMBNAIL_WIDTH = 200;
  const SMALL_THUMBNAIL_HEIGHT = 200;
  
  // 必要な行数を計算
  const thumbnailRows = Math.ceil(goods.length / THUMBNAILS_PER_ROW);
  const thumbnailAreaHeight = thumbnailRows * (SMALL_THUMBNAIL_HEIGHT + THUMBNAIL_SPACING) + THUMBNAIL_SPACING;
  
  // カードの高さを動的に計算
  const minTextAreaHeight = 200; // テキストエリアの最小高さ
  const cardHeight = Math.max(minTextAreaHeight, thumbnailAreaHeight) + CARD_PADDING * 2;
  
  // カードの背景
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(CARD_PADDING, yOffset, CANVAS_WIDTH - CARD_PADDING * 2, cardHeight);
  
  // 枠線
  ctx.strokeStyle = '#dee2e6';
  ctx.lineWidth = 2;
  ctx.strokeRect(CARD_PADDING, yOffset, CANVAS_WIDTH - CARD_PADDING * 2, cardHeight);
  
  // テキストエリア
  const textX = CARD_PADDING * 2;
  let textY = yOffset + CARD_PADDING * 2;
  
  // オーダーIDとユーザー名
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${FONT_SIZE_TITLE}px sans-serif`;
  ctx.fillText(`オーダーID: ${order.orderId}`, textX, textY);
  
  textY += LINE_HEIGHT;
  ctx.font = `${FONT_SIZE_NORMAL}px sans-serif`;
  ctx.fillText(`お客様名: ${order.userName}`, textX, textY);
  
  // 商品点数を表示
  textY += LINE_HEIGHT;
  ctx.fillStyle = '#666666';
  ctx.font = `${FONT_SIZE_SMALL}px sans-serif`;
  const totalAmount = goods.reduce((sum, item) => sum + item.amount, 0);
  ctx.fillText(`商品点数: ${goods.length}種類 / 合計${totalAmount}枚`, textX, textY);
  
  // 受取方法
  textY += LINE_HEIGHT * 1.2;
  const receiveTypeText = order.receiveType === "0" ? "アルパカフェス会場受取" : "郵送";
  const receiveTypeColor = order.receiveType === "0" ? "#0066cc" : "#cc0066";
  ctx.fillStyle = receiveTypeColor;
  ctx.font = `bold ${FONT_SIZE_NORMAL}px sans-serif`;
  ctx.fillText(`受取方法: ${receiveTypeText}`, textX, textY);
  
  // 郵送の場合、住所情報を表示
  if (order.receiveType === "1") {
    ctx.fillStyle = '#000000';
    ctx.font = `${FONT_SIZE_SMALL}px sans-serif`;
    
    textY += LINE_HEIGHT;
    if (order.addressNumber) {
      ctx.fillText(`〒${order.addressNumber}`, textX, textY);
    }
    
    if (order.address) {
      textY += LINE_HEIGHT * 0.8;
      const addressLines = wrapText(ctx, order.address, 450);
      for (const line of addressLines) {
        ctx.fillText(line, textX, textY);
        textY += LINE_HEIGHT * 0.8;
      }
    }
    
    if (order.addressName) {
      textY += LINE_HEIGHT * 0.8;
      ctx.fillText(`宛名: ${order.addressName}`, textX, textY);
    }
    
    if (order.phonenumber) {
      textY += LINE_HEIGHT * 0.8;
      ctx.fillText(`電話番号: ${order.phonenumber}`, textX, textY);
    }
  }
  
  // 商品サムネイル表示エリア
  const thumbnailStartX = 550;
  let thumbnailX = thumbnailStartX;
  let thumbnailY = yOffset + CARD_PADDING;
  let itemIndex = 0;
  
  // 商品ごとの処理
  for (const item of goods) {
    // 行の折り返し
    if (itemIndex > 0 && itemIndex % THUMBNAILS_PER_ROW === 0) {
      thumbnailX = thumbnailStartX;
      thumbnailY += SMALL_THUMBNAIL_HEIGHT + THUMBNAIL_SPACING;
    }
    
    try {
      // キャラクター画像を読み込み
      const imagePath = path.join(__dirname, item.shouhinNaiyou);
      const img = await loadImage(imagePath);
      
      // リサイズしてサムネイル表示
      const { width, height } = calculateResizedDimensions(
        img.width,
        img.height,
        SMALL_THUMBNAIL_WIDTH,
        SMALL_THUMBNAIL_HEIGHT
      );
      
      const drawX = thumbnailX + (SMALL_THUMBNAIL_WIDTH - width) / 2;
      const drawY = thumbnailY + (SMALL_THUMBNAIL_HEIGHT - height) / 2;
      
      ctx.drawImage(img, drawX, drawY, width, height);
      
      // 商品情報の表示
      ctx.font = `${FONT_SIZE_SMALL - 2}px sans-serif`;
      ctx.fillStyle = '#000000';
      
      // 商品ID
      ctx.textAlign = 'center';
      ctx.fillText(`ID: ${item.shouhinId}`, thumbnailX + SMALL_THUMBNAIL_WIDTH / 2, thumbnailY + SMALL_THUMBNAIL_HEIGHT + 15);
      
      // 背景有無
      const bgText = item.backgroundFlg === 1 ? "背景■" : "背景□";
      ctx.fillText(bgText, thumbnailX + SMALL_THUMBNAIL_WIDTH / 2, thumbnailY + SMALL_THUMBNAIL_HEIGHT + 30);
      
      // 数量表示（複数の場合）
      if (item.amount > 1) {
        ctx.fillStyle = '#ff0000';
        ctx.font = `bold ${FONT_SIZE_SMALL}px sans-serif`;
        ctx.fillText(`×${item.amount}`, thumbnailX + SMALL_THUMBNAIL_WIDTH / 2, thumbnailY + SMALL_THUMBNAIL_HEIGHT + 45);
      }
      ctx.textAlign = 'left';
      
    } catch (error) {
      console.error(`Failed to load image ${item.shouhinNaiyou}: ${error.message}`);
      // エラー時の代替表示
      ctx.fillStyle = '#cccccc';
      ctx.fillRect(thumbnailX, thumbnailY, SMALL_THUMBNAIL_WIDTH, SMALL_THUMBNAIL_HEIGHT);
      ctx.fillStyle = '#666666';
      ctx.font = `${FONT_SIZE_SMALL - 2}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('画像エラー', thumbnailX + SMALL_THUMBNAIL_WIDTH / 2, thumbnailY + SMALL_THUMBNAIL_HEIGHT / 2);
      ctx.fillText(`ID: ${item.shouhinId}`, thumbnailX + SMALL_THUMBNAIL_WIDTH / 2, thumbnailY + SMALL_THUMBNAIL_HEIGHT + 15);
      ctx.textAlign = 'left';
    }
    
    thumbnailX += SMALL_THUMBNAIL_WIDTH + THUMBNAIL_SPACING;
    itemIndex++;
  }
  
  return cardHeight + CARD_PADDING;
}

/**
 * テキストの折り返し処理
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split('');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine + word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine !== '') {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine !== '') {
    lines.push(currentLine);
  }
  
  return lines;
}

/**
 * 注文情報画像を生成
 */
async function generateOrderSummaryImages(orderInfoPath, goodsListPath, outputDir) {
  try {
    // JSONファイルを読み込み
    console.log('Loading order information...');
    const orderInfo = JSON.parse(await fs.readFile(orderInfoPath, 'utf-8'));
    const goodsList = JSON.parse(await fs.readFile(goodsListPath, 'utf-8'));
    
    // 出力ディレクトリを作成
    const summaryDir = path.join(outputDir, 'order_summary');
    await fs.mkdir(summaryDir, { recursive: true });
    
    // 注文ごとに商品をグループ化
    const orderGroups = new Map();
    for (const item of goodsList) {
      if (!orderGroups.has(item.orderId)) {
        orderGroups.set(item.orderId, []);
      }
      orderGroups.get(item.orderId).push(item);
    }
    
    // 注文を5件ずつのページに分割（大量注文に対応するため）
    const ordersPerPage = 5;
    const totalOrders = orderInfo.length;
    const totalPages = Math.ceil(totalOrders / ordersPerPage);
    
    console.log(`Generating ${totalPages} page(s) for ${totalOrders} orders...`);
    
    for (let page = 0; page < totalPages; page++) {
      const startIdx = page * ordersPerPage;
      const endIdx = Math.min(startIdx + ordersPerPage, totalOrders);
      const pageOrders = orderInfo.slice(startIdx, endIdx);
      
      // ページの高さを計算
      let requiredHeight = CARD_PADDING;
      for (const order of pageOrders) {
        const goods = orderGroups.get(order.orderId) || [];
        const cardHeight = Math.max(THUMBNAIL_HEIGHT + CARD_PADDING * 2, 400);
        requiredHeight += cardHeight + CARD_PADDING;
      }
      
      // キャンバスを作成
      const canvas = createCanvas(CANVAS_WIDTH, requiredHeight);
      const ctx = canvas.getContext('2d');
      
      // 背景色
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CANVAS_WIDTH, requiredHeight);
      
      // 各注文を描画
      let yOffset = CARD_PADDING;
      for (const order of pageOrders) {
        const goods = orderGroups.get(order.orderId) || [];
        const cardHeight = await drawOrderCard(ctx, order, goods, yOffset);
        yOffset += cardHeight;
      }
      
      // ページ番号を追加
      ctx.fillStyle = '#666666';
      ctx.font = `${FONT_SIZE_SMALL}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(`Page ${page + 1} / ${totalPages}`, CANVAS_WIDTH - CARD_PADDING, requiredHeight - 10);
      
      // 画像を保存
      const outputPath = path.join(summaryDir, `order_summary_page_${page + 1}.png`);
      const buffer = canvas.toBuffer('image/png');
      await fs.writeFile(outputPath, buffer);
      console.log(`Saved: ${outputPath}`);
    }
    
    console.log(`\nSuccessfully generated ${totalPages} summary image(s) in ${summaryDir}`);
    
  } catch (error) {
    console.error(`Error generating order summary images: ${error.message}`);
    throw error;
  }
}

/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);
  
  // デフォルト値
  let orderInfoPath = '202508/202508_order_info.json';
  let goodsListPath = '202508/2025_order_goods_list.json';
  let outputDir = 'output';
  
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
      case '--output-dir':
      case '-d':
        outputDir = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`Usage: node generateOrderSummaryImages.js [options]
        
Options:
  -o, --order-info <file>    Order info JSON file (default: 202508/202508_order_info.json)
  -g, --goods-list <file>    Goods list JSON file (default: 202508/2025_order_goods_list.json)
  -d, --output-dir <dir>     Output directory (default: output)
  -h, --help                 Show this help message
  
Example:
  node generateOrderSummaryImages.js
  node generateOrderSummaryImages.js -o 202508/202508_order_info.json -g 202508/2025_order_goods_list.json -d output`);
        process.exit(0);
      default:
        if (!args[i].startsWith('-')) {
          outputDir = args[i];
        }
    }
  }
  
  try {
    await generateOrderSummaryImages(orderInfoPath, goodsListPath, outputDir);
  } catch (error) {
    console.error('Failed to generate order summary images');
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