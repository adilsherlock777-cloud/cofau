/**
 * Script to optimize PNG badge images for Android compatibility
 * This ensures the PNG files are in a format that AAPT can compile
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available, if not, provide instructions
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('❌ Error: sharp package is required to optimize images.');
  console.log('\n📦 Please install it by running:');
  console.log('   npm install --save-dev sharp');
  console.log('   or');
  console.log('   yarn add -D sharp');
  process.exit(1);
}

const badgesDir = path.join(__dirname, '../assets/badges');
const badgeFiles = [
  'reviewer.png',
  'influencer.png',
  'top_reviewer.png'
];

async function optimizeBadge(fileName) {
  const inputPath = path.join(badgesDir, fileName);
  const outputPath = path.join(badgesDir, fileName + '.tmp');

  if (!fs.existsSync(inputPath)) {
    console.warn(`⚠️  File not found: ${fileName}`);
    return false;
  }

  try {
    console.log(`🔄 Optimizing ${fileName}...`);
    
    // Read and optimize the image
    // Convert to 8-bit RGBA format which is Android-compatible
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    // Ensure the image is in a compatible format
    let pipeline = image.ensureAlpha();
    
    // If the image has more than 256 colors or is 16-bit, convert it
    if (metadata.depth === 16 || metadata.channels > 4) {
      pipeline = pipeline.png({
        compressionLevel: 9,
        quality: 100,
        palette: false, // Use true color RGBA
        colors: 256,
        dither: 0.5
      });
    } else {
      // Re-encode to ensure compatibility
      pipeline = pipeline.png({
        compressionLevel: 9,
        quality: 100,
        palette: false
      });
    }
    
    await pipeline.toFile(outputPath);

    // Replace original with optimized version
    fs.unlinkSync(inputPath);
    fs.renameSync(outputPath, inputPath);
    
    console.log(`✅ Optimized ${fileName}`);
    return true;
  } catch (error) {
    console.error(`❌ Error optimizing ${fileName}:`, error.message);
    // Clean up temp file if it exists
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    return false;
  }
}

async function main() {
  console.log('🚀 Starting badge optimization...\n');
  
  let successCount = 0;
  for (const file of badgeFiles) {
    const success = await optimizeBadge(file);
    if (success) successCount++;
  }

  console.log(`\n✨ Optimization complete! ${successCount}/${badgeFiles.length} files optimized.`);
  
  if (successCount === badgeFiles.length) {
    console.log('✅ All badge files are now Android-compatible!');
    process.exit(0);
  } else {
    console.log('⚠️  Some files could not be optimized. Please check the errors above.');
    process.exit(1);
  }
}

main();

