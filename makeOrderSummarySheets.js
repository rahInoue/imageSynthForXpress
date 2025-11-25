#!/usr/bin/env node

const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs').promises;
const path = require('path');

// 定数定義
const SHEET_WIDTH = 2100;  // A4横 @ 300DPI
const SHEET_HEIGHT = 2970; // A4縦 @ 300DPI
const MARGIN = 100;
const THUMBNAIL_SIZE = 150;
const THUMBNAILS_PER_ROW = 8;
const THUMBNAIL_SPACING = 30;

/**
 * 日本語フォントの登録を試みる
 */
function tryRegisterJapaneseFont() {
  const fontPaths = [
    '/System/Library/Fonts/Hiragino Sans GB.ttc',
    '/System/Library/Fonts/PingFang.ttc',
    '/Library/Fonts/Arial Unicode.ttf',
    '/System/Library/Fonts/Helvetica.ttc'
  ];

  for (const fontPath of fontPaths) {
    try {
      if (require('fs').existsSync(fontPath)) {
        registerFont(fontPath, { family: 'Japanese' });
        console.log(`Using font: ${fontPath}`);
        return true;
      }
    } catch (error) {
      // Continue to next font
    }
  }
  
  console.warn('Warning: Japanese font not found. Japanese text may not display correctly.');
  return false;
}

// フォント登録
tryRegisterJapaneseFont();

/**
 * 注文サマリーシートを生成
 */
async function generateOrderSummarySheet(order, orderItems, outputPath) {
  const canvas = createCanvas(SHEET_WIDTH, SHEET_HEIGHT);
  const ctx = canvas.getContext('2d');

  // 背景を白に
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);

  // タイトルとヘッダー情報
  ctx.fillStyle = 'black';
  ctx.font = 'bold 80px Japanese';
  ctx.fillText(`注文サマリー - Order ID: ${order.orderId}`, MARGIN, MARGIN + 80);

  // 基本情報
  ctx.font = '50px Japanese';
  let yPos = MARGIN + 180;
  
  ctx.fillText(`顧客名 / Customer: ${order.userName}`, MARGIN, yPos);
  yPos += 70;
  
  const statusText = order.orderStatus === '2' ? 'アクティブ / Active' : 'キャンセル / Cancelled';
  const statusColor = order.orderStatus === '2' ? 'green' : 'red';
  ctx.fillStyle = statusColor;
  ctx.fillText(`ステータス / Status: ${statusText}`, MARGIN, yPos);
  ctx.fillStyle = 'black';
  yPos += 100;

  // 配送情報
  ctx.font = 'bold 60px Japanese';
  if (order.receiveType === '0') {
    ctx.fillText('受取方法: イベント受取 / Event Pickup', MARGIN, yPos);
    yPos += 70;
    ctx.font = '45px Japanese';
    ctx.fillText('配送先情報なし / No delivery information required', MARGIN + 50, yPos);
  } else if (order.receiveType === '1') {
    ctx.fillText('受取方法: 宅配 / Home Delivery', MARGIN, yPos);
    yPos += 80;
    
    ctx.font = '45px Japanese';
    if (order.addressNumber) {
      ctx.fillText(`〒${order.addressNumber}`, MARGIN + 50, yPos);
      yPos += 60;
    }
    if (order.address) {
      // 住所が長い場合は折り返し
      const addressLines = wrapText(ctx, order.address, SHEET_WIDTH - MARGIN * 2 - 100);
      for (const line of addressLines) {
        ctx.fillText(line, MARGIN + 50, yPos);
        yPos += 60;
      }
    }
    if (order.addressName) {
      ctx.fillText(`受取人 / Recipient: ${order.addressName}`, MARGIN + 50, yPos);
      yPos += 60;
    }
    if (order.phonenumber) {
      ctx.fillText(`電話番号 / Tel: ${order.phonenumber}`, MARGIN + 50, yPos);
      yPos += 60;
    }
  }

  yPos += 80;

  // アイテム情報セクション
  ctx.font = 'bold 60px Japanese';
  ctx.fillText(`注文アイテム / Order Items: ${orderItems.length} 点`, MARGIN, yPos);
  yPos += 80;

  // サムネイルグリッド
  const startY = yPos;
  let currentX = MARGIN;
  let currentY = startY;
  let itemsInRow = 0;

  for (let i = 0; i < orderItems.length; i++) {
    const item = orderItems[i];
    
    // 新しい行に移動
    if (itemsInRow >= THUMBNAILS_PER_ROW) {
      currentX = MARGIN;
      currentY += THUMBNAIL_SIZE + THUMBNAIL_SPACING + 100; // スペースを追加してテキスト用
      itemsInRow = 0;
    }

    // サムネイル枠
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 2;
    ctx.strokeRect(currentX, currentY, THUMBNAIL_SIZE, THUMBNAIL_SIZE);

    // 画像を読み込んで描画
    try {
      const imagePath = path.join(process.cwd(), item.shouhinNaiyou);
      if (require('fs').existsSync(imagePath)) {
        const img = await loadImage(imagePath);
        // アスペクト比を保持してサムネイルに収める
        const scale = Math.min(THUMBNAIL_SIZE / img.width, THUMBNAIL_SIZE / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = currentX + (THUMBNAIL_SIZE - w) / 2;
        const y = currentY + (THUMBNAIL_SIZE - h) / 2;
        ctx.drawImage(img, x, y, w, h);
      } else {
        // 画像が見つからない場合
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(currentX + 1, currentY + 1, THUMBNAIL_SIZE - 2, THUMBNAIL_SIZE - 2);
        ctx.fillStyle = '#999';
        ctx.font = '20px Japanese';
        ctx.textAlign = 'center';
        ctx.fillText('No Image', currentX + THUMBNAIL_SIZE/2, currentY + THUMBNAIL_SIZE/2);
        ctx.textAlign = 'left';
      }
    } catch (error) {
      console.warn(`Failed to load image: ${item.shouhinNaiyou}`);
      // エラー時の表示
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(currentX + 1, currentY + 1, THUMBNAIL_SIZE - 2, THUMBNAIL_SIZE - 2);
      ctx.fillStyle = '#999';
      ctx.font = '20px Japanese';
      ctx.textAlign = 'center';
      ctx.fillText('Error', currentX + THUMBNAIL_SIZE/2, currentY + THUMBNAIL_SIZE/2);
      ctx.textAlign = 'left';
    }

    // アイテムID
    ctx.fillStyle = 'black';
    ctx.font = '25px Japanese';
    ctx.textAlign = 'center';
    ctx.fillText(`${item.shouhinId}`, currentX + THUMBNAIL_SIZE/2, currentY + THUMBNAIL_SIZE + 30);
    
    // 背景有無
    const hasBg = item.backgroundFlg === 1 && item.bgFlg;
    ctx.font = 'bold 30px Japanese';
    if (hasBg) {
      ctx.fillStyle = 'green';
      ctx.fillText('BG: ✓', currentX + THUMBNAIL_SIZE/2, currentY + THUMBNAIL_SIZE + 60);
    } else {
      ctx.fillStyle = 'red';
      ctx.fillText('BG: ✗', currentX + THUMBNAIL_SIZE/2, currentY + THUMBNAIL_SIZE + 60);
    }
    
    // 数量が1より多い場合は表示
    if (item.amount > 1) {
      ctx.fillStyle = 'blue';
      ctx.font = 'bold 35px Japanese';
      ctx.fillText(`×${item.amount}`, currentX + THUMBNAIL_SIZE/2, currentY + THUMBNAIL_SIZE + 95);
    }
    
    ctx.textAlign = 'left';
    
    currentX += THUMBNAIL_SIZE + THUMBNAIL_SPACING;
    itemsInRow++;
  }

  // フッター情報
  ctx.fillStyle = '#666';
  ctx.font = '35px Japanese';
  const now = new Date();
  const dateStr = now.toLocaleString('ja-JP', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  ctx.fillText(`生成日時 / Generated: ${dateStr}`, MARGIN, SHEET_HEIGHT - MARGIN);

  // PNG保存
  const buffer = canvas.toBuffer('image/png');
  await fs.writeFile(outputPath, buffer);
  console.log(`Saved order summary: ${outputPath}`);
}

/**
 * テキストを折り返す
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split('');
  const lines = [];
  let currentLine = '';

  for (const char of words) {
    const testLine = currentLine + char;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

/**
 * メイン処理
 */
async function main() {
  try {
    // コマンドライン引数
    const args = process.argv.slice(2);
    let orderInfoPath = '202508/202508_order_info.test.json';
    let goodsListPath = '202508/2025_order_goods_list.test.json';
    let outputDir = 'order_summaries';

    // 引数解析
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
          outputDir = args[++i];
          break;
        case '--help':
        case '-h':
          console.log(`Usage: node makeOrderSummarySheets.js [options]

Options:
  -o, --order-info <file>   Order info JSON file (default: 202508/202508_order_info.json)
  -g, --goods-list <file>   Goods list JSON file (default: 202508/2025_order_goods_list.json)
  -out, --output <dir>      Output directory (default: order_summaries)
  -h, --help                Show this help message`);
          process.exit(0);
      }
    }

    // ファイル読み込み
    console.log(`Loading order info from: ${orderInfoPath}`);
    console.log(`Loading goods list from: ${goodsListPath}`);

    const orderInfo = JSON.parse(await fs.readFile(orderInfoPath, 'utf-8'));
    const goodsList = JSON.parse(await fs.readFile(goodsListPath, 'utf-8'));

    // 出力ディレクトリ作成
    await fs.mkdir(outputDir, { recursive: true });

    // orderIdでグループ化
    const orderItemsMap = new Map();
    for (const item of goodsList) {
      if (!orderItemsMap.has(item.orderId)) {
        orderItemsMap.set(item.orderId, []);
      }
      orderItemsMap.get(item.orderId).push(item);
    }

    // 各注文のサマリーシートを生成
    let processedCount = 0;
    for (const order of orderInfo) {
      const items = orderItemsMap.get(order.orderId) || [];
      
      if (items.length === 0) {
        console.warn(`No items found for order ${order.orderId}`);
        continue;
      }

      // アクティブな注文のみ処理（オプション）
      if (order.orderStatus !== '2') {
        console.log(`Skipping cancelled order ${order.orderId}`);
        continue;
      }

      const outputPath = path.join(outputDir, `order_${order.orderId}_summary.png`);
      await generateOrderSummarySheet(order, items, outputPath);
      processedCount++;
    }

    console.log(`\nCompleted! Generated ${processedCount} order summary sheets in ${outputDir}/`);

  } catch (error) {
    console.error('Error:', error);
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