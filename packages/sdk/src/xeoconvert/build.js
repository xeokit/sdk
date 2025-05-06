// Call from ./packages/sdk

const {build} = require("esbuild");
const sharedConfig = {
  entryPoints: [
    "src/xeoconvert/xeoconvert.ts"
  ],
  bundle: true,
  minify: false
};

build({
  ...sharedConfig,
  platform: 'node',
  format: 'cjs',
  target: "node10.4",
  outfile: "src/xeoconvert/dist/xeoconvert.cjs.js"
});
