const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const API_URL = 'https://api.aredl.net/v2/api/aredl/levels';
const THUMB_BASE_URL = 'https://raw.githubusercontent.com/cdc-sys/level-thumbnails/main/thumbs/';
const OUTPUT_DIR = path.join(__dirname, 'thumbnails');
const DESIRED_HEIGHT = 200; 
const SLEEP = 200;

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
  }

(async () => {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
  }

  try {
    const response = await fetch(API_URL);
    const levels = await response.json();

    for (const level of levels) {
      const levelId = level.level_id;
      const outputPath = path.join(OUTPUT_DIR, `${levelId}.png`);

      if (fs.existsSync(outputPath)) {
        console.log(`Thumbnail for level ${levelId} already exists, skipping.`);
        continue;
      }

      const thumbnailUrl = `${THUMB_BASE_URL}/${levelId}.png`;
      console.log(`Processing thumbnail for level ${levelId}...`);

      const imgResponse = await fetch(thumbnailUrl);
      if (!imgResponse.ok) {
        console.error(`Failed to fetch image for level ${levelId}`);
        continue;
      }
      const buffer = await imgResponse.buffer();

      const image = sharp(buffer);
      const metadata = await image.metadata();

      const cropHeight = Math.min(DESIRED_HEIGHT, metadata.height);
      const top = Math.floor((metadata.height - cropHeight) / 2);

      const croppedBuffer = await image
        .extract({
          left: 0,
          top: top,
          width: metadata.width,
          height: cropHeight,
        })
        .toBuffer();

      fs.writeFileSync(outputPath, croppedBuffer);
      console.log(`Saved cropped thumbnail for level ${levelId}`);

	  await sleep(SLEEP);
    }
  } catch (error) {
    console.error('Error updating thumbnails:', error);
    process.exit(1);
  }
})();
