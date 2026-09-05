const fs = require("fs");
const path = require("path");
const {build} = require("esbuild");

const websiteRoot = path.resolve(__dirname, "..", "..");
const sdkSrcRoot = path.resolve(websiteRoot, "..", "sdk", "src");
const examplesRoot = path.join(websiteRoot, "examples");
const libsRoot = path.join(websiteRoot, "libs");
const examplesLibSrcRoot = path.join(libsRoot, "examples", "src");
const examplesLibDistRoot = path.join(libsRoot, "examples", "dist");
const authoringLibSrcRoot = path.join(libsRoot, "authoring", "src");
const authoringLibDistRoot = path.join(libsRoot, "authoring", "dist");
const uiLibSrcRoot = path.join(libsRoot, "ui", "src");
const uiLibDistRoot = path.join(libsRoot, "ui", "dist");
const presentationsLibSrcRoot = path.join(libsRoot, "presentations", "src");
const presentationsLibDistRoot = path.join(libsRoot, "presentations", "dist");
const studioLibSrcRoot = path.join(libsRoot, "studio", "src");
const studioLibDistRoot = path.join(libsRoot, "studio", "dist");
const websiteLibAliases = {
  "@xeokit/website-authoring": path.join(libsRoot, "authoring", "src"),
  "@xeokit/website-examples": path.join(libsRoot, "examples", "src"),
  "@xeokit/website-presentations": path.join(libsRoot, "presentations", "src"),
  "@xeokit/website-studio": path.join(libsRoot, "studio", "src"),
  "@xeokit/website-ui": path.join(libsRoot, "ui", "src")
};

const commonEntries = [
  {
    entry: path.join(examplesLibSrcRoot, "hud", "CombatJetHUD.ts"),
    outfile: path.join(examplesLibDistRoot, "hud", "CombatJetHUD.js")
  },
  {
    entry: path.join(examplesLibSrcRoot, "aircraft", "index.ts"),
    outfile: path.join(examplesLibDistRoot, "aircraft", "index.js")
  },
  {
    entry: path.join(authoringLibSrcRoot, "building", "index.ts"),
    outfile: path.join(authoringLibDistRoot, "building", "index.js")
  },
  {
    entry: path.join(examplesLibSrcRoot, "flight", "FastJetExampleRuntime.ts"),
    outfile: path.join(examplesLibDistRoot, "flight", "FastJetExampleRuntime.js")
  },
  {
    entry: path.join(examplesLibSrcRoot, "physics", "index.ts"),
    outfile: path.join(examplesLibDistRoot, "physics", "index.js")
  },
  {
    entry: path.join(uiLibSrcRoot, "index.ts"),
    outfile: path.join(uiLibDistRoot, "index.js")
  },
  {
    entry: path.join(presentationsLibSrcRoot, "index.ts"),
    outfile: path.join(presentationsLibDistRoot, "index.js")
  },
  {
    entry: path.join(studioLibSrcRoot, "index.ts"),
    outfile: path.join(studioLibDistRoot, "index.js")
  }
];

async function main() {
  const entries = [
    ...commonEntries.filter(({entry}) => fs.existsSync(entry)),
    ...findExampleEntries()
  ];

  if (entries.length === 0) {
    console.log("No example TypeScript libs to build");
    return;
  }

  for (const {entry, outfile, example} of entries) {
    console.log(`Building example lib: ${path.relative(websiteRoot, entry)} -> ${path.relative(websiteRoot, outfile)}`);
    await build({
      entryPoints: [entry],
      outfile,
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "es2022",
      minify: example === true,
      sourcemap: true,
      logLevel: "info",
      plugins: [sdkSourceAliasPlugin, websiteLibAliasPlugin],
      external: [
        "../../js/xeokit-studio-bundle.js",
        "../js/xeokit-studio-bundle.js",
        "./js/xeokit-studio-bundle.js",
        "/js/xeokit-studio-bundle.js"
      ]
    });
  }
}

function findExampleEntries() {
  if (!fs.existsSync(examplesRoot)) {
    return [];
  }
  const entries = [];
  visit(examplesRoot);
  return entries;

  function visit(dir) {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      const stat = fs.statSync(file);
      if (stat.isDirectory()) {
        if (name === "node_modules") {
          continue;
        }
        if (name === "chunks" && !fs.existsSync(path.join(file, "index.ts"))) {
          continue;
        }
        visit(file);
        continue;
      }
      if (name !== "index.ts") {
        continue;
      }
      const exampleDir = path.basename(dir) === "src" ? path.dirname(dir) : dir;
      entries.push({
        entry: file,
        outfile: path.join(exampleDir, "index.js"),
        example: true
      });
    }
  }
}

const sdkSourceAliasPlugin = {
  name: "sdk-source-alias",
  setup(build) {
    build.onResolve({filter: /^@xeokit\/sdk(?:\/.*)?$/}, (args) => {
      const subpath = args.path === "@xeokit/sdk"
        ? "index"
        : args.path.slice("@xeokit/sdk/".length);
      return {path: resolveSdkSourcePath(subpath)};
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

function resolveSdkSourcePath(subpath) {
  return resolveTypeScriptSourcePath(path.join(sdkSrcRoot, subpath));
}

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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
