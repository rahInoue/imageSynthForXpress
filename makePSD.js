const fs = require('fs');
const path = require('path');
const { writePsd, initializeCanvas } = require('ag-psd');
const { createCanvas, loadImage } = require('canvas');

// Initialize ag-psd with canvas
initializeCanvas(createCanvas);

// Define the layer order (from bottom to top)
const LAYER_NAMES = [
  'sheet_labels.png',
  'sheet_cutline.png',
  'sheet_glare.png',
  'sheet_logos.png',      // ロゴレイヤーを追加（characterの上）
  'sheet_character.png',
  'sheet_char_knock.png',
  'sheet_bg_knock.png',
  'sheet_background.png',
];

async function createPsd(pageNo) {
  try {
    const inputDir = path.join(__dirname, 'output', pageNo.toString());
    const outputDir = path.join(__dirname, 'psd_output');
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputFile = path.join(outputDir, `${pageNo}.psd`);
    
    // Check if directory exists
    if (!fs.existsSync(inputDir)) {
      console.error(`Directory not found: ${inputDir}`);
      return;
    }
    
    // Load all images
    console.log(`Processing page ${pageNo}...`);
    const layers = [];
    
    // Create layers in reverse order (bottom to top in PSD)
    for (const layerName of LAYER_NAMES) {
      const imagePath = path.join(inputDir, layerName);
      
      if (fs.existsSync(imagePath)) {
        console.log(`Loading ${layerName}...`);
        const image = await loadImage(imagePath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        
        // Add to layers array
        layers.unshift({
          name: layerName.replace('.png', ''),
          canvas: canvas
        });
      } else {
        console.warn(`Warning: Layer image not found: ${imagePath}`);
      }
    }
    
    if (layers.length === 0) {
      console.error('No valid layers found. PSD creation aborted.');
      return;
    }
    
    // Create PSD data
    const width = layers[0].canvas.width;
    const height = layers[0].canvas.height;
    
    const psd = {
      width,
      height,
      children: layers.map(layer => ({
        name: layer.name,
        canvas: layer.canvas
      }))
    };
    
    // Write PSD file
    console.log(`Writing PSD to ${outputFile}...`);
    const psdBuffer = writePsd(psd, { generateThumbnail: true });
    fs.writeFileSync(outputFile, Buffer.from(psdBuffer));
    
    console.log(`Successfully created ${outputFile}`);
  } catch (error) {
    console.error(`Error creating PSD for page ${pageNo}:`, error);
  }
}

async function main() {
  try {
    // Get all subdirectories in the output folder
    const outputDir = path.join(__dirname, 'output');
    const pageNos = fs.readdirSync(outputDir)
      .filter(file => {
        const stat = fs.statSync(path.join(outputDir, file));
        return stat.isDirectory() && /^\d+$/.test(file);
      })
      .map(dir => parseInt(dir, 10))
      .sort((a, b) => a - b);
    
    if (pageNos.length === 0) {
      console.log('No page directories found in the output folder.');
      return;
    }
    
    console.log(`Found page directories: ${pageNos.join(', ')}`);
    
    // Process each page
    for (const pageNo of pageNos) {
      await createPsd(pageNo);
    }
    
    console.log('All PSD files have been created successfully!');
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

// Run the script
main();