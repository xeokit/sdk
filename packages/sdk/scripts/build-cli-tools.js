// Call from ./packages/sdk

const {build} = require("esbuild");
const fs = require("fs");

function buildCLITool(moduleId) {
    // Sources live under src/convert/<moduleId>/; the dist layout stays
    // dist/<moduleId>/ because package.json `bin` and the CLI's own
    // `../../package.json` resolution depend on that flat output path.
    build({
        ...{
            entryPoints: [
                `./src/convert/${moduleId}/${moduleId}_core.ts`
            ],
            bundle: true,
            minify: false
        },
        platform: 'node',
        format: 'cjs',
        target: "node10.4",
        outfile: `./dist/${moduleId}/${moduleId}_core.cjs.js`,
    });
    if (!fs.existsSync(`./dist/${moduleId}`)) {
        fs.mkdirSync(`./dist/${moduleId}`);
    }
    fs.copyFileSync(`./src/convert/${moduleId}/${moduleId}.js`, `./dist/${moduleId}/${moduleId}.js`);
    fs.copyFileSync(`./src/convert/${moduleId}/${moduleId}_core.ts`, `./dist/${moduleId}/${moduleId}_core.ts`);
}

for (let moduleId of [
    "ifc2gltf2xgf",
    "xeoconvert"
]) {
    buildCLITool(moduleId);
}
