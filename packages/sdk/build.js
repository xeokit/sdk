const { build } = require("esbuild");

const sharedConfig = {
    entryPoints: [
        "./src/index.ts"
    ],
    bundle: true,
    minify: false,
    sourcemap: true
};

build({
    ...sharedConfig,
    platform: 'browser',
    format: 'esm',
    outfile: 'dist/xeokit-sdk.esm.js',
});


