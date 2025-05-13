// This script generates a JSON file that maps directories to their index.html files.
// It is used to create a list of examples for the SDK documentation.
// This script is run by Vite during the build process and when the server starts.
// {
//   'src/IFCLoader_IfcOpenHouse4': 'src/IFCLoader_IfcOpenHouse4/index.html',
//   'src/DotBIMLoader_BlenderHouse': 'src/DotBIMLoader_BlenderHouse/index.html',
//   'src/aaa/DotBIMLoader_BlenderHouse': 'src/aaa/DotBIMLoader_BlenderHouse/index.html'
// }

import fs from 'fs';
import { glob } from 'glob';
import path from 'path';

const SRC_DIR = './src';
const OUTPUT_FILE = './src/html-map.json';

export async function generateHtmlMap() {
  try {
    // Find all index.html files recursively in src directory but not in src itself
    const htmlFiles = await glob(`${SRC_DIR}/**/index.html`);

    const map = {};

    htmlFiles.forEach(filePath => {
      const dirName = path.dirname(filePath)

      if (!dirName) {
        throw new Error(`Invalid directory name for file: ${filePath}`);
      }

      if (dirName === 'src') {
        return;
      }
      map[dirName] = path.join(dirName, "index.html");
    });

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(map, null, 2));
    console.log(`✅ HTML map generated at ${OUTPUT_FILE}`);
  } catch (err) {
    console.error('❌ Error generating HTML map:', err);
  }
}
