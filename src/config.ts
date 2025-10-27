import path from 'path';
export const ROOT_DIRECTORY = path.resolve(process.cwd());

export const LEVELS_API_URL = 'https://api.aredl.net/v2/api/aredl/levels';
export const PLAT_LEVELS_API_URL = 'https://api.aredl.net/v2/api/arepl/levels';
export const PACKS_API_URL =
    'https://api.aredl.net/v2/api/aredl/pack-tiers?v=thumbnails';
export const PLAT_PACKS_API_URL =
    'https://api.aredl.net/v2/api/arepl/pack-tiers?v=thumbnails';
export const THUMBNAIL_BASE_URL = 'https://levelthumbs.prevter.me/thumbnail';

export const DIRECTORIES = {
    levels: {
        full: path.join(ROOT_DIRECTORY, 'levels', 'full'),
        cards: path.join(ROOT_DIRECTORY, 'levels', 'cards'),
    },
    og: {
        levels: {
            full: path.join(ROOT_DIRECTORY, 'og', 'levels', 'full'),
            cards: path.join(ROOT_DIRECTORY, 'og', 'levels', 'cards'),
        },
    },
    packs: path.join(ROOT_DIRECTORY, 'packs'),
};

export const CARD_HEIGHT = 200;
export const OG_FULL_SIZE = { width: 1200, height: 630 };
export const OG_CARD_SIZE = { width: 400, height: 48 };
export const CONCURRENT_LIMIT = 5;
export const PACK_DEZOOM = 0.45;
