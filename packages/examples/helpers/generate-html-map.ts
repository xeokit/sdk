import fs from 'fs';
import { glob } from 'glob';
import path from 'path';

// const chokidar = require('chokidar');

const SRC_DIR = './src';
const OUTPUT_FILE = './html-map.json';

export async function generateHtmlMap() {
  try {
    // Find all index.html files recursively in src directory
    const htmlFiles = await glob(`${SRC_DIR}/**/index.html`);

    const map = {};

    htmlFiles.forEach(filePath => {
      const dirName = path.dirname(filePath).split(path.sep).pop();
      const relativePath = path.relative(SRC_DIR, filePath);

      // Use folder name as key, relative path as value
      if (!dirName) {
        throw new Error(`Invalid directory name for file: ${filePath}`);
      }
      map[dirName] = relativePath;

      // If folder name is 'src' (root index.html), give it a special key
      if (dirName === 'src') {
        map['root'] = relativePath;
      }
    });

    // Write the map to JSON file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(map, null, 2));
    console.log(`✅ HTML map generated at ${OUTPUT_FILE}`);
  } catch (err) {
    console.error('❌ Error generating HTML map:', err);
  }
}
