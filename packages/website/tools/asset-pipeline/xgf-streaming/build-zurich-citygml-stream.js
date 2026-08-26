#!/usr/bin/env node

// Converts the Zurich CityGML buildings file into a localized, meter-based XGF stream.

const fs = require("fs");
const path = require("path");

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
    module: "commonjs",
    moduleResolution: "node",
    verbatimModuleSyntax: false
});

require("ts-node/register/transpile-only");

const {sdkRequire} = require("../../lib/sdk-require");

const {Scene} = sdkRequire("model/scene/Scene");
const {TrianglesPrimitive} = sdkRequire("base/constants");
const {XGFStreamExporter} = sdkRequire("formats/xgfstream/XGFStreamExporter");
const {earcut} = sdkRequire("formats/cityjson/versions/v1_0/earcut");

const MODEL_ID = "Zurich_Building_LoD2_V10";
const DEFAULT_INPUT = "/home/lindsay/Downloads/Zurich_Building_LoD2_V10.gml";

const SDK_DEFAULT_COORDINATE_SYSTEM = {
    basis: [
        1, 0, 0,
        0, 0, 1,
        0, 1, 0
    ],
    origin: [0, 0, 0],
    units: "meters",
    scaleToMeters: 1
};

const LOCAL_SOURCE_COORDINATE_SYSTEM = {
    basis: SDK_DEFAULT_COORDINATE_SYSTEM.basis.slice(),
    origin: [0, 0, 0],
    units: "meters",
    scaleToMeters: 1
};

const MATERIALS = {
    roof: {
        id: "zurich-roof",
        color: [0.50, 0.20, 0.16],
        roughness: 0.9
    },
    wall: {
        id: "zurich-wall",
        color: [0.58, 0.58, 0.56],
        roughness: 0.82
    },
    ground: {
        id: "zurich-ground",
        color: [0.42, 0.39, 0.34],
        roughness: 0.88
    },
    closure: {
        id: "zurich-closure",
        color: [0.49, 0.51, 0.50],
        roughness: 0.84
    },
    surface: {
        id: "zurich-surface",
        color: [0.57, 0.52, 0.45],
        roughness: 0.86
    }
};

const SURFACE_TO_MATERIAL = new Map([
    ["RoofSurface", MATERIALS.roof.id],
    ["WallSurface", MATERIALS.wall.id],
    ["GroundSurface", MATERIALS.ground.id],
    ["OuterFloorSurface", MATERIALS.ground.id],
    ["ClosureSurface", MATERIALS.closure.id],
    ["OuterCeilingSurface", MATERIALS.closure.id]
]);

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
        printHelp();
        process.exit(0);
    }

    const rootDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
    const inputPath = path.resolve(args.input || DEFAULT_INPUT);
    const modelId = args.modelId || MODEL_ID;
    const modelDir = path.resolve(args.out || path.join(rootDir, "packages/website/models", modelId));
    const streamDir = path.join(modelDir, "xgfstream");
    const chunkBudget = parsePositiveInteger(args.chunkBudget, 1600);
    const minChunkBudget = parsePositiveInteger(args.minChunkBudget, 400);
    const gridCellSize = parsePositiveNumber(args.gridCellSize, 450);

    if (!fs.existsSync(inputPath)) {
        throw new Error(`CityGML input file not found: ${inputPath}`);
    }

    const envelope = readEnvelope(inputPath);
    const sourceOrigin = envelope.lower.slice(0, 3);
    const sourceCoordinateSystem = {
        crs: envelope.srsName || "CH1903+",
        basis: SDK_DEFAULT_COORDINATE_SYSTEM.basis.slice(),
        origin: sourceOrigin.slice(),
        units: "meters",
        scaleToMeters: 1
    };

    fs.rmSync(streamDir, {recursive: true, force: true});
    fs.mkdirSync(streamDir, {recursive: true});

    const scene = new Scene({
        logging: false
    });
    const sceneModel = must(scene.createModel({
        id: modelId,
        coordinateSystem: LOCAL_SOURCE_COORDINATE_SYSTEM
    }));

    createMaterials(sceneModel);

    console.log(`[Zurich] Reading ${inputPath}`);
    console.log(`[Zurich] Source ${sourceCoordinateSystem.crs}, local origin ${sourceOrigin.join(", ")}`);

    const parseStats = await parseCityGMLStream({
        inputPath,
        sceneModel,
        sourceOrigin
    });

    if (parseStats.objects === 0) {
        throw new Error("No renderable CityGML buildings were parsed.");
    }

    console.log(`[Zurich] Parsed ${parseStats.objects} objects, ${parseStats.meshes} meshes, ${parseStats.polygons} polygons`);
    console.log(`[Zurich] Exporting XGF stream to ${streamDir}`);

    const stream = await new XGFStreamExporter().write({
        sceneModel
    }, {
        coordinateSystem: SDK_DEFAULT_COORDINATE_SYSTEM,
        partition: "grid",
        chunkMetric: "meshes",
        chunkBudget,
        minChunkBudget,
        gridCellSize,
        assetId: `${modelId}-assets`,
        assetLibraryChunkSize: 16,
        sharedAssetMode: "local",
        sharedAssetMinLibraryUses: 1000000,
        index: "index.json",
        runtimeIndex: "index.runtime.json",
        manifestId: modelId,
        yieldIntervalMs: 80
    });

    writeStreamFiles(streamDir, stream.files);
    fs.writeFileSync(path.join(modelDir, "coordSys.json"), `${JSON.stringify(SDK_DEFAULT_COORDINATE_SYSTEM, null, 2)}\n`);
    fs.writeFileSync(path.join(modelDir, "sourceCoordSys.json"), `${JSON.stringify(sourceCoordinateSystem, null, 2)}\n`);
    fs.writeFileSync(path.join(modelDir, "attribution.json"), `${JSON.stringify({
        source: path.basename(inputPath),
        sourcePath: inputPath,
        sourceCoordinateSystem,
        generatedAt: new Date().toISOString()
    }, null, 2)}\n`);

    const runtimeIndex = parseJSONFileData(stream.files["index.runtime.json"]);
    const chunkCount = Array.isArray(runtimeIndex.chunks) ? runtimeIndex.chunks.length : 0;
    console.log(`[Zurich] Wrote ${Object.keys(stream.files).length} stream files`);
    console.log(`[Zurich] Runtime chunks: ${chunkCount}`);
}

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--help" || arg === "-h") {
            args.help = true;
            continue;
        }
        if (!arg.startsWith("--")) {
            args.input = arg;
            continue;
        }
        const key = arg.slice(2);
        const value = argv[i + 1];
        if (!value || value.startsWith("--")) {
            args[key] = true;
        } else {
            args[key] = value;
            i++;
        }
    }
    return args;
}

function printHelp() {
    console.log(`Usage:
  node packages/website/tools/asset-pipeline/xgf-streaming/build-zurich-citygml-stream.js [gml-file]

Options:
  --input <path>             CityGML source path. Defaults to ${DEFAULT_INPUT}
  --out <dir>                Target model directory. Defaults to packages/website/models/${MODEL_ID}
  --model-id <id>            SceneModel and model directory ID. Defaults to ${MODEL_ID}
  --chunk-budget <count>     Target meshes per stream chunk. Defaults to 1600
  --min-chunk-budget <count> Minimum meshes per stream chunk. Defaults to 400
  --grid-cell-size <meters>  Grid partition cell size in localized source meters. Defaults to 450
`);
}

function parsePositiveInteger(value, defaultValue) {
    if (value === undefined) {
        return defaultValue;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Expected a positive integer, got: ${value}`);
    }
    return parsed;
}

function parsePositiveNumber(value, defaultValue) {
    if (value === undefined) {
        return defaultValue;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Expected a positive number, got: ${value}`);
    }
    return parsed;
}

function writeStreamFiles(streamDir, files) {
    for (const [fileName, fileData] of Object.entries(files)) {
        const filePath = path.join(streamDir, fileName);
        fs.mkdirSync(path.dirname(filePath), {recursive: true});
        fs.writeFileSync(filePath, toWritableFileData(fileData));
    }
}

function toWritableFileData(fileData) {
    if (typeof fileData === "string" || Buffer.isBuffer(fileData)) {
        return fileData;
    }
    if (fileData instanceof ArrayBuffer) {
        return Buffer.from(fileData);
    }
    if (ArrayBuffer.isView(fileData)) {
        return Buffer.from(fileData.buffer, fileData.byteOffset, fileData.byteLength);
    }
    if (fileData && typeof fileData === "object") {
        return `${JSON.stringify(fileData, null, 2)}\n`;
    }
    throw new Error(`Unsupported XGF stream file data type: ${typeof fileData}`);
}

function parseJSONFileData(fileData) {
    if (typeof fileData === "string") {
        return JSON.parse(fileData);
    }
    if (fileData instanceof ArrayBuffer) {
        return JSON.parse(Buffer.from(fileData).toString("utf8"));
    }
    if (ArrayBuffer.isView(fileData)) {
        return JSON.parse(Buffer.from(fileData.buffer, fileData.byteOffset, fileData.byteLength).toString("utf8"));
    }
    if (fileData && typeof fileData === "object") {
        return fileData;
    }
    throw new Error(`Unsupported JSON stream file data type: ${typeof fileData}`);
}

function readEnvelope(inputPath) {
    const fd = fs.openSync(inputPath, "r");
    try {
        const buffer = Buffer.alloc(1024 * 1024);
        const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
        const head = buffer.toString("utf8", 0, bytesRead);
        const boundedBy = head.match(/<gml:boundedBy[\s\S]*?<\/gml:boundedBy>/);
        if (!boundedBy) {
            throw new Error("Could not find gml:boundedBy envelope in CityGML file.");
        }
        const srsName = (boundedBy[0].match(/srsName\s*=\s*["']([^"']+)["']/) || [])[1];
        const lowerText = (boundedBy[0].match(/<gml:lowerCorner[^>]*>([\s\S]*?)<\/gml:lowerCorner>/) || [])[1];
        const upperText = (boundedBy[0].match(/<gml:upperCorner[^>]*>([\s\S]*?)<\/gml:upperCorner>/) || [])[1];
        if (!lowerText || !upperText) {
            throw new Error("Could not find lowerCorner/upperCorner in CityGML envelope.");
        }
        const lower = parseNumberList(lowerText);
        const upper = parseNumberList(upperText);
        if (lower.length < 3 || upper.length < 3) {
            throw new Error("CityGML envelope corners must contain at least three coordinates.");
        }
        return {
            srsName,
            lower: lower.slice(0, 3),
            upper: upper.slice(0, 3)
        };
    } finally {
        fs.closeSync(fd);
    }
}

function createMaterials(sceneModel) {
    for (const material of Object.values(MATERIALS)) {
        must(sceneModel.createMaterial({
            id: material.id,
            color: material.color,
            roughness: material.roughness
        }));
    }
}

function parseCityGMLStream({inputPath, sceneModel, sourceOrigin}) {
    const state = {
        inputPath,
        sceneModel,
        sourceOrigin,
        buffer: "",
        elementStack: [],
        surfaceStack: [],
        currentBuilding: null,
        currentPolygon: null,
        textCapture: null,
        usedIds: new Set(),
        sequence: 0,
        stats: {
            buildings: 0,
            objects: 0,
            meshes: 0,
            polygons: 0,
            skippedPolygons: 0
        }
    };

    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(inputPath, {
            encoding: "utf8",
            highWaterMark: 1024 * 1024
        });

        stream.on("data", chunk => {
            try {
                state.buffer += chunk;
                processBuffer(state, false);
            } catch (error) {
                stream.destroy(error);
            }
        });

        stream.on("end", () => {
            try {
                processBuffer(state, true);
                if (state.currentBuilding) {
                    flushBuilding(state);
                }
                resolve(state.stats);
            } catch (error) {
                reject(error);
            }
        });

        stream.on("error", reject);
    });
}

function processBuffer(state, final) {
    while (state.buffer.length > 0) {
        const tagStart = state.buffer.indexOf("<");
        if (tagStart === -1) {
            if (state.textCapture) {
                state.textCapture.text += state.buffer;
            }
            state.buffer = "";
            break;
        }
        if (tagStart > 0) {
            const text = state.buffer.slice(0, tagStart);
            if (state.textCapture) {
                state.textCapture.text += text;
            }
            state.buffer = state.buffer.slice(tagStart);
        }

        const tagEnd = state.buffer.indexOf(">");
        if (tagEnd === -1) {
            if (final) {
                throw new Error("Unterminated XML tag at end of CityGML file.");
            }
            break;
        }

        const rawTag = state.buffer.slice(1, tagEnd);
        state.buffer = state.buffer.slice(tagEnd + 1);
        handleTag(state, rawTag);
    }
}

function handleTag(state, rawTag) {
    const trimmed = rawTag.trim();
    if (!trimmed || trimmed[0] === "?" || trimmed[0] === "!") {
        return;
    }

    if (trimmed[0] === "/") {
        const name = trimmed.slice(1).trim().split(/\s+/, 1)[0];
        closeElement(state, localName(name));
        return;
    }

    const selfClosing = trimmed.endsWith("/");
    const openTag = selfClosing ? trimmed.slice(0, -1).trim() : trimmed;
    const nameEnd = openTag.search(/\s/);
    const name = nameEnd === -1 ? openTag : openTag.slice(0, nameEnd);
    const attrsText = nameEnd === -1 ? "" : openTag.slice(nameEnd + 1);
    const local = localName(name);
    const attrs = parseAttributes(attrsText);

    openElement(state, local, attrs);

    if (selfClosing) {
        closeElement(state, local);
    }
}

function openElement(state, local, attrs) {
    const inheritedDimension = currentDimension(state);
    const dimension = readDimension(attrs) || inheritedDimension || 3;
    state.elementStack.push({
        local,
        dimension
    });

    if (local === "Building" && !state.currentBuilding) {
        startBuilding(state, attrs);
        return;
    }

    if (SURFACE_TO_MATERIAL.has(local)) {
        state.surfaceStack.push(local);
        return;
    }

    if (state.currentBuilding && (local === "Polygon" || local === "Triangle" || local === "Rectangle")) {
        state.currentPolygon = {
            rings: [],
            pendingPosRing: [],
            materialId: currentMaterialId(state)
        };
        return;
    }

    if (state.currentBuilding && (local === "posList" || local === "pos")) {
        state.textCapture = {
            kind: local,
            text: "",
            dimension
        };
        return;
    }

    if (state.currentBuilding && local === "name" && !state.currentBuilding.name) {
        state.textCapture = {
            kind: local,
            text: "",
            dimension
        };
    }
}

function closeElement(state, local) {
    if (state.textCapture && state.textCapture.kind === local) {
        finishTextCapture(state);
    }

    if (local === "LinearRing" && state.currentPolygon && state.currentPolygon.pendingPosRing.length >= 9) {
        state.currentPolygon.rings.push(state.currentPolygon.pendingPosRing);
        state.currentPolygon.pendingPosRing = [];
    }

    if ((local === "Polygon" || local === "Triangle" || local === "Rectangle") && state.currentPolygon) {
        finishPolygon(state);
        state.currentPolygon = null;
    }

    if (SURFACE_TO_MATERIAL.has(local)) {
        const lastIndex = state.surfaceStack.lastIndexOf(local);
        if (lastIndex !== -1) {
            state.surfaceStack.splice(lastIndex, 1);
        }
    }

    if (local === "Building" && state.currentBuilding) {
        flushBuilding(state);
    }

    for (let i = state.elementStack.length - 1; i >= 0; i--) {
        if (state.elementStack[i].local === local) {
            state.elementStack.splice(i, 1);
            return;
        }
    }
}

function finishTextCapture(state) {
    const capture = state.textCapture;
    state.textCapture = null;

    if (!state.currentBuilding) {
        return;
    }

    if (capture.kind === "name") {
        const name = capture.text.trim();
        if (name) {
            state.currentBuilding.name = name;
        }
        return;
    }

    if (!state.currentPolygon) {
        return;
    }

    const coordinates = parseCoordinates(capture.text, capture.dimension, state.sourceOrigin);
    if (coordinates.length < 9) {
        return;
    }

    if (capture.kind === "pos") {
        state.currentPolygon.pendingPosRing.push(...coordinates.slice(0, 3));
    } else {
        state.currentPolygon.rings.push(coordinates);
    }
}

function startBuilding(state, attrs) {
    const rawId = attrs["gml:id"] || attrs.id || `building-${++state.sequence}`;
    const id = uniqueId(safeId(rawId), state.usedIds);
    state.currentBuilding = {
        id,
        originalId: rawId,
        name: "",
        groups: new Map()
    };
    state.stats.buildings++;
}

function flushBuilding(state) {
    const building = state.currentBuilding;
    state.currentBuilding = null;

    if (!building) {
        return;
    }

    const meshIds = [];
    let groupIndex = 0;

    for (const [materialId, geometry] of building.groups.entries()) {
        if (geometry.positions.length < 9 || geometry.indices.length < 3) {
            continue;
        }

        const geometryId = uniqueId(`${building.id}-geometry-${groupIndex}`, state.usedIds);
        const meshId = uniqueId(`${building.id}-mesh-${groupIndex}`, state.usedIds);
        groupIndex++;

        must(state.sceneModel.createGeometry({
            id: geometryId,
            primitive: TrianglesPrimitive,
            positions: geometry.positions,
            indices: geometry.indices
        }));

        must(state.sceneModel.createMesh({
            id: meshId,
            geometryId,
            materialId
        }));

        meshIds.push(meshId);
        state.stats.meshes++;
    }

    if (meshIds.length === 0) {
        return;
    }

    must(state.sceneModel.createObject({
        id: building.id,
        originalSystemId: building.originalId,
        name: building.name || undefined,
        meshIds
    }));

    state.stats.objects++;

    if (state.stats.objects % 1000 === 0) {
        console.log(`[Zurich] Parsed ${state.stats.objects} renderable buildings`);
    }
}

function finishPolygon(state) {
    const polygon = state.currentPolygon;
    const building = state.currentBuilding;
    if (!polygon || !building) {
        return;
    }

    if (polygon.rings.length === 0 && polygon.pendingPosRing.length >= 9) {
        polygon.rings.push(polygon.pendingPosRing);
    }

    const rings = polygon.rings
        .map(removeClosingDuplicate)
        .filter(ring => ring.length >= 9);

    if (rings.length === 0) {
        state.stats.skippedPolygons++;
        return;
    }

    const normal = normalOfRing(rings[0]);
    if (Math.abs(normal[0]) + Math.abs(normal[1]) + Math.abs(normal[2]) < 1e-9) {
        state.stats.skippedPolygons++;
        return;
    }

    const axis = dominantAxis(normal);
    const flat = [];
    const holes = [];
    const positions = [];
    let vertexOffset = 0;

    for (let ringIndex = 0; ringIndex < rings.length; ringIndex++) {
        const ring = rings[ringIndex];
        if (ringIndex > 0) {
            holes.push(vertexOffset);
        }
        for (let i = 0; i < ring.length; i += 3) {
            positions.push(ring[i], ring[i + 1], ring[i + 2]);
            pushProjected(flat, ring[i], ring[i + 1], ring[i + 2], axis);
            vertexOffset++;
        }
    }

    const triangles = earcut(flat, holes, 2);
    if (!triangles || triangles.length < 3) {
        state.stats.skippedPolygons++;
        return;
    }

    const group = getBuildingGeometryGroup(building, polygon.materialId);
    const baseVertex = group.positions.length / 3;
    group.positions.push(...positions);
    for (let i = 0; i < triangles.length; i++) {
        group.indices.push(baseVertex + triangles[i]);
    }
    state.stats.polygons++;
}

function getBuildingGeometryGroup(building, materialId) {
    let group = building.groups.get(materialId);
    if (!group) {
        group = {
            positions: [],
            indices: []
        };
        building.groups.set(materialId, group);
    }
    return group;
}

function currentMaterialId(state) {
    for (let i = state.surfaceStack.length - 1; i >= 0; i--) {
        const materialId = SURFACE_TO_MATERIAL.get(state.surfaceStack[i]);
        if (materialId) {
            return materialId;
        }
    }
    return MATERIALS.surface.id;
}

function currentDimension(state) {
    for (let i = state.elementStack.length - 1; i >= 0; i--) {
        const dimension = state.elementStack[i].dimension;
        if (dimension) {
            return dimension;
        }
    }
    return 3;
}

function readDimension(attrs) {
    const dimension = attrs.srsDimension || attrs.dimension;
    if (!dimension) {
        return null;
    }
    const parsed = Number.parseInt(dimension, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseAttributes(attrsText) {
    const attrs = {};
    const regex = /([:\w.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let match;
    while ((match = regex.exec(attrsText)) !== null) {
        attrs[match[1]] = match[2] !== undefined ? match[2] : match[3];
    }
    return attrs;
}

function parseCoordinates(text, dimension, origin) {
    const numbers = parseNumberList(text);
    const coordinates = [];
    for (let i = 0; i + dimension - 1 < numbers.length; i += dimension) {
        coordinates.push(
            numbers[i] - origin[0],
            numbers[i + 1] - origin[1],
            (numbers[i + 2] || 0) - origin[2]
        );
    }
    return coordinates;
}

function parseNumberList(text) {
    const numbers = [];
    const regex = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        numbers.push(Number(match[0]));
    }
    return numbers;
}

function removeClosingDuplicate(ring) {
    if (ring.length < 6) {
        return ring;
    }
    const last = ring.length - 3;
    if (samePoint(ring, 0, last)) {
        return ring.slice(0, last);
    }
    return ring;
}

function samePoint(values, a, b) {
    return Math.abs(values[a] - values[b]) < 1e-7
        && Math.abs(values[a + 1] - values[b + 1]) < 1e-7
        && Math.abs(values[a + 2] - values[b + 2]) < 1e-7;
}

function normalOfRing(ring) {
    let nx = 0;
    let ny = 0;
    let nz = 0;
    const count = ring.length / 3;
    for (let i = 0; i < count; i++) {
        const j = (i + 1) % count;
        const ix = ring[i * 3];
        const iy = ring[i * 3 + 1];
        const iz = ring[i * 3 + 2];
        const jx = ring[j * 3];
        const jy = ring[j * 3 + 1];
        const jz = ring[j * 3 + 2];
        nx += (iy - jy) * (iz + jz);
        ny += (iz - jz) * (ix + jx);
        nz += (ix - jx) * (iy + jy);
    }
    return [nx, ny, nz];
}

function dominantAxis(normal) {
    const ax = Math.abs(normal[0]);
    const ay = Math.abs(normal[1]);
    const az = Math.abs(normal[2]);
    if (ax >= ay && ax >= az) {
        return 0;
    }
    if (ay >= ax && ay >= az) {
        return 1;
    }
    return 2;
}

function pushProjected(flat, x, y, z, axis) {
    if (axis === 0) {
        flat.push(y, z);
    } else if (axis === 1) {
        flat.push(x, z);
    } else {
        flat.push(x, y);
    }
}

function localName(name) {
    const colon = name.indexOf(":");
    return colon === -1 ? name : name.slice(colon + 1);
}

function safeId(value) {
    return String(value)
        .trim()
        .replace(/[^A-Za-z0-9_.:-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        || "building";
}

function uniqueId(base, usedIds) {
    let id = base;
    let suffix = 1;
    while (usedIds.has(id)) {
        id = `${base}-${suffix++}`;
    }
    usedIds.add(id);
    return id;
}

function must(result) {
    if (!result || result.ok === false) {
        throw new Error(result?.error || "Unexpected SDK failure");
    }
    return result.value;
}

main().catch(error => {
    console.error(error.stack || error.message || error);
    process.exit(1);
});
