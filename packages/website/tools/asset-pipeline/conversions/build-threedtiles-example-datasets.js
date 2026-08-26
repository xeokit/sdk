const fs = require("fs");
const path = require("path");
const {createRequire} = require("module");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const OUT = path.join(ROOT, "models", "ThreeDTilesExamples");
const FIXTURES = path.resolve(ROOT, "..", "sdk", "src", "formats", "threedtiles", "tests", "fixtures");
const sdkRequire = createRequire(path.resolve(ROOT, "..", "sdk", "package.json"));
const {parse} = sdkRequire("@loaders.gl/core");
const {LASLoader} = sdkRequire("@loaders.gl/las");

const enc = (s) => new TextEncoder().encode(s);

function mkdirp(dir) {
  fs.mkdirSync(dir, {recursive: true});
}

function concat(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function alignedJSON(obj, headerLen) {
  let bytes = enc(JSON.stringify(obj));
  const pad = (8 - ((headerLen + bytes.length) % 8)) % 8;
  if (pad) bytes = concat([bytes, new Uint8Array(pad).fill(0x20)]);
  return bytes;
}

function makePNTS(positions, colors) {
  const ft = alignedJSON({
    POINTS_LENGTH: positions.length / 3,
    POSITION: {byteOffset: 0},
    RGB: {byteOffset: positions.length * 4},
  }, 28);
  const bin = new Uint8Array((positions.length * 4) + colors.length);
  new Float32Array(bin.buffer, 0, positions.length).set(positions);
  bin.set(colors, positions.length * 4);

  const byteLength = 28 + ft.length + bin.length;
  const head = new Uint8Array(28);
  const dv = new DataView(head.buffer);
  head.set(enc("pnts"), 0);
  dv.setUint32(4, 1, true);
  dv.setUint32(8, byteLength, true);
  dv.setUint32(12, ft.length, true);
  dv.setUint32(16, bin.length, true);
  dv.setUint32(20, 0, true);
  dv.setUint32(24, 0, true);
  return concat([head, ft, bin]);
}

async function loadPumpkinHillPNTS() {
  const file = path.join(ROOT, "models", "Nalls-Pumpkin-Hill", "laz", "model.laz");
  const source = fs.readFileSync(file);
  const parsed = await parse(
    source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength),
    LASLoader,
    {las: {colorDepth: "auto", fp64: false}},
  );
  const sourcePositions = parsed.attributes.POSITION.value;
  const sourceColors = parsed.attributes.COLOR_0?.value;
  const colorSize = parsed.attributes.COLOR_0?.size || 0;
  const sourceCount = Math.floor(sourcePositions.length / 3);
  const sampleStep = Math.max(1, Math.floor(sourceCount / 60000));
  const sampledCount = Math.ceil(sourceCount / sampleStep);
  const positions = new Float32Array(sampledCount * 3);
  const colors = new Uint8Array(sampledCount * 3);

  let outPoint = 0;
  for (let i = 0; i < sourceCount; i += sampleStep) {
    const p = i * 3;
    const c = i * colorSize;
    positions[outPoint * 3] = sourcePositions[p];
    positions[outPoint * 3 + 1] = sourcePositions[p + 1];
    positions[outPoint * 3 + 2] = sourcePositions[p + 2];
    if (sourceColors && colorSize >= 3) {
      colors[outPoint * 3] = sourceColors[c];
      colors[outPoint * 3 + 1] = sourceColors[c + 1];
      colors[outPoint * 3 + 2] = sourceColors[c + 2];
    } else {
      colors[outPoint * 3] = 200;
      colors[outPoint * 3 + 1] = 200;
      colors[outPoint * 3 + 2] = 200;
    }
    outPoint++;
  }

  return {
    pnts: makePNTS(positions.subarray(0, outPoint * 3), colors.subarray(0, outPoint * 3)),
    pointCount: outPoint,
    bounds: parsed.loaderData
      ? [
        parsed.loaderData.mins[0],
        parsed.loaderData.mins[1],
        parsed.loaderData.mins[2],
        parsed.loaderData.maxs[0],
        parsed.loaderData.maxs[1],
        parsed.loaderData.maxs[2],
      ]
      : computeBounds(positions.subarray(0, outPoint * 3)),
  };
}

function boxFromBounds(bounds, margin = 0) {
  const minX = bounds[0] - margin;
  const minY = bounds[1] - margin;
  const minZ = bounds[2] - margin;
  const maxX = bounds[3] + margin;
  const maxY = bounds[4] + margin;
  const maxZ = bounds[5] + margin;
  return [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
    (maxX - minX) / 2, 0, 0,
    0, (maxY - minY) / 2, 0,
    0, 0, (maxZ - minZ) / 2,
  ];
}

function computeBounds(positions) {
  const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    bounds[0] = Math.min(bounds[0], positions[i]);
    bounds[1] = Math.min(bounds[1], positions[i + 1]);
    bounds[2] = Math.min(bounds[2], positions[i + 2]);
    bounds[3] = Math.max(bounds[3], positions[i]);
    bounds[4] = Math.max(bounds[4], positions[i + 1]);
    bounds[5] = Math.max(bounds[5], positions[i + 2]);
  }
  return bounds;
}

function makeI3DM(glb, instances = [
    -16, -12, 0,
      2, -12, 0,
    -16,   7, 0,
      2,   7, 0,
  ], scales = [0.5, 0.58, 0.64, 0.54]) {
  const ft = alignedJSON({
    INSTANCES_LENGTH: scales.length,
    POSITION: {byteOffset: 0},
    SCALE: {byteOffset: instances.length * 4},
  }, 32);
  const bin = new Uint8Array((instances.length + scales.length) * 4);
  new Float32Array(bin.buffer, 0, instances.length).set(instances);
  new Float32Array(bin.buffer, instances.length * 4, scales.length).set(scales);

  const byteLength = 32 + ft.length + bin.length + glb.length;
  const head = new Uint8Array(32);
  const dv = new DataView(head.buffer);
  head.set(enc("i3dm"), 0);
  dv.setUint32(4, 1, true);
  dv.setUint32(8, byteLength, true);
  dv.setUint32(12, ft.length, true);
  dv.setUint32(16, bin.length, true);
  dv.setUint32(20, 0, true);
  dv.setUint32(24, 0, true);
  dv.setUint32(28, 1, true);
  return concat([head, ft, bin, glb]);
}

function makeDistrictInstances(count, seed) {
  const cols = Math.ceil(Math.sqrt(count));
  const spacing = 4.2;
  const positions = [];
  const scales = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const jitterX = ((i * 17 + seed * 11) % 9 - 4) * 0.06;
    const jitterY = ((i * 23 + seed * 7) % 9 - 4) * 0.06;
    positions.push(
      (col - (cols - 1) / 2) * spacing + jitterX,
      (row - (Math.ceil(count / cols) - 1) / 2) * spacing + jitterY,
      0,
    );
    scales.push(0.22 + ((i + seed) % 5) * 0.02);
  }
  return {positions, scales};
}

function makeCMPT(inner) {
  const byteLength = 16 + inner.reduce((n, b) => n + b.length, 0);
  const head = new Uint8Array(16);
  const dv = new DataView(head.buffer);
  head.set(enc("cmpt"), 0);
  dv.setUint32(4, 1, true);
  dv.setUint32(8, byteLength, true);
  dv.setUint32(12, inner.length, true);
  return concat([head, ...inner]);
}

function writeJSON(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function writeBinary(file, data) {
  fs.writeFileSync(file, Buffer.from(data.buffer, data.byteOffset, data.byteLength));
}

function unlinkIfExists(file) {
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function writeTileset(dir, contentUri, box, version = "1.0") {
  writeJSON(path.join(dir, "tileset.json"), {
    asset: {version},
    geometricError: 0,
    root: {
      boundingVolume: {box},
      geometricError: 0,
      refine: "ADD",
      content: {uri: contentUri},
    },
  });
}

function translationMatrix(x, y, z) {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ];
}

function writeMetadataGranularitiesTileset(dir) {
  const source = JSON.parse(fs.readFileSync(path.join(FIXTURES, "MetadataGranularities", "tileset.json"), "utf8"));
  source.schema.classes.exampleContentMetadataClass.properties.instances = {
    description: "The number of instanced buildings in this tile content",
    type: "SCALAR",
    componentType: "UINT32",
  };
  const positions = [
    [-24, 18, 0],
    [24, 18, 0],
    [-24, -18, 0],
    [24, -18, 0],
  ];
  const childBox = [0, 0, 2.5, 14, 0, 0, 0, 14, 0, 0, 0, 3.5];
  const root = {
    boundingVolume: {box: [0, 0, 3, 40, 0, 0, 0, 32, 0, 0, 0, 6]},
    geometricError: 512,
    refine: "ADD",
    children: source.root.children.map((child, index) => {
      const content = child.contents?.[0] || child.content || {};
      const tileProps = child.metadata?.properties || {};
      const instanceCount = tileProps.population || 1;
      const contentProps = content.metadata?.properties || {};
      const districtFile = `district-${String(index + 1).padStart(2, "0")}.i3dm`;
      const district = makeDistrictInstances(instanceCount, index + 1);
      writeBinary(path.join(dir, districtFile), makeI3DM(
        new Uint8Array(fs.readFileSync(path.join(FIXTURES, "MetadataGranularities", "house1-1.glb"))),
        district.positions,
        district.scales,
      ));
      return {
        boundingVolume: {box: childBox},
        geometricError: 0,
        transform: translationMatrix(...positions[index]),
        content: {
          uri: districtFile,
          metadata: {
            class: content.metadata?.class,
            properties: {
              ...contentProps,
              vertices: (contentProps.vertices || 0) * instanceCount,
              instances: instanceCount,
            },
          },
          group: index % source.groups.length,
        },
        metadata: child.metadata,
      };
    }),
  };

  writeJSON(path.join(dir, "tileset.json"), {
    asset: source.asset,
    schema: source.schema,
    groups: source.groups,
    metadata: source.metadata,
    geometricError: source.geometricError,
    root,
  });
}

function align4(value) {
  return (value + 3) & ~3;
}

function appendAligned(parts, data) {
  const offset = parts.reduce((sum, part) => sum + part.length, 0);
  const pad = align4(offset) - offset;
  if (pad) parts.push(Buffer.alloc(pad));
  const alignedOffset = offset + pad;
  parts.push(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
  return alignedOffset;
}

function appendBoxFeatureGeometry(target, feature, cx, cy, cz, width, depth, height) {
  const x0 = cx - width / 2;
  const x1 = cx + width / 2;
  const y0 = cy - depth / 2;
  const y1 = cy + depth / 2;
  const z0 = cz - height / 2;
  const z1 = cz + height / 2;
  const faces = [
    [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
    [[x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0], [0, 0, -1]],
    [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]],
    [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]],
    [[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [0, 1, 0]],
    [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [-1, 0, 0]],
  ];
  for (const face of faces) {
    const base = target.positions.length / 3;
    const normal = face[4];
    for (let i = 0; i < 4; i++) {
      target.positions.push(...face[i]);
      target.normals.push(...normal);
      target.featureIds.push(feature);
    }
    target.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

function appendFeatureBoxes(target, feature, boxes) {
  for (const box of boxes) {
    appendBoxFeatureGeometry(target, feature, box[0], box[1], box[2], box[3], box[4], box[5]);
  }
}

function writeFeatureMetadataTileset(dir) {
  const features = [
    {label: "Envelope", vector: [0.90, 0.30, 0.18]},
    {label: "Structure", vector: [0.24, 0.56, 0.96]},
    {label: "Services", vector: [0.22, 0.82, 0.42]},
    {label: "Circulation", vector: [0.96, 0.72, 0.18]},
  ];
  const geometry = {positions: [], normals: [], featureIds: [], indices: []};

  appendFeatureBoxes(geometry, 1, [
    // Floor plates and structural frame.
    [0, 0, 0.08, 6.2, 3.3, 0.16],
    [0, 0, 1.18, 6.2, 3.3, 0.14],
    [0, 0, 2.28, 6.2, 3.3, 0.14],
    [-2.65, -1.25, 1.15, 0.18, 0.18, 2.25],
    [-0.9, -1.25, 1.15, 0.18, 0.18, 2.25],
    [0.9, -1.25, 1.15, 0.18, 0.18, 2.25],
    [2.65, -1.25, 1.15, 0.18, 0.18, 2.25],
    [-2.65, 1.25, 1.15, 0.18, 0.18, 2.25],
    [-0.9, 1.25, 1.15, 0.18, 0.18, 2.25],
    [0.9, 1.25, 1.15, 0.18, 0.18, 2.25],
    [2.65, 1.25, 1.15, 0.18, 0.18, 2.25],
    [0, -1.25, 2.38, 5.5, 0.18, 0.18],
    [0, 1.25, 2.38, 5.5, 0.18, 0.18],
  ]);
  appendFeatureBoxes(geometry, 0, [
    // Facade panels and canopy.
    [-3.22, 0, 1.25, 0.16, 3.0, 2.25],
    [3.22, 0, 1.25, 0.16, 3.0, 2.25],
    [0, -1.72, 1.25, 6.25, 0.16, 2.25],
    [0, 1.72, 1.25, 6.25, 0.16, 2.25],
    [-1.9, -1.9, 2.7, 1.4, 0.55, 0.18],
    [0, -1.9, 2.7, 1.4, 0.55, 0.18],
    [1.9, -1.9, 2.7, 1.4, 0.55, 0.18],
  ]);
  appendFeatureBoxes(geometry, 2, [
    // Roof plant, risers and duct runs.
    [-1.7, 0.55, 2.78, 1.0, 0.65, 0.42],
    [-0.45, 0.55, 2.86, 0.85, 0.52, 0.58],
    [0.8, 0.55, 2.74, 0.9, 0.5, 0.34],
    [2.0, 0.55, 2.78, 0.7, 0.48, 0.42],
    [-0.1, 0.2, 2.58, 3.8, 0.18, 0.18],
    [1.75, 0.2, 1.55, 0.18, 0.18, 2.15],
    [-2.15, 0.2, 1.55, 0.18, 0.18, 2.15],
  ]);
  appendFeatureBoxes(geometry, 3, [
    // Stair/lift core and external circulation bridge.
    [-2.45, -0.15, 1.38, 0.55, 0.8, 2.55],
    [-1.85, -0.98, 0.65, 0.85, 0.32, 0.26],
    [-1.15, -0.78, 0.95, 0.85, 0.32, 0.26],
    [-0.45, -0.58, 1.25, 0.85, 0.32, 0.26],
    [0.25, -0.38, 1.55, 0.85, 0.32, 0.26],
    [0.95, -0.18, 1.85, 0.85, 0.32, 0.26],
    [1.65, 0.02, 2.15, 0.85, 0.32, 0.26],
    [2.45, -0.9, 1.7, 0.65, 1.25, 0.22],
  ]);

  const indexData = new Uint16Array(geometry.indices);
  const positionData = new Float32Array(geometry.positions);
  const normalData = new Float32Array(geometry.normals);
  const featureData = new Uint8Array(geometry.featureIds);
  const metadataData = new Float32Array(features.flatMap(feature => feature.vector));
  const parts = [];
  const indexOffset = appendAligned(parts, indexData);
  const positionOffset = appendAligned(parts, positionData);
  const normalOffset = appendAligned(parts, normalData);
  const featureOffset = appendAligned(parts, featureData);
  const metadataOffset = appendAligned(parts, metadataData);
  const bin = Buffer.concat(parts);
  const uri = `data:application/gltf-buffer;base64,${bin.toString("base64")}`;

  writeJSON(path.join(dir, "tileset.json"), {
    asset: {version: "1.1"},
    geometricError: 100,
    root: {
      content: {uri: "FeatureIdAttributeAndPropertyTable.gltf"},
      boundingVolume: {box: [0, 0, 1.45, 3.8, 0, 0, 0, 2.2, 0, 0, 0, 1.8]},
      geometricError: 0,
    },
  });

  writeJSON(path.join(dir, "FeatureIdAttributeAndPropertyTable.gltf"), {
    asset: {version: "2.0"},
    extensionsUsed: ["EXT_mesh_features", "EXT_structural_metadata"],
    buffers: [{uri, byteLength: bin.length}],
    bufferViews: [
      {buffer: 0, byteOffset: indexOffset, byteLength: indexData.byteLength, target: 34963},
      {buffer: 0, byteOffset: positionOffset, byteLength: positionData.byteLength, target: 34962},
      {buffer: 0, byteOffset: normalOffset, byteLength: normalData.byteLength, target: 34962},
      {buffer: 0, byteOffset: featureOffset, byteLength: featureData.byteLength, target: 34962},
      {buffer: 0, byteOffset: metadataOffset, byteLength: metadataData.byteLength},
    ],
    accessors: [
      {bufferView: 0, componentType: 5123, count: indexData.length, type: "SCALAR", min: [0], max: [positionData.length / 3 - 1]},
      {bufferView: 1, componentType: 5126, count: positionData.length / 3, type: "VEC3", min: [-3.3, -2.175, 0], max: [3.3, 1.8, 3.15]},
      {bufferView: 2, componentType: 5126, count: normalData.length / 3, type: "VEC3", min: [-1, -1, -1], max: [1, 1, 1]},
      {bufferView: 3, componentType: 5121, count: featureData.length, type: "SCALAR", min: [0], max: [features.length - 1]},
    ],
    materials: [{
      pbrMetallicRoughness: {
        baseColorFactor: [0.82, 0.86, 0.9, 1],
        metallicFactor: 0,
        roughnessFactor: 0.72,
      },
      alphaMode: "OPAQUE",
      doubleSided: false,
    }],
    meshes: [{
      primitives: [{
        attributes: {POSITION: 1, NORMAL: 2, _FEATURE_ID_0: 3},
        indices: 0,
        material: 0,
        mode: 4,
        extensions: {
          EXT_mesh_features: {
            featureIds: [{featureCount: features.length, attribute: 0, propertyTable: 0}],
          },
        },
      }],
    }],
    nodes: [{mesh: 0}],
    scenes: [{nodes: [0]}],
    scene: 0,
    extensions: {
      EXT_structural_metadata: {
        schema: {
          id: "FeatureIdAttributeAndPropertyTableSchema",
          classes: {
            exampleMetadataClass: {
              name: "Example metadata class",
              description: "Visible feature block metadata",
              properties: {
                example_VEC3_FLOAT32: {
                  name: "Feature signal vector",
                  description: "Per-feature vector used by the demo for color and tabular inspection",
                  type: "VEC3",
                  componentType: "FLOAT32",
                },
              },
            },
          },
        },
        propertyTables: [{
          name: "Feature block property table",
          class: "exampleMetadataClass",
          count: features.length,
          properties: {
            example_VEC3_FLOAT32: {values: 4},
          },
        }],
      },
    },
  });
}

async function main() {
  mkdirp(OUT);

  const pointCloud = await loadPumpkinHillPNTS();

  const pntsDir = path.join(OUT, "PointCloud");
  mkdirp(pntsDir);
  writeBinary(path.join(pntsDir, "points.pnts"), pointCloud.pnts);
  writeTileset(pntsDir, "points.pnts", boxFromBounds(pointCloud.bounds, 1));
  writeJSON(path.join(pntsDir, "metadata.json"), {
    source: "Nalls-Pumpkin-Hill/laz/model.laz",
    sourcePointCount: 3384664,
    sampledPointCount: pointCloud.pointCount,
    bounds: pointCloud.bounds,
  });

  const glb = fs.readFileSync(path.join(FIXTURES, "MetadataGranularities", "house1-1.glb"));

  const i3dmDir = path.join(OUT, "Instancing");
  mkdirp(i3dmDir);
  writeBinary(path.join(i3dmDir, "houses.i3dm"), makeI3DM(new Uint8Array(glb)));
  writeTileset(i3dmDir, "houses.i3dm", [-7, -2.5, 1.2, 18, 0, 0, 0, 18, 0, 0, 0, 5]);

  const cmptDir = path.join(OUT, "Composite");
  mkdirp(cmptDir);
  unlinkIfExists(path.join(cmptDir, "points.cmpt"));
  writeBinary(path.join(cmptDir, "mixed.cmpt"), makeCMPT([pointCloud.pnts, makeI3DM(new Uint8Array(glb))]));
  writeTileset(cmptDir, "mixed.cmpt", boxFromBounds([
    Math.min(pointCloud.bounds[0], -25.8),
    Math.min(pointCloud.bounds[1], -20),
    Math.min(pointCloud.bounds[2], 0),
    Math.max(pointCloud.bounds[3], 17.5),
    Math.max(pointCloud.bounds[4], 11.5),
    Math.max(pointCloud.bounds[5], 5),
  ], 1));

  const metadataDir = path.join(OUT, "MetadataGranularities");
  mkdirp(metadataDir);
  writeMetadataGranularitiesTileset(metadataDir);
  fs.copyFileSync(
    path.join(FIXTURES, "MetadataGranularities", "house1-1.glb"),
    path.join(metadataDir, "house1-1.glb"),
  );

  const featureDir = path.join(OUT, "FeatureIdAttributeAndPropertyTable");
  mkdirp(featureDir);
  writeFeatureMetadataTileset(featureDir);

  fs.copyFileSync(
    path.join(FIXTURES, "ATTRIBUTION.md"),
    path.join(OUT, "ATTRIBUTION.md"),
  );

  console.log(`Generated 3D Tiles example datasets in ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
