
// https://mjtdev.medium.com/how-to-create-a-single-file-bundle-of-a-large-typescript-project-in-2023-5693c8b6b142

const fs = require("fs");
const path = require("path");
const { build } = require("esbuild");

const websiteRoot = path.resolve(__dirname, "..", "..");
const sdkSrcRoot = path.resolve(websiteRoot, "..", "sdk", "src");
const libsRoot = path.join(websiteRoot, "libs");
const websiteLibAliases = {
    "@xeokit/website-authoring": path.join(libsRoot, "authoring", "src"),
    "@xeokit/website-examples": path.join(libsRoot, "examples", "src"),
    "@xeokit/website-presentations": path.join(libsRoot, "presentations", "src"),
    "@xeokit/website-studio": path.join(libsRoot, "studio", "src"),
    "@xeokit/website-ui": path.join(libsRoot, "ui", "src")
};

const sdkSourceAliasPlugin = {
    name: "sdk-source-alias",
    setup(build) {
        build.onResolve({filter: /^@xeokit\/sdk(?:\/.*)?$/}, (args) => {
            const subpath = args.path === "@xeokit/sdk"
                ? "index"
                : args.path.slice("@xeokit/sdk/".length);
            return {path: resolveTypeScriptSourcePath(path.join(sdkSrcRoot, subpath))};
        });
    }
};

const websiteLibAliasPlugin = {
    name: "website-lib-alias",
    setup(build) {
        build.onResolve({filter: /^@xeokit\/website-(?:authoring|examples|presentations|studio|ui)(?:\/.*)?$/}, (args) => {
            const alias = Object.keys(websiteLibAliases).find((candidate) =>
                args.path === candidate || args.path.startsWith(`${candidate}/`));
            if (!alias) {
                return undefined;
            }
            const subpath = args.path === alias ? "index" : args.path.slice(alias.length + 1);
            return {path: resolveTypeScriptSourcePath(path.join(websiteLibAliases[alias], subpath))};
        });
    }
};

function resolveTypeScriptSourcePath(sourcePath) {
    const filePath = `${sourcePath}.ts`;
    if (fs.existsSync(filePath)) {
        return filePath;
    }
    const indexPath = path.join(sourcePath, "index.ts");
    if (fs.existsSync(indexPath)) {
        return indexPath;
    }
    return sourcePath;
}

const sharedConfig = {
    entryPoints: [
        "./src/index.ts"
    ],
    bundle: true,
    minify: false,
    sourcemap: true,
    plugins: [sdkSourceAliasPlugin, websiteLibAliasPlugin]
};

build({
    ...sharedConfig,
    platform: 'browser',
    format: 'esm',
    outfile: "js/xeokit-studio-bundle.js",
});
