/**
 * Cleanup JPG Cache Script
 * 
 * Removes JPG files that DON'T have "HEIC" in their names.
 * Keeps only files like: IMG_1234.HEIC.jpg
 * Removes files like: IMG_1234.jpg (no HEIC)
 * 
 * Usage:
 *   npx ts-node scripts/cleanup-jpg-cache.ts 2019           (dry-run)
 *   npx ts-node scripts/cleanup-jpg-cache.ts 2019 --delete  (actually delete)
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = path.join(__dirname, '../..');

function main() {
  const args = process.argv.slice(2);
  const yearFolder = args[0];
  const shouldDelete = args.includes('--delete');

  if (!yearFolder) {
    console.log('Usage: npx ts-node scripts/cleanup-jpg-cache.ts <year-folder> [--delete]');
    console.log('Example: npx ts-node scripts/cleanup-jpg-cache.ts 2019 --delete');
    process.exit(1);
  }

  const jpgCacheDir = path.join(ROOT_DIR, yearFolder, 'jpg-cache');

  if (!fs.existsSync(jpgCacheDir)) {
    console.error(`❌ Directory not found: ${jpgCacheDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(jpgCacheDir);
  const toDelete: string[] = [];
  const toKeep: string[] = [];

  for (const file of files) {
    // Check if filename contains "HEIC" (case-insensitive)
    if (file.toUpperCase().includes('HEIC')) {
      toKeep.push(file);
    } else {
      toDelete.push(file);
    }
  }

  console.log(`\n📂 Directory: ${jpgCacheDir}`);
  console.log(`✅ Keep (has HEIC): ${toKeep.length} files`);
  console.log(`🗑️  Delete (no HEIC): ${toDelete.length} files\n`);

  if (toDelete.length === 0) {
    console.log('Nothing to delete!');
    return;
  }

  // Show files to delete
  console.log('Files to delete:');
  toDelete.forEach((f) => console.log(`  - ${f}`));

  if (!shouldDelete) {
    console.log('\n⚠️  DRY RUN - No files deleted');
    console.log('Add --delete flag to actually delete files');
    return;
  }

  // Actually delete files
  console.log('\n🗑️  Deleting files...');
  let deleted = 0;
  for (const file of toDelete) {
    const filePath = path.join(jpgCacheDir, file);
    try {
      fs.unlinkSync(filePath);
      deleted++;
    } catch (err: any) {
      console.error(`  ❌ Failed to delete ${file}: ${err.message}`);
    }
  }

  console.log(`\n✅ Deleted ${deleted}/${toDelete.length} files`);
}

main();
