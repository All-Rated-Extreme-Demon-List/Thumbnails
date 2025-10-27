import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { createCanvas, loadImage } from 'canvas';
import pLimit from 'p-limit';
import {
    PACKS_API_URL,
    PLAT_PACKS_API_URL,
    THUMBNAIL_BASE_URL,
    DIRECTORIES,
    CARD_HEIGHT,
    CONCURRENT_LIMIT,
    PACK_DEZOOM,
} from '../config';
import { fetchJson } from '../utils/fetch';
import { createCanvasGradientFromCssString } from '../utils/gradient';
import { PackTier } from '../types/packs';

async function processPacksThumbnails() {
    // clear existing pack thumbnails
    if (!fs.existsSync(DIRECTORIES.packs)) {
        fs.mkdirSync(DIRECTORIES.packs, { recursive: true });
        return;
    }
    fs.readdirSync(DIRECTORIES.packs).forEach((fileName) => {
        const filePath = path.join(DIRECTORIES.packs, fileName);
        if (fs.lstatSync(filePath).isFile()) fs.unlinkSync(filePath);
    });

    console.log('Fetching packs...');
    const [aredlPackTiers, areplPackTiers] = await Promise.all([
        fetchJson<PackTier[]>(PACKS_API_URL),
        fetchJson<PackTier[]>(PLAT_PACKS_API_URL),
    ]);
    const packTiers = aredlPackTiers.concat(areplPackTiers);

    const packsWithLevels = packTiers.flatMap((tier) =>
        (tier.packs ?? [])
            .filter((pack) => pack.levels.length > 0)
            .map((pack) => ({ tier, pack })),
    );

    const totalPacks = packsWithLevels.length;
    let processedCount = 0;
    const limit = pLimit(CONCURRENT_LIMIT);

    // process packs
    const tasks = packsWithLevels.map(({ tier, pack }) =>
        limit(async () => {
            if (!pack.levels || pack.levels.length === 0) {
                console.log(`Pack ${pack.id} has no levels, skipping.`);
                processedCount++;
                return;
            }

            const packOutputPath = path.join(
                DIRECTORIES.packs,
                `${pack.id}.webp`,
            );
            pack.levels.sort((a, b) => a.position - b.position);

            const canvasWidth = 1920;
            const canvasHeight = 300;
            const rowHeight = canvasHeight;
            const thumbnailWidth = canvasWidth / pack.levels.length;

            const canvas = createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext('2d');
            // background fill (solid or gradient)
            const fillStyleText = tier.color ?? 'transparent';
            if (
                typeof fillStyleText === 'string' &&
                fillStyleText.startsWith('linear-gradient')
            ) {
                const gradient = createCanvasGradientFromCssString(
                    ctx,
                    canvasWidth,
                    canvasHeight,
                    fillStyleText,
                );
                ctx.fillStyle = gradient ?? 'transparent';
            } else {
                ctx.fillStyle = fillStyleText;
            }
            ctx.fillRect(0, 0, canvasHeight, canvasHeight);

            for (let i = 0; i < pack.levels.length; i++) {
                const level = pack.levels[i];
                const localFullPath = path.join(
                    DIRECTORIES.levels.full,
                    `${level.level_id}.webp`,
                );

                let image;
                try {
                    const webpBuffer = fs.readFileSync(localFullPath);
                    const pngBuffer = await sharp(webpBuffer).png().toBuffer();
                    image = await loadImage(pngBuffer);
                } catch (readError) {
                    console.warn(
                        `Failed to load local thumbnail for level ${level.level_id} in pack ${pack.id}:`,
                        readError,
                    );
                    // Fallback to remote PNG
                    try {
                        const remotePngUrl = `${THUMBNAIL_BASE_URL}/${level.level_id}.png`;
                        console.warn(
                            `Attempting to load from remote: ${remotePngUrl}`,
                        );
                        image = await loadImage(remotePngUrl);
                    } catch (remoteError) {
                        console.warn(
                            `Failed to load thumbnail for level ${level.level_id} in pack ${pack.id}:`,
                            remoteError,
                        );
                        continue;
                    }
                }

                const destinationXStart = i * thumbnailWidth;
                const destinationXEnd = destinationXStart + thumbnailWidth;
                const destinationYStart = 0;
                const destinationYEnd = rowHeight;

                const destinationWidth = thumbnailWidth + rowHeight;
                const destinationHeight =
                    destinationWidth * (image.height / image.width);

                const sourceWidth = destinationWidth / PACK_DEZOOM;
                const sourceHeight = destinationHeight / PACK_DEZOOM;

                const sourceXStart = (image.width - sourceWidth) / 2;
                const sourceYStart = (image.height - sourceHeight) / 2;

                // Clip to the trapezoid slice
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(destinationXStart + rowHeight, destinationYStart);
                ctx.lineTo(destinationXEnd + rowHeight, destinationYStart);
                ctx.lineTo(destinationXEnd, destinationYEnd);
                ctx.lineTo(destinationXStart, destinationYEnd);
                ctx.closePath();
                ctx.clip();

                // Draw the image
                ctx.drawImage(
                    image,
                    sourceXStart,
                    sourceYStart,
                    sourceWidth,
                    sourceHeight,
                    destinationXStart,
                    destinationYStart,
                    destinationWidth,
                    destinationHeight,
                );
                ctx.restore();

                // Divider between slices
                if (i < pack.levels.length - 1) {
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 10;
                    ctx.beginPath();
                    ctx.moveTo(destinationXEnd + rowHeight, destinationYStart);
                    ctx.lineTo(destinationXEnd, destinationYEnd);
                    ctx.stroke();
                }
            }

            // Crop vertically to card height and save
            const fullCanvasBuffer = canvas.toBuffer('image/png');
            const cropTop = (canvasHeight - CARD_HEIGHT) / 2;

            const croppedBuffer = await sharp(fullCanvasBuffer)
                .extract({
                    left: 0,
                    top: cropTop,
                    width: canvasWidth,
                    height: CARD_HEIGHT,
                })
                .webp({ quality: 70 })
                .toBuffer();

            fs.writeFileSync(packOutputPath, croppedBuffer);

            processedCount++;
            console.log(`Processed packs: ${processedCount}/${totalPacks}`);
        }),
    );

    await Promise.all(tasks);
}

export { processPacksThumbnails };
