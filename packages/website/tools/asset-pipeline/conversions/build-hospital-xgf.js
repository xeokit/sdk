#!/usr/bin/env node

"use strict";

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
    module: "commonjs",
    moduleResolution: "node",
    verbatimModuleSyntax: false
});

require("ts-node/register/transpile-only");

const {sdkRequire} = require("../../lib/sdk-require");

const fs = require("fs");
const path = require("path");
const {pathToFileURL} = require("url");

const {Data} = sdkRequire("model/data/Data");
const {Scene} = sdkRequire("model/scene/Scene");
const {GLTFLoader} = sdkRequire("formats/gltf/GLTFLoader");
const {XGFExporter} = sdkRequire("formats/xgf/XGFExporter");

const REPO_DIR = path.resolve(__dirname, "..", "..", "..", "..", "..");

const COORDINATE_SYSTEMS = {
    identity: {
        basis: [
            1, 0, 0,
            0, 1, 0,
            0, 0, 1
        ],
        origin: [0, 0, 0],
        units: "meters"
    },
    "z-up": {
        basis: [
            1, 0, 0,
            0, 0, 1,
            0, 1, 0
        ],
        origin: [0, 0, 0],
        units: "meters"
    }
};

function printHelp() {
    console.log(`Builds one XGF file from the GLB files in WestRiverSideHospital.

Usage:
  node packages/website/tools/asset-pipeline/conversions/build-hospital-xgf.js [options]

Options:
  --source <dir>              Source directory containing .glb files.
                              Default: ./WestRiverSideHospital
  --out <file>                Output XGF file.
                              Default: ./packages/website/models/WestRiverSideHospital/xgf/model.xgf
  --coord-sys-out <file>      Output coordinate-system JSON file.
                              Default: sibling coordSys.json for the XGF model directory
  --model-id <id>             SceneModel ID.
                              Default: source directory name
  --coordinate-system <name>  identity or z-up.
                              Default: identity
  --yield-interval-ms <ms>    Loader/exporter yield interval.
                              Default: 80
  --soften-colors             Warm and dim bright neutral hospital colors before export.
                              Default.
  --no-soften-colors          Export source material colors unchanged.
  --help                      Show this help.
`);
}

function parseArgs(argv) {
    const options = {
        source: "WestRiverSideHospital",
        out: null,
        coordSysOut: null,
        modelId: null,
        coordinateSystem: "identity",
        yieldIntervalMs: 80,
        softenColors: true
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        switch (arg) {
            case "--source":
            case "--input":
                options.source = readValue(argv, ++i, arg);
                break;
            case "--out":
            case "--output":
                options.out = readValue(argv, ++i, arg);
                break;
            case "--coord-sys-out":
                options.coordSysOut = readValue(argv, ++i, arg);
                break;
            case "--model-id":
                options.modelId = readValue(argv, ++i, arg);
                break;
            case "--coordinate-system":
                options.coordinateSystem = readValue(argv, ++i, arg);
                break;
            case "--yield-interval-ms":
                options.yieldIntervalMs = parsePositiveInteger(readValue(argv, ++i, arg), arg);
                break;
            case "--soften-colors":
                options.softenColors = true;
                break;
            case "--no-soften-colors":
                options.softenColors = false;
                break;
            case "--help":
            case "-h":
                options.help = true;
                break;
            default:
                throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return options;
}

function readValue(argv, index, arg) {
    const value = argv[index];
    if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
    }
    return value;
}

function parsePositiveInteger(value, arg) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`${arg} must be a positive integer`);
    }
    return parsed;
}

function resolveRepoPath(filePath) {
    return path.isAbsolute(filePath) ? filePath : path.resolve(REPO_DIR, filePath);
}

function displayPath(filePath) {
    const relativePath = path.relative(REPO_DIR, filePath);
    return relativePath.startsWith("..") ? filePath : relativePath;
}

function sanitizeId(value) {
    return String(value).replace(/[^A-Za-z0-9_.:-]/g, "_");
}

function discoverGLBFiles(sourceDir) {
    const files = [];

    function walk(dir) {
        for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
            const entryPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(entryPath);
                continue;
            }
            if (entry.isFile() && /\.glb$/i.test(entry.name)) {
                files.push(entryPath);
            }
        }
    }

    walk(sourceDir);

    return files.sort((a, b) => path.relative(sourceDir, a).localeCompare(path.relative(sourceDir, b)));
}

function bufferToArrayBuffer(buffer) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function must(result, message) {
    if (!result || result.ok !== true) {
        const error = result && result.error ? result.error : message;
        throw new Error(error);
    }
    return result.value;
}

function getLayerId(sourceDir, filePath) {
    const relPath = path.relative(sourceDir, filePath);
    return sanitizeId(relPath.slice(0, -path.extname(relPath).length).split(path.sep).join("."));
}

async function loadGLBFile({loader, sourceDir, filePath, sceneModel, dataModel, yieldIntervalMs}) {
    const layerId = getLayerId(sourceDir, filePath);
    const fileData = bufferToArrayBuffer(fs.readFileSync(filePath));

    await loader.load({
        fileData,
        sceneModel,
        dataModel
    }, {
        baseUri: pathToFileURL(path.dirname(filePath) + path.sep).href,
        layerId,
        dataParentId: layerId,
        retainTextureBytes: true,
        yieldIntervalMs
    });
}

async function writeXGF(sceneModel, outFile, yieldIntervalMs) {
    fs.mkdirSync(path.dirname(outFile), {recursive: true});
    const fileData = await new XGFExporter().write({sceneModel}, {yieldIntervalMs});
    fs.writeFileSync(outFile, Buffer.from(fileData));
}

function writeCoordSys(coordinateSystem, outFile) {
    fs.mkdirSync(path.dirname(outFile), {recursive: true});
    fs.writeFileSync(outFile, `${JSON.stringify({
        basis: coordinateSystem.basis,
        origin: coordinateSystem.origin,
        units: coordinateSystem.units
    }, null, 2)}\n`);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function luminance(color) {
    return (0.2126 * color[0]) + (0.7152 * color[1]) + (0.0722 * color[2]);
}

function saturation(color) {
    const max = Math.max(color[0], color[1], color[2]);
    const min = Math.min(color[0], color[1], color[2]);
    return max <= 0 ? 0 : (max - min) / max;
}

function mixColor(color, targetColor, amount) {
    const keep = 1 - amount;
    return [
        (color[0] * keep) + (targetColor[0] * amount),
        (color[1] * keep) + (targetColor[1] * amount),
        (color[2] * keep) + (targetColor[2] * amount)
    ];
}

function capLuminance(color, maxLuminance) {
    const current = luminance(color);
    if (current <= maxLuminance || current <= 0) {
        return color;
    }
    const scale = maxLuminance / current;
    return [
        color[0] * scale,
        color[1] * scale,
        color[2] * scale
    ];
}

function roundColor(color) {
    return [
        Number(clamp(color[0], 0, 1).toFixed(5)),
        Number(clamp(color[1], 0, 1).toFixed(5)),
        Number(clamp(color[2], 0, 1).toFixed(5))
    ];
}

function colorsEqual(a, b) {
    return Math.abs(a[0] - b[0]) < 0.00001
        && Math.abs(a[1] - b[1]) < 0.00001
        && Math.abs(a[2] - b[2]) < 0.00001;
}

function isBrightNeutral(color) {
    return luminance(color) > 0.72 && saturation(color) < 0.18;
}

function softenHospitalColor(color) {
    const luma = luminance(color);
    const sat = saturation(color);
    const warmNeutral = [0.70, 0.64, 0.56];
    const warmMidNeutral = [0.55, 0.51, 0.46];
    let result = color.slice(0, 3);

    if (sat < 0.12 && luma > 0.72) {
        result = mixColor(result, warmNeutral, 0.46);
        result = capLuminance(result, 0.68);
    } else if (sat < 0.18 && luma > 0.56) {
        result = mixColor(result, warmNeutral, 0.20 + Math.min(0.22, (luma - 0.56) * 0.8));
        result = capLuminance(result, 0.72);
    } else if (sat < 0.10 && luma > 0.35) {
        result = mixColor(result, warmMidNeutral, 0.10);
    } else if (luma > 0.78) {
        result = mixColor(result, warmNeutral, 0.08);
        result = capLuminance(result, 0.76);
    }

    return roundColor(result);
}

function softenHospitalColors(sceneModel) {
    const stats = {
        materials: 0,
        meshesWithoutMaterials: 0,
        changedMaterials: 0,
        changedMeshes: 0,
        brightNeutralMaterialsBefore: 0,
        brightNeutralMaterialsAfter: 0
    };

    for (const material of Object.values(sceneModel.materials || {})) {
        stats.materials++;
        const color = Array.from(material.color);
        if (isBrightNeutral(color)) {
            stats.brightNeutralMaterialsBefore++;
        }
        const softened = softenHospitalColor(color);
        if (!colorsEqual(color, softened)) {
            material.color = softened;
            stats.changedMaterials++;
        }
        if (isBrightNeutral(Array.from(material.color))) {
            stats.brightNeutralMaterialsAfter++;
        }
    }

    for (const mesh of Object.values(sceneModel.meshes || {})) {
        if (mesh.material) {
            continue;
        }
        stats.meshesWithoutMaterials++;
        const color = Array.from(mesh.color);
        const softened = softenHospitalColor(color);
        if (!colorsEqual(color, softened)) {
            mesh.color = softened;
            stats.changedMeshes++;
        }
    }

    return stats;
}

function formatBytes(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KiB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

async function main() {
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
        printHelp();
        return;
    }

    const sourceDir = resolveRepoPath(options.source);
    const coordinateSystem = COORDINATE_SYSTEMS[options.coordinateSystem];

    if (!coordinateSystem) {
        throw new Error(`Unknown coordinate system '${options.coordinateSystem}'. Use identity or z-up.`);
    }

    if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
        throw new Error(`Source directory not found: ${sourceDir}`);
    }

    const sourceFiles = discoverGLBFiles(sourceDir);
    if (sourceFiles.length === 0) {
        throw new Error(`No .glb files found in ${sourceDir}`);
    }

    const modelId = sanitizeId(options.modelId || path.basename(sourceDir));
    const outFile = resolveRepoPath(options.out || "packages/website/models/WestRiverSideHospital/xgf/model.xgf");
    const defaultCoordSysOut = path.basename(path.dirname(outFile)) === "xgf"
        ? path.join(path.dirname(path.dirname(outFile)), "coordSys.json")
        : path.join(path.dirname(outFile), "coordSys.json");
    const coordSysOutFile = resolveRepoPath(options.coordSysOut || defaultCoordSysOut);
    const scene = new Scene({coordinateSystem});
    const data = new Data();
    const sceneModel = must(scene.createModel({id: modelId, coordinateSystem}), "Failed to create SceneModel");
    const dataModel = must(data.createModel({id: modelId}), "Failed to create DataModel");
    const loader = new GLTFLoader();

    console.log(`[build-hospital-xgf] Loading ${sourceFiles.length} GLB source file(s) from ${displayPath(sourceDir)}`);

    for (const filePath of sourceFiles) {
        console.log(`[build-hospital-xgf] Loading ${path.relative(sourceDir, filePath)}`);
        await loadGLBFile({
            loader,
            sourceDir,
            filePath,
            sceneModel,
            dataModel,
            yieldIntervalMs: options.yieldIntervalMs
        });
    }

    if (options.softenColors) {
        const colorStats = softenHospitalColors(sceneModel);
        console.log(`[build-hospital-xgf] Softened colors on ${colorStats.changedMaterials}/${colorStats.materials} material(s) and ${colorStats.changedMeshes}/${colorStats.meshesWithoutMaterials} mesh fallback color(s)`);
        console.log(`[build-hospital-xgf] Bright neutral materials: ${colorStats.brightNeutralMaterialsBefore} -> ${colorStats.brightNeutralMaterialsAfter}`);
    }

    console.log(`[build-hospital-xgf] Writing ${displayPath(outFile)}`);
    await writeXGF(sceneModel, outFile, options.yieldIntervalMs);
    console.log(`[build-hospital-xgf] Writing ${displayPath(coordSysOutFile)}`);
    writeCoordSys(coordinateSystem, coordSysOutFile);

    const stats = fs.statSync(outFile);
    console.log(`[build-hospital-xgf] Wrote ${displayPath(outFile)} (${formatBytes(stats.size)})`);
}

main().catch((error) => {
    console.error(`[build-hospital-xgf] ${error.stack || error.message || error}`);
    process.exitCode = 1;
});
