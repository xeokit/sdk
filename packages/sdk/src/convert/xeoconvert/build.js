// Call from ./packages/sdk

const {build} = require("esbuild");
const sharedConfig = {
  entryPoints: [
    "src/xeoconvert/xeoconvert_core.ts"
  ],
  bundle: true,
  minify: false
};

build({
  ...sharedConfig,
  platform: 'node',
  format: 'cjs',
  target: "node10.4",
  outfile: "src/xeoconvert/xeoconvert_core.cjs.js"
});
