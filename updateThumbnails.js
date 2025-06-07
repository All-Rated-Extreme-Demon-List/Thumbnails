(async () => {
  const fs     = require('fs');
  const path   = require('path');
  const sharp  = require('sharp');
  const { createCanvas, loadImage } = require('canvas');
  const { default: pLimit } = await import('p-limit');

  const LEVELS_API_URL = 'https://api.aredl.net/v2/api/aredl/levels';
  const PLAT_LEVELS_API_URL = 'https://api.aredl.net/v2/api/arepl/levels';
  const PACKS_API_URL = 'https://api.aredl.net/v2/api/aredl/pack-tiers?v=thumbnails';
  const PLAT_PACKS_API_URL = 'https://api.aredl.net/v2/api/arepl/pack-tiers?v=thumbnails';
  const THUMB_BASE_URL = 'https://tjcsucht.net/levelthumbs/';
  const LEVELS_FULL_DIR = path.join(__dirname, 'levels', 'full');
  const LEVELS_CARDS_DIR = path.join(__dirname, 'levels', 'cards');
  const PACKS_DIR = path.join(__dirname, 'packs');
  const CARD_HEIGHT = 200; 
  const CONCURRENT_LIMIT = 5; 
  const PACK_DEZOOM = 0.45;


  async function processLevels() {
    [LEVELS_FULL_DIR, LEVELS_CARDS_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    console.log("Fetching levels...");
    const [respLevels, respPlatLevels] = await Promise.all([
      fetch(LEVELS_API_URL),
      fetch(PLAT_LEVELS_API_URL)
    ]);
    const levels = (await respLevels.json()).concat(await respPlatLevels.json());
    const total = levels.length;
    let processed = 0;
    const limit = pLimit(CONCURRENT_LIMIT);
    const jobs = levels.map(level => limit(async () => {
      const levelId = level.level_id;
      const fullPath = path.join(LEVELS_FULL_DIR, `${levelId}.webp`);
      const cardPath = path.join(LEVELS_CARDS_DIR, `${levelId}.webp`);

      if (fs.existsSync(fullPath) && fs.existsSync(cardPath)) {
        console.log(`Level ${levelId} skipped`);
        processed++;
        return;
      }

      const thumbUrl = `${THUMB_BASE_URL}/${levelId}.png`;

      
      try {
        const fetchResp = await fetch(thumbUrl);
        if (!fetchResp.ok) {
          if (fetchResp.status === 404) console.warn(`Remote thumbnail not found for level ${levelId}, skipping.`);
          else console.warn(`Failed to fetch remote thumbnail for level ${levelId}, status ${fetchResp.status}`);
          
          processed++;
          return;
        } 
      } catch (error) {
        console.warn(`Error fetching remote thumbnail for level ${levelId}:`, error);
        processed++;
        return;
      }
        buffer = Buffer.from(await fetchResp.arrayBuffer());

      if (!fs.existsSync(fullPath)) {
        const webp = await sharp(buffer).webp({ quality: 50 }).toBuffer();
        fs.writeFileSync(fullPath, webp);
      }

      if (!fs.existsSync(cardPath)) {
        const meta = await sharp(buffer).metadata();
        const cropH = Math.min(CARD_HEIGHT, meta.height);
        const top   = Math.floor((meta.height - cropH) / 2);
        const crop = await sharp(buffer)
          .extract({ left: 0, top, width: meta.width, height: cropH })
          .webp({ quality: 70 })
          .toBuffer();
        fs.writeFileSync(cardPath, crop);
      }

      processed++;
      console.log(`Processed levels: ${processed}/${total}`);

    }));

    await Promise.all(jobs);
  }
    
    async function processPacks() {
      if (fs.existsSync(PACKS_DIR)) {
        fs.readdirSync(PACKS_DIR).forEach(file => {
          const filePath = path.join(PACKS_DIR, file);
          if (fs.lstatSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
          }
        });
      } else {
        fs.mkdirSync(PACKS_DIR, { recursive: true });
      }

      
      console.log("Fetching packs...");
      const [respPacks, respPlatPacks] = await Promise.all([
        fetch(PACKS_API_URL),
        fetch(PLAT_PACKS_API_URL)
      ]);
      const pack_tiers = (await respPacks.json()).concat(await respPlatPacks.json());

      const allPacks = [];
      pack_tiers.forEach(tier => {
        tier.packs.forEach(pack => {
          if (pack.levels && pack.levels.length) {
            allPacks.push({ tier, pack });
          }
        });
      });
      
      const total = allPacks.length;
      let processed = 0;
      const limit = pLimit(CONCURRENT_LIMIT);
      const jobs = allPacks.map(({ tier, pack }) => limit(async () => {
          if (!pack.levels || pack.levels.length === 0) {
            console.log(`Pack ${pack.id} has no levels, skipping.`);
            processed++;
            return;
          }
          
          const packPath = path.join(PACKS_DIR, `${pack.id}.webp`);
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
            const thumbnailPath = path.join(LEVELS_FULL_DIR, `${level.level_id}.webp`);
            let img;
            try {
                const webpBuffer = fs.readFileSync(thumbnailPath);
                const pngBuffer = await sharp(webpBuffer).png().toBuffer();
                img = await loadImage(pngBuffer);
            } catch (err) {
                console.warn(`Failed to load local thumbnail for level ${level.level_id} in pack ${pack.id}:`, err);
                try {
                    const thumbnailUrl = `${THUMB_BASE_URL}/${level.level_id}.png`;
                    console.warn(`Attempting to load from remote: ${thumbnailUrl}`);
                    img = await loadImage(thumbnailUrl);
                } catch (error) {
                    console.warn(`Failed to load thumbnail for level ${level.level_id} in pack ${pack.id}:`, error);
                    continue;
                }
            }
            const destXstart = i * thumbnailWidth;
            const destXend = destXstart + thumbnailWidth;
            const destYstart = 0;
            const destYend = rowHeight;

            const destWidth = thumbnailWidth + rowHeight;
            const destHeight = destWidth * (img.height / img.width);

            const srcWidth = destWidth / PACK_DEZOOM;
            const srcHeight = destHeight / PACK_DEZOOM;

            const srcXstart = (img.width - srcWidth) / 2;  
            const srcYstart = (img.height - srcHeight) / 2;
            
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(destXstart + rowHeight, destYstart);
            ctx.lineTo(destXend + rowHeight, destYstart);
            ctx.lineTo(destXend, destYend);
            ctx.lineTo(destXstart, destYend);
            ctx.closePath();
            ctx.clip();
            
            ctx.drawImage(img, srcXstart, srcYstart, srcWidth, srcHeight, destXstart, destYstart, destWidth, destHeight);
            ctx.restore();
            
            if (i < pack.levels.length - 1) {
              ctx.strokeStyle = 'white';
              ctx.lineWidth = 10;
              ctx.beginPath();
              ctx.moveTo(destXend + rowHeight, destYstart);
              ctx.lineTo(destXend, destYend);
              ctx.stroke();
            }
          }
          
          const fullBuffer = canvas.toBuffer('image/png');
          const cropTop = (canvasHeight - CARD_HEIGHT) / 2;

          const croppedBuffer = await sharp(fullBuffer)
            .extract({ left: 0, top: cropTop, width: canvasWidth, height: CARD_HEIGHT })
            .webp({ quality: 70 })
            .toBuffer();

          fs.writeFileSync(packPath, croppedBuffer);
          
          processed++;
          console.log(`Processed packs: ${processed}/${total}`);

        }));
        
        await Promise.all(jobs);
      
    }
    
  try {
    await processLevels();
    await processPacks();
    console.log("All thumbnails updated.");
  } catch (error) {
    console.error("Error updating thumbnails:", error);
    process.exit(1);
  }

})();