
// https://mjtdev.medium.com/how-to-create-a-single-file-bundle-of-a-large-typescript-project-in-2023-5693c8b6b142

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
    outfile: "js/xeokit-studio-bundle.js",
});
