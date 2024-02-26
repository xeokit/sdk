
// https://mjtdev.medium.com/how-to-create-a-single-file-bundle-of-a-large-typescript-project-in-2023-5693c8b6b142

const { build } = require("esbuild");
const { dependencies, peerDependencies } = require('../../package.json');

const sharedConfig = {
    entryPoints: [
        "./src/index.ts"
    ],
    bundle: true,
    minify: false,
    sourcemap: true
    // only needed if you have dependencies
    // external: Object.keys(dependencies).concat(Object.keys(peerDependencies)),
};

build({
    ...sharedConfig,
    platform: 'browser',
    format: 'esm',
    outfile: "js/xeokit-demo-bundle.js",
});
