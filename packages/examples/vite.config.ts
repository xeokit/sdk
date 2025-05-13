import { defineConfig } from 'vite'

import { generateHtmlMap } from './helpers/generate-html-map'
import { getPageEntries } from './helpers/generate-page-entries'
import path from 'path';

import { viteSingleFile } from "vite-plugin-singlefile"



export default defineConfig({

  resolve: {
    alias: {
      '@xeokit/sdk': path.resolve(__dirname, '../sdk/src'),
    },
  },

  plugins: [
    viteSingleFile(
      { useRecommendedBuildConfig: false }
    ),
    {
      name: 'html-map-generator',
      configureServer(server) {
        // Run script when dev server starts
        generateHtmlMap().catch(console.error);

        // Watch for HTML file changes in development
        // server.watcher.add('src/**/*');
        server.watcher.on('all', (path) => {
          // console.log(`File changed: ${path}`);

          generateHtmlMap().catch(console.error);
        });

      },
      buildStart() {
        // Run script at build start
        generateHtmlMap().catch(console.error);
      }
    }
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
      input: getPageEntries(__dirname),
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      }
    }
  }
})
