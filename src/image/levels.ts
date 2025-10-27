import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import pLimit from 'p-limit';
import {
    LEVELS_API_URL,
    PLAT_LEVELS_API_URL,
    THUMBNAIL_BASE_URL,
    DIRECTORIES,
    CARD_HEIGHT,
    OG_FULL_SIZE,
    OG_CARD_SIZE,
    CONCURRENT_LIMIT,
} from '../config';
import { fetchJson, fetchBuffer, FetchError } from '../utils/fetch';
import { BaseLevel } from '../types/levels';

async function processLevelsThumbnails() {
    [
        DIRECTORIES.levels.full,
        DIRECTORIES.levels.cards,
        DIRECTORIES.og.levels.full,
        DIRECTORIES.og.levels.cards,
    ].forEach((directory) => {
        if (!fs.existsSync(directory))
            fs.mkdirSync(directory, { recursive: true });
    });

    console.log('Fetching levels...');
    const [levelsAredl, levelsArepl] = await Promise.all([
        fetchJson<BaseLevel[]>(LEVELS_API_URL),
        fetchJson<BaseLevel[]>(PLAT_LEVELS_API_URL),
    ]);
    const levels = levelsAredl.concat(levelsArepl);

    const totalLevels = levels.length;
    let processedCount = 0;
    const limit = pLimit(CONCURRENT_LIMIT);

    const tasks = levels.map((level) =>
        limit(async () => {
            const levelId = level.level_id;
            const fullOutputPath = path.join(
                DIRECTORIES.levels.full,
                `${levelId}.webp`,
            );
            const cardOutputPath = path.join(
                DIRECTORIES.levels.cards,
                `${levelId}.webp`,
            );
            const ogFullOutputPath = path.join(
                DIRECTORIES.og.levels.full,
                `${levelId}.webp`,
            );
            const ogCardOutputPath = path.join(
                DIRECTORIES.og.levels.cards,
                `${levelId}.webp`,
            );

            // all thumbnails exist, skip
            if (
                fs.existsSync(fullOutputPath) &&
                fs.existsSync(cardOutputPath) &&
                fs.existsSync(ogFullOutputPath) &&
                fs.existsSync(ogCardOutputPath)
            ) {
                console.log(`Level ${levelId} skipped`);
                processedCount++;
                return;
            }

            // use local full image if exists
            let sourceImageBuffer;
            if (fs.existsSync(fullOutputPath)) {
                try {
                    sourceImageBuffer = fs.readFileSync(fullOutputPath);
                } catch (readError) {
                    console.warn(
                        `Failed to read existing full image for level ${levelId}, falling back to remote fetch:`,
                        readError,
                    );
                }
            }

            // otherwise fetch remote thumbnail from the geode mod
            if (!sourceImageBuffer) {
                const remoteThumbnailUrl = `${THUMBNAIL_BASE_URL}/${levelId}/high`;
                try {
                    sourceImageBuffer = await fetchBuffer(remoteThumbnailUrl);
                } catch (error) {
                    if (error instanceof FetchError && error.status === 404)
                        console.warn(
                            `Remote thumbnail not found for level ${levelId}, skipping.`,
                        );
                    else
                        console.warn(
                            `Failed to fetch remote thumbnail for level ${levelId}:`,
                            error,
                        );
                    processedCount++;
                    return;
                }

                // save to full file
                const webpFull = await sharp(sourceImageBuffer)
                    .webp({ quality: 50 })
                    .toBuffer();
                fs.writeFileSync(fullOutputPath, webpFull);
                try {
                    sourceImageBuffer = fs.readFileSync(fullOutputPath);
                } catch {}
            }

            // create card version (center-cropped to CARD_HEIGHT)
            if (!fs.existsSync(cardOutputPath)) {
                const metadata = await sharp(sourceImageBuffer).metadata();
                const cropHeight = Math.min(CARD_HEIGHT, metadata.height);
                const top = Math.floor((metadata.height - cropHeight) / 2);
                const cardBuffer = await sharp(sourceImageBuffer)
                    .extract({
                        left: 0,
                        top,
                        width: metadata.width,
                        height: cropHeight,
                    })
                    .webp({ quality: 70 })
                    .toBuffer();
                fs.writeFileSync(cardOutputPath, cardBuffer);
            }

            // create open graph versions
            if (!fs.existsSync(ogFullOutputPath)) {
                const ogFullBuffer = await sharp(sourceImageBuffer)
                    .resize(OG_FULL_SIZE.width, OG_FULL_SIZE.height, {
                        fit: 'cover',
                        position: 'centre',
                    })
                    .webp({ quality: 70 })
                    .toBuffer();
                fs.writeFileSync(ogFullOutputPath, ogFullBuffer);
            }

            if (!fs.existsSync(ogCardOutputPath)) {
                const ogCardBuffer = await sharp(sourceImageBuffer)
                    .resize(OG_CARD_SIZE.width, OG_CARD_SIZE.height, {
                        fit: 'cover',
                        position: 'centre',
                    })
                    .webp({ quality: 70 })
                    .toBuffer();
                fs.writeFileSync(ogCardOutputPath, ogCardBuffer);
            }

            processedCount++;
            console.log(`Processed levels: ${processedCount}/${totalLevels}`);
        }),
    );

    await Promise.all(tasks);
}

export { processLevelsThumbnails };
