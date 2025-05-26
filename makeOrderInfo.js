const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

// 設定
const THUMBNAIL_SIZE = 100; // サムネイルサイズ（px）
const CARDS_PER_ROW = 5;   // 1行あたりのカード数
const CARD_SPACING = 10;    // カード間のスペース

async function loadOrderData() {
  const imagesData = JSON.parse(fs.readFileSync('images.json', 'utf8'));
  const orderInfo = JSON.parse(fs.readFileSync('orderInfo.json', 'utf8'));
  
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

async function createOrderPDF(orderId, items, customerInfo) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4サイズ
  const { width, height } = page.getSize();
  
  // フォントの読み込み（日本語は使用しない）
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  let yPosition = height - 50;
  
  // タイトル
  page.drawText('Order Information', {
    x: 50,
    y: yPosition,
    size: 20,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  
  yPosition -= 40;
  
  // 注文情報（日本語を避けて英語表記またはローマ字を使用）
  const info = customerInfo || {};
  const infoLines = [
    `Order ID: ${orderId}`,
    `Customer: ${info.customerName ? `[Customer ${orderId.split('-')[1]}]` : 'N/A'}`,
    `Address: ${info.address ? `[Address registered]` : 'N/A'}`,
    `Phone: ${info.phoneNumber || 'N/A'}`,
    `Email: ${info.email || 'N/A'}`,
    `Order Date: ${info.orderDate || 'N/A'}`,
    `Delivery Date: ${info.deliveryDate || 'N/A'}`,
    '',
    `Total Items: ${items.length}`,
  ];
  
  for (const line of infoLines) {
    page.drawText(line, {
      x: 50,
      y: yPosition,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;
  }
  
  yPosition -= 20;
  
  // アイテムセクションのタイトル
  page.drawText('Order Items:', {
    x: 50,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  
  yPosition -= 30;
  
  // アイテムの画像とキー
  let xPosition = 50;
  let itemCount = 0;
  
  for (const item of items) {
    // 新しい行が必要な場合
    if (itemCount > 0 && itemCount % CARDS_PER_ROW === 0) {
      xPosition = 50;
      yPosition -= THUMBNAIL_SIZE + 30;
      
      // ページが足りない場合は新しいページを追加
      if (yPosition < 100) {
        const newPage = pdfDoc.addPage([595, 842]);
        yPosition = height - 50;
        // 新しいページでの描画はここで行う必要があります
        // 簡略化のため、今回は1ページに収まると仮定
      }
    }
    
    // サムネイル画像を作成
    const thumbnailBuffer = await createThumbnail(item.char);
    const thumbnailImage = await pdfDoc.embedPng(thumbnailBuffer);
    
    // 画像を描画
    page.drawImage(thumbnailImage, {
      x: xPosition,
      y: yPosition - THUMBNAIL_SIZE,
      width: THUMBNAIL_SIZE,
      height: THUMBNAIL_SIZE,
    });
    
    // キーを描画
    page.drawText(item.key, {
      x: xPosition + THUMBNAIL_SIZE / 2 - 20,
      y: yPosition - THUMBNAIL_SIZE - 15,
      size: 10,
      font: font,
      color: rgb(0, 0, 0),
    });
    
    xPosition += THUMBNAIL_SIZE + CARD_SPACING;
    itemCount++;
  }
  
  return pdfDoc;
}

async function main() {
  try {
    console.log('発注情報PDF生成を開始します...');
    
    // データの読み込み
    const { orderGroups, orderInfo } = await loadOrderData();
    
    // 出力ディレクトリの作成
    const outputDir = 'order_pdfs';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 各注文のPDFを生成
    for (const [orderId, items] of Object.entries(orderGroups)) {
      console.log(`処理中: ${orderId} (${items.length}アイテム)`);
      
      const customerInfo = orderInfo[orderId];
      const pdfDoc = await createOrderPDF(orderId, items, customerInfo);
      
      // PDFを保存
      const pdfBytes = await pdfDoc.save();
      const outputPath = path.join(outputDir, `${orderId}.pdf`);
      fs.writeFileSync(outputPath, pdfBytes);
      
      console.log(`  → 保存完了: ${outputPath}`);
    }
    
    // サマリーPDFの生成（全注文の概要）
    console.log('\nサマリーPDF生成中...');
    await createSummaryPDF(orderGroups, orderInfo, outputDir);
    
    console.log('\nすべての発注情報PDFの生成が完了しました！');
    console.log(`出力先: ${outputDir}/`);
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

async function createSummaryPDF(orderGroups, orderInfo, outputDir) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4サイズ
  const { width, height } = page.getSize();
  
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  let yPosition = height - 50;
  
  // タイトル
  page.drawText('Order Summary', {
    x: 50,
    y: yPosition,
    size: 24,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  
  yPosition -= 40;
  
  // 日付
  const today = new Date().toISOString().split('T')[0];
  page.drawText(`Generated: ${today}`, {
    x: 50,
    y: yPosition,
    size: 12,
    font: font,
    color: rgb(0.5, 0.5, 0.5),
  });
  
  yPosition -= 40;
  
  // 注文リスト
  page.drawText('Order List:', {
    x: 50,
    y: yPosition,
    size: 16,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  
  yPosition -= 30;
  
  // ヘッダー
  const headers = ['Order ID', 'Customer', 'Items', 'Delivery Date'];
  const columnWidths = [100, 200, 60, 100];
  let xPos = 50;
  
  for (let i = 0; i < headers.length; i++) {
    page.drawText(headers[i], {
      x: xPos,
      y: yPosition,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    xPos += columnWidths[i];
  }
  
  yPosition -= 20;
  
  // 各注文の情報
  for (const [orderId, items] of Object.entries(orderGroups)) {
    const info = orderInfo[orderId] || {};
    xPos = 50;
    
    const rowData = [
      orderId,
      info.customerName ? `Customer ${orderId.split('-')[1]}` : 'N/A',
      items.length.toString(),
      info.deliveryDate || 'N/A'
    ];
    
    for (let i = 0; i < rowData.length; i++) {
      page.drawText(rowData[i], {
        x: xPos,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0, 0, 0),
      });
      xPos += columnWidths[i];
    }
    
    yPosition -= 18;
    
    // ページが足りない場合の処理（簡略化）
    if (yPosition < 50) {
      break;
    }
  }
  
  // PDFを保存
  const pdfBytes = await pdfDoc.save();
  const outputPath = path.join(outputDir, 'ORDER_SUMMARY.pdf');
  fs.writeFileSync(outputPath, pdfBytes);
  console.log(`サマリーPDF保存完了: ${outputPath}`);
}

// スクリプトを実行
main();