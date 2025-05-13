
// This script generates a JSON file that maps directories to their index.html files
// It is used for building application
// It return list of entries for rollup
// {
//   'src/IFCLoader_IfcOpenHouse4': 'src/IFCLoader_IfcOpenHouse4/index.html',
//   'src/DotBIMLoader_BlenderHouse': 'src/DotBIMLoader_BlenderHouse/index.html',
//   'src/aaa/DotBIMLoader_BlenderHouse': 'src/aaa/DotBIMLoader_BlenderHouse/index.html'
// }

import { glob } from 'glob';
import path from 'path'

const SRC_DIR = './src';

// Function to find all HTML files in src directory
export async function getPageEntries() {
  const htmlFiles = await glob(`${SRC_DIR}/**/index.html`);
  const entries = {}
  htmlFiles.forEach(filePath => {
    const dirName = path.dirname(filePath)

    if (!dirName) {
      throw new Error(`Invalid directory name for file: ${filePath}`);
    }

    if (dirName === 'src') {
      return;
    }

    entries[dirName] = filePath;
  });

  return entries

}
