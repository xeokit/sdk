import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path';
import { resolve } from 'path'
import { viteSingleFile } from "vite-plugin-singlefile"

// Function to find all HTML files in src directory
function getPageEntries() {
  const pagesDir = resolve(__dirname, 'src')
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

export default defineConfig({

  resolve: {
    alias: {
      '@xeokit/sdk': path.resolve(__dirname, '../sdk/src'),
    },
  },

  plugins: [
    viteSingleFile(
      { useRecommendedBuildConfig: false }
    )
  ],

  // Configure esbuild options for JS/TS
  esbuild: {
    minifyWhitespace: false, // Preserve whitespace

    legalComments: 'inline', // Preserve all comments
  },

  build: {
    target: 'esnext',
    minify: false,
    modulePreload: false,

    cssMinify: false,

    rollupOptions: {
      input: getPageEntries(),
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      }
    }
  }
})
