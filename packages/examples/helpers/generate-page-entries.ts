
import fs from 'fs'
import { resolve } from 'path'

// Function to find all HTML files in src directory
export function getPageEntries(dirname) {
  const pagesDir = resolve(dirname, 'src')
  const entries = {}
  // Find all HTML files in src and its subdirectories
  fs.readdirSync(pagesDir).forEach(dir => {
    const dirPath = resolve(pagesDir, dir)
    if (fs.statSync(dirPath).isDirectory()) {
      const htmlPath = resolve(dirPath, 'index.html')
      if (fs.existsSync(htmlPath)) {
        entries[dir] = htmlPath
      }
    }
  })
  return entries
}
