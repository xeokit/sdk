import { defineConfig } from 'vite'

import { generateHtmlMap } from './helpers/generate-html-map'
import { getPageEntries } from './helpers/generate-page-entries'
import { resolve }from 'path';

export default defineConfig({

  resolve: {
    alias: {
      '@xeokit/sdk': resolve(__dirname, '../sdk/src'),
    },
  },

  plugins: [
    {
      name: 'html-map-generator',
      configureServer(server) {
        generateHtmlMap().catch(console.error);

        // Watch for HTML file changes in development
        // server.watcher.add('src/**/*');
        server.watcher.on('all', (path) => {
          // console.log(`File changed: ${path}`);

          generateHtmlMap().catch(console.error);
        });

      },
      buildStart() {
        generateHtmlMap().catch(console.error);
      }
    }
  ],

  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...getPageEntries(__dirname)
      }
    }
  }
})
