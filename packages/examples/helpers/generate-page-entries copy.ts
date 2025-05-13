
import fs from 'fs'
import { glob } from 'glob';
import path from 'path'

const SRC_DIR = './src';

// Function to find all HTML files in src directory
export async function getPageEntries(dirname: string) {
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

    const htmlPath = path.resolve(filePath, 'index.html')
    console.log(htmlPath)

    entries[dirName] = htmlPath
  });

  console.log(entries)
  return entries
}
