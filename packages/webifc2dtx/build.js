// https://mjtdev.medium.com/how-to-create-a-single-file-bundle-of-a-large-typescript-project-in-2023-5693c8b6b142

const {build} = require("esbuild");
const {peerDependencies} = require('./package.json');

const sharedConfig = {
    entryPoints: [
        "./src/webifc2dtx.ts"
    ],
    bundle: true,
    minify: false,
    external: Object.keys(peerDependencies),
};

build({
    ...sharedConfig,
    platform: 'node',
    format: 'cjs',
    target: "node10.4",
    outfile: "dist/webifc2dtx.cjs.js",
});
