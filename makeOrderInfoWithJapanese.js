const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

// 設定
const THUMBNAIL_SIZE = 100; // サムネイルサイズ（px）
const CARDS_PER_ROW = 5;   // 1行あたりのカード数
const CARD_SPACING = 10;    // カード間のスペース

async function loadOrderData() {
  const imagesData = JSON.parse(fs.readFileSync('images.test.json', 'utf8'));
  const orderInfo = JSON.parse(fs.readFileSync('orderInfo.test.json', 'utf8'));
  
  // OrderIDごとにグループ化
  const orderGroups = {};
  for (const item of imagesData) {
    if (!orderGroups[item.orderId]) {
      orderGroups[item.orderId] = [];
    }
    orderGroups[item.orderId].push(item);
  }
  
  return { orderGroups, orderInfo };
}

async function createThumbnail(imagePath) {
  try {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    const ctx = canvas.getContext('2d');
    
    // アスペクト比を保持してリサイズ
    const scale = Math.min(THUMBNAIL_SIZE / image.width, THUMBNAIL_SIZE / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    const x = (THUMBNAIL_SIZE - width) / 2;
    const y = (THUMBNAIL_SIZE - height) / 2;
    
    // 白背景
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    
    // 画像を描画
    ctx.drawImage(image, x, y, width, height);
    
    // 枠線
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    
    return canvas.toBuffer('image/png');
  } catch (error) {
    console.error(`Error loading image ${imagePath}:`, error);
    // エラー時は空の画像を返す
    const canvas = createCanvas(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('No Image', THUMBNAIL_SIZE/2, THUMBNAIL_SIZE/2);
    return canvas.toBuffer('image/png');
  }
}

async function createOrderImage(orderId, items, customerInfo) {
  // A4サイズ相当のキャンバス（72dpi）
  const width = 595;
  const height = 842;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // 白背景
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);
  
  // テキスト設定
  ctx.fillStyle = 'black';
  let yPosition = 50;
  
  // タイトル
  ctx.font = 'bold 20px Arial';
  ctx.fillText('Order Information', 50, yPosition);
  
  yPosition += 40;
  
  // 注文情報（日本語を含む）
  ctx.font = '12px Arial';
  const info = customerInfo || {};
  
  // 日本語フォントが利用できない場合のフォールバック
  const infoLines = [
    `Order ID: ${orderId}`,
    `Customer: ${info.customerName || 'N/A'}`,
    `Address: ${info.address || 'N/A'}`,
    `Phone: ${info.phoneNumber || 'N/A'}`,
    `Email: ${info.email || 'N/A'}`,
    `Order Date: ${info.orderDate || 'N/A'}`,
    `Delivery Date: ${info.deliveryDate || 'N/A'}`,
    '',
    `Total Items: ${items.length}`,
  ];
  
  for (const line of infoLines) {
    ctx.fillText(line, 50, yPosition);
    yPosition += 20;
  }
  
  yPosition += 20;
  
  // アイテムセクションのタイトル
  ctx.font = 'bold 14px Arial';
  ctx.fillText('Order Items:', 50, yPosition);
  
  yPosition += 30;
  
  // アイテムの画像とキー
  let xPosition = 50;
  let itemCount = 0;
  
  for (const item of items) {
    // 新しい行が必要な場合
    if (itemCount > 0 && itemCount % CARDS_PER_ROW === 0) {
      xPosition = 50;
      yPosition += THUMBNAIL_SIZE + 30;
    }
    
    // サムネイル画像を読み込んで描画
    try {
      const image = await loadImage(item.char);
      const scale = Math.min(THUMBNAIL_SIZE / image.width, THUMBNAIL_SIZE / image.height);
      const imgWidth = image.width * scale;
      const imgHeight = image.height * scale;
      const imgX = xPosition + (THUMBNAIL_SIZE - imgWidth) / 2;
      const imgY = yPosition + (THUMBNAIL_SIZE - imgHeight) / 2;
      
      // 白背景
      ctx.fillStyle = 'white';
      ctx.fillRect(xPosition, yPosition, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
      
      // 画像
      ctx.drawImage(image, imgX, imgY, imgWidth, imgHeight);
      
      // 枠線
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 1;
      ctx.strokeRect(xPosition, yPosition, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
      
      // キー
      ctx.fillStyle = 'black';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(item.key, xPosition + THUMBNAIL_SIZE / 2, yPosition + THUMBNAIL_SIZE + 15);
      ctx.textAlign = 'left';
    } catch (error) {
      console.error(`Error loading image for ${item.key}:`, error);
    }
    
    xPosition += THUMBNAIL_SIZE + CARD_SPACING;
    itemCount++;
  }
  
  return canvas.toBuffer('image/png');
}

async function createOrderPDF(orderId, items, customerInfo, orderImageBuffer) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4サイズ
  
  // PNG画像を埋め込む
  const orderImage = await pdfDoc.embedPng(orderImageBuffer);
  
  // 画像をページに描画
  page.drawImage(orderImage, {
    x: 0,
    y: 0,
    width: 595,
    height: 842,
  });
  
  return pdfDoc;
}

async function main() {
  try {
    console.log('発注情報処理を開始します...');
    
    // データの読み込み
    const { orderGroups, orderInfo } = await loadOrderData();
    
    // 出力ディレクトリの作成
    const outputDir = 'order_pdfs';
    const detailDir = 'order_details';
    
    for (const dir of [outputDir, detailDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    
    // 各注文の処理
    for (const [orderId, items] of Object.entries(orderGroups)) {
      console.log(`処理中: ${orderId} (${items.length}アイテム)`);
      
      const customerInfo = orderInfo[orderId];
      
      // PNG画像として生成
      const orderImageBuffer = await createOrderImage(orderId, items, customerInfo);
      
      // PNG画像を保存（確認用）
      const pngPath = path.join(detailDir, `${orderId}.png`);
      fs.writeFileSync(pngPath, orderImageBuffer);
      
      // PDFを生成
      const pdfDoc = await createOrderPDF(orderId, items, customerInfo, orderImageBuffer);
      const pdfBytes = await pdfDoc.save();
      const pdfPath = path.join(outputDir, `${orderId}.pdf`);
      fs.writeFileSync(pdfPath, pdfBytes);
      
      // 詳細JSONを保存（日本語情報を含む）
      const detailPath = path.join(detailDir, `${orderId}.json`);
      fs.writeFileSync(detailPath, JSON.stringify({
        orderId,
        customerInfo: customerInfo || {},
        items: items.map(item => ({
          key: item.key,
          char: item.char,
          bg: item.bg
        })),
        itemCount: items.length,
        generatedAt: new Date().toISOString()
      }, null, 2));
      
      console.log(`  → PDF保存: ${pdfPath}`);
      console.log(`  → 詳細JSON保存: ${detailPath}`);
    }
    
    // サマリー作成
    console.log('\nサマリー作成中...');
    await createSummary(orderGroups, orderInfo, outputDir, detailDir);
    
    console.log('\nすべての処理が完了しました！');
    console.log(`PDF出力先: ${outputDir}/`);
    console.log(`詳細情報: ${detailDir}/`);
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

async function createSummary(orderGroups, orderInfo, outputDir, detailDir) {
  // サマリーJSONの作成
  const summary = {
    generatedAt: new Date().toISOString(),
    totalOrders: Object.keys(orderGroups).length,
    totalItems: Object.values(orderGroups).reduce((sum, items) => sum + items.length, 0),
    orders: Object.entries(orderGroups).map(([orderId, items]) => ({
      orderId,
      customer: orderInfo[orderId]?.customerName || 'N/A',
      itemCount: items.length,
      deliveryDate: orderInfo[orderId]?.deliveryDate || 'N/A'
    }))
  };
  
  fs.writeFileSync(path.join(detailDir, 'SUMMARY.test.json'), JSON.stringify(summary, null, 2));
  
  // サマリーPDFの作成（英語のみ）
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  let y = 792;
  
  page.drawText('Order Summary', {
    x: 50,
    y: y,
    size: 24,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  
  y -= 40;
  
  page.drawText(`Total Orders: ${summary.totalOrders}`, {
    x: 50,
    y: y,
    size: 14,
    font: font,
    color: rgb(0, 0, 0),
  });
  
  y -= 20;
  
  page.drawText(`Total Items: ${summary.totalItems}`, {
    x: 50,
    y: y,
    size: 14,
    font: font,
    color: rgb(0, 0, 0),
  });
  
  y -= 40;
  
  // 各注文の簡易リスト
  page.drawText('Order List:', {
    x: 50,
    y: y,
    size: 16,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  
  y -= 30;
  
  for (const order of summary.orders) {
    page.drawText(`${order.orderId}: ${order.itemCount} items - Delivery: ${order.deliveryDate}`, {
      x: 70,
      y: y,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    y -= 20;
    
    if (y < 50) break; // ページの底に達したら停止
  }
  
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(path.join(outputDir, 'ORDER_SUMMARY.pdf'), pdfBytes);
  console.log('サマリーPDF作成完了');
}

// スクリプトを実行
main();