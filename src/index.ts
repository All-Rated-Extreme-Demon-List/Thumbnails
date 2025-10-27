import { processLevelsThumbnails } from './image/levels';
import { processPacksThumbnails } from './image/packs';

async function runThumbnailUpdate() {
    await processLevelsThumbnails();
    await processPacksThumbnails();
    console.log('All thumbnails updated.');
}
runThumbnailUpdate().catch((error) => {
    console.error('Failed to update thumbnails:', error);
    process.exit(1);
});
