const path = require("path");
const {build} = require("esbuild");

const websiteRoot = path.resolve(__dirname, "..", "..");

const entries = [
  {
    entry: path.join(websiteRoot, "src", "pages", "examples-index", "buildExamplesIndex.js"),
    outfile: path.join(websiteRoot, "js", "buildExamplesIndex.js")
  },
  {
    entry: path.join(websiteRoot, "src", "pages", "model-catalog", "buildViewModelsTable.js"),
    outfile: path.join(websiteRoot, "js", "buildViewModelsTable.js")
  }
];

async function main() {
  for (const {entry, outfile} of entries) {
    console.log(`Building page script: ${path.relative(websiteRoot, entry)} -> ${path.relative(websiteRoot, outfile)}`);
    await build({
      entryPoints: [entry],
      outfile,
      bundle: false,
      format: "esm",
      platform: "browser",
      target: "es2020"
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
