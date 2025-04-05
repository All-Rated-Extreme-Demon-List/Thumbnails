const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { createCanvas, loadImage } = require('canvas');

const LEVELS_API_URL = 'https://api.aredl.net/v2/api/aredl/levels';
const PACKS_API_URL = 'https://api.aredl.net/v2/api/aredl/pack-tiers?v=thumbnails';
const THUMB_BASE_URL = 'https://raw.githubusercontent.com/cdc-sys/level-thumbnails/main/thumbs/';
const LEVELS_FULL_DIR = path.join(__dirname, 'levels', 'full');
const LEVELS_CARDS_DIR = path.join(__dirname, 'levels', 'cards');
const PACKS_DIR = path.join(__dirname, 'packs');
const CARD_HEIGHT = 200; 
const SLEEP_TIME = 200;

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
  }
  async function processLevels() {
    [LEVELS_FULL_DIR, LEVELS_CARDS_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
    
    console.log("Fetching levels...");
    const response = await fetch(LEVELS_API_URL);
    const levels = await response.json();
    
    for (const level of levels) {
      const levelId = level.level_id;
      const fullPath = path.join(LEVELS_FULL_DIR, `${levelId}.png`);
      const cardPath = path.join(LEVELS_CARDS_DIR, `${levelId}.png`);
      
      if (fs.existsSync(fullPath) && fs.existsSync(cardPath)) {
        console.log(`Level ${levelId} already processed, skipping.`);
        continue;
      }
      
      const thumbnailUrl = `${THUMB_BASE_URL}/${levelId}.png`;
      console.log(`Processing level ${levelId}...`);
      
      const imgResponse = await fetch(thumbnailUrl);
      if (!imgResponse.ok) {
        console.error(`Failed to fetch image for level ${levelId}`);
        continue;
      }
      const buffer = await imgResponse.buffer();
      
      if (!fs.existsSync(fullPath)) {
        fs.writeFileSync(fullPath, buffer);
        console.log(`Saved full thumbnail for level ${levelId}`);
      }
      
      if (!fs.existsSync(cardPath)) {
        const image = sharp(buffer);
        const metadata = await image.metadata();
        const cropHeight = Math.min(CARD_HEIGHT, metadata.height);
        const top = Math.floor((metadata.height - cropHeight) / 2);
        const croppedBuffer = await image
          .extract({ left: 0, top: top, width: metadata.width, height: cropHeight })
          .toBuffer();
        fs.writeFileSync(cardPath, croppedBuffer);
        console.log(`Saved card thumbnail for level ${levelId}`);
      }
      
      await sleep(SLEEP_TIME);
    }
  }
  
  async function processPacks() {
    if (!fs.existsSync(PACKS_DIR)) fs.mkdirSync(PACKS_DIR, { recursive: true });
    
    console.log("Fetching packs...");
    const response = await fetch(PACKS_API_URL);
    const pack_tiers = await response.json();

    
    for (const tier of pack_tiers) {
      for (const pack of tier.packs) {
        if (!pack.levels || pack.levels.length === 0) {
          console.log(`Pack ${pack.id} has no levels, skipping.`);
          continue;
        }
        
        const packPath = path.join(PACKS_DIR, `${pack.id}.png`);
        if (fs.existsSync(packPath)) {
          console.log(`Pack ${pack.id} already processed, skipping.`);
          continue;
        }
        
        console.log(`Processing pack ${pack.id}...`);
        pack.levels.sort((a, b) => a.position - b.position);
        
        const canvasWidth = 1920;
        const canvasHeight = 300;
        const rowHeight = canvasHeight;
        const thumbnailWidth = canvasWidth / pack.levels.length;
        
        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');
        
        let fillStyle = tier.color ?? 'transparent';
        if (fillStyle.startsWith('linear-gradient')) {
          const gradientParts = fillStyle.match(/linear-gradient\(([^,]+),\s*(.+)\)/);
          if (gradientParts && gradientParts.length >= 3) {
            const angleStr = gradientParts[1].trim();
            const stopsStr = gradientParts[2].trim();
            let angleInRadians = 0;
            if (angleStr.endsWith('deg')) {
              angleInRadians = (parseFloat(angleStr) * Math.PI) / 180;
            } else {
              angleInRadians = parseFloat(angleStr);
            }
            const x1 = Math.cos(angleInRadians) * canvasWidth;
            const y1 = Math.sin(angleInRadians) * canvasHeight;
            const gradient = ctx.createLinearGradient(0, 0, x1, y1);
            const stops = stopsStr.match(/(rgba?\([^)]+\)|#[a-fA-F0-9]{3,6}|[a-zA-Z]+)\s*(\d+%?)/g);
            if (stops) {
              stops.forEach((stop, index) => {
                const parts = stop.match(/(rgba?\([^)]+\)|#[a-fA-F0-9]{3,6}|[a-zA-Z]+)\s*(\d+)%?/);
                if (parts) {
                  const color = parts[1];
                  const position = parts[2] ? parseFloat(parts[2]) / 100 : index / (stops.length - 1);
                  try {
                    gradient.addColorStop(position, color);
                  } catch (err) {
                    console.warn(`Invalid gradient stop: ${color} at ${position}`);
                  }
                }
              });
              ctx.fillStyle = gradient;
            } else {
              ctx.fillStyle = 'transparent';
            }
          } else {
            ctx.fillStyle = 'transparent';
          }
        } else {
          ctx.fillStyle = fillStyle;
        }
        ctx.fillRect(0, 0, canvasHeight, canvasHeight);
        
        for (let i = 0; i < pack.levels.length; i++) {
          const level = pack.levels[i];
          const thumbnailPath = path.join(LEVELS_FULL_DIR, `${level.level_id}.png`);
          let img;
          try {
            if (fs.existsSync(thumbnailPath)) {
              img = await loadImage(thumbnailPath);
            } else {
              const thumbnailUrl = `${THUMB_BASE_URL}/${level.level_id}.png`;
              img = await loadImage(thumbnailUrl);
            }
          } catch (error) {
            console.warn(`Failed to load thumbnail for level ${level.level_id} in pack ${pack.id}:`, error);
            continue;
          }
          
          const startX = i * thumbnailWidth;
          const endX = startX + thumbnailWidth;
          const startY = 0;
          const endY = rowHeight;
          
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(startX + rowHeight, startY);
          ctx.lineTo(endX + rowHeight, startY);
          ctx.lineTo(endX, endY);
          ctx.lineTo(startX, endY);
          ctx.closePath();
          ctx.clip();
          
          ctx.drawImage(img, startX - rowHeight, -(img.height + rowHeight) / 2, img.width, img.height);
          ctx.restore();
          
          if (i < pack.levels.length - 1) {
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.moveTo(endX + rowHeight, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
          }
        }
        
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(packPath, buffer);
        console.log(`Saved pack thumbnail for pack ${pack.id}`);
        
        await sleep(SLEEP_TIME);
      }
    }
  }
  
  (async () => {
    try {
      await processLevels();
      await processPacks();
      console.log("All thumbnails updated.");
    } catch (error) {
      console.error("Error updating thumbnails:", error);
      process.exit(1);
    }
  })();