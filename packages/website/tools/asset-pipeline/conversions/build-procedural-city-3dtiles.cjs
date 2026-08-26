const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
const cityDir = path.join(rootDir, "packages/website/models/ProceduralCity3DTiles");
const explicitDir = path.join(cityDir, "threedtiles");
const implicitDir = path.join(cityDir, "implicit");

const DISTRICTS = [
  {name: "Canal Quarter", color: [74, 144, 226], priority: 2, landUse: "mixed-use"},
  {name: "Civic Core", color: [122, 193, 92], priority: 1, landUse: "civic"},
  {name: "Market Grid", color: [232, 166, 61], priority: 3, landUse: "commercial"},
  {name: "Garden Edge", color: [194, 92, 122], priority: 4, landUse: "residential"},
];

main();

function main() {
  enrichExplicitTileset();
  createImplicitTileset();
  neutralizeSidecars();
}

function enrichExplicitTileset() {
  const tilesetPath = path.join(explicitDir, "tileset.json");
  const tileset = readJSON(tilesetPath);
  const children = tileset.root.children || [];
  const stats = children.reduce((acc, child) => {
    const props = child.metadata?.properties || {};
    acc.objects += Number(props.objectCount || 0);
    acc.triangles += Number(props.triangleCount || 0);
    return acc;
  }, {objects: 0, triangles: 0});

  tileset.asset.tilesetVersion = "xeokit-procedural-city-3dtiles/1.1";
  tileset.groups = DISTRICTS.map((district, index) => ({
    class: "proceduralCityDistrict",
    properties: {
      districtId: index,
      name: district.name,
      color: district.color,
      priority: district.priority,
      landUse: district.landUse,
    },
  }));
  tileset.schema = {
    classes: {
      proceduralCityRoot: {
        properties: {
          profile: {type: "STRING"},
          buildingCount: {type: "SCALAR", componentType: "UINT32"},
          tileCount: {type: "SCALAR", componentType: "UINT32"},
          triangleCount: {type: "SCALAR", componentType: "UINT32"},
        },
      },
      proceduralCityDistrict: {
        properties: {
          districtId: {type: "SCALAR", componentType: "UINT32"},
          name: {type: "STRING"},
          color: {type: "VEC3", componentType: "UINT8"},
          priority: {type: "SCALAR", componentType: "UINT32"},
          landUse: {type: "STRING"},
        },
      },
      proceduralCityTile: {
        properties: {
          tileId: {type: "STRING"},
          district: {type: "STRING"},
          gridX: {type: "SCALAR", componentType: "INT32"},
          gridY: {type: "SCALAR", componentType: "INT32"},
          objectCount: {type: "SCALAR", componentType: "UINT32"},
          triangleCount: {type: "SCALAR", componentType: "UINT32"},
          density: {type: "SCALAR", componentType: "FLOAT32"},
          elevationBand: {type: "STRING"},
        },
      },
      proceduralCityContent: {
        properties: {
          uri: {type: "STRING"},
          payload: {type: "STRING"},
          buildings: {type: "SCALAR", componentType: "UINT32"},
          triangles: {type: "SCALAR", componentType: "UINT32"},
        },
      },
    },
  };
  tileset.metadata = {
    class: "proceduralCityRoot",
    properties: {
      profile: "generated procedural city",
      buildingCount: tileset.root.metadata?.properties?.buildingCount || stats.objects,
      tileCount: children.length,
      triangleCount: tileset.root.metadata?.properties?.triangleCount || stats.triangles,
    },
  };
  tileset.root.metadata = tileset.metadata;

  for (const child of children) {
    const props = child.metadata?.properties || {};
    const districtIndex = districtIndexFor(props.gridX, props.gridY);
    const district = DISTRICTS[districtIndex];
    const density = Number((Number(props.objectCount || 0) / 80).toFixed(2));
    child.metadata = {
      class: "proceduralCityTile",
      properties: {
        tileId: props.tileId,
        district: district.name,
        gridX: props.gridX,
        gridY: props.gridY,
        objectCount: props.objectCount,
        triangleCount: props.triangleCount,
        density,
        elevationBand: Number(props.triangleCount || 0) > 11000 ? "high detail" : "standard",
      },
    };
    child.content = {
      ...child.content,
      group: districtIndex,
      metadata: {
        class: "proceduralCityContent",
        properties: {
          uri: child.content.uri,
          payload: "GLB",
          buildings: props.objectCount,
          triangles: props.triangleCount,
        },
      },
    };
  }

  writeJSON(tilesetPath, tileset);
}

function createImplicitTileset() {
  fs.rmSync(implicitDir, {recursive: true, force: true});
  fs.mkdirSync(path.join(implicitDir, "subtrees"), {recursive: true});
  fs.mkdirSync(path.join(implicitDir, "content", "3"), {recursive: true});

  const explicit = readJSON(path.join(explicitDir, "tileset.json"));
  const children = explicit.root.children || [];
  for (const child of children) {
    const props = child.metadata.properties;
    const x = Number(props.gridX) + 4;
    const y = Number(props.gridY) + 4;
    const src = path.join(explicitDir, child.content.uri);
    const dst = path.join(implicitDir, "content", "3", `${x}_${y}.glb`);
    fs.copyFileSync(src, dst);
  }

  const rootBox = explicit.root.boundingVolume.box;
  const tileset = {
    asset: {
      version: "1.1",
      tilesetVersion: "xeokit-procedural-city-implicit/1.0",
    },
    geometricError: 1024,
    root: {
      boundingVolume: {box: rootBox},
      geometricError: 512,
      refine: "REPLACE",
      content: {
        uri: "content/{level}/{x}_{y}.glb",
      },
      implicitTiling: {
        subdivisionScheme: "QUADTREE",
        subtreeLevels: 4,
        availableLevels: 4,
        subtrees: {
          uri: "subtrees/{level}.{x}.{y}.subtree",
        },
      },
    },
  };

  writeJSON(path.join(implicitDir, "tileset.json"), tileset);
  writeJSON(path.join(implicitDir, "coordSys.json"), readJSON(path.join(explicitDir, "coordSys.json")));
  fs.writeFileSync(path.join(implicitDir, "subtrees", "0.0.0.subtree"), makeSubtree(), null);
}

function makeSubtree() {
  const tileBits = new Uint8Array(11);
  const contentBits = new Uint8Array(11);
  for (let level = 0; level <= 3; level++) {
    const count = 1 << (level * 2);
    for (let morton = 0; morton < count; morton++) {
      setBit(tileBits, tilesBeforeLevel(level) + morton);
    }
  }
  const explicit = readJSON(path.join(explicitDir, "tileset.json"));
  for (const child of explicit.root.children || []) {
    const props = child.metadata.properties;
    const x = Number(props.gridX) + 4;
    const y = Number(props.gridY) + 4;
    setBit(contentBits, tilesBeforeLevel(3) + morton2D(x, y));
  }

  const binary = Buffer.concat([Buffer.from(tileBits), Buffer.from([0, 0, 0, 0, 0]), Buffer.from(contentBits)]);
  const json = {
    buffers: [{byteLength: binary.byteLength}],
    bufferViews: [
      {buffer: 0, byteOffset: 0, byteLength: tileBits.byteLength},
      {buffer: 0, byteOffset: 16, byteLength: contentBits.byteLength},
    ],
    tileAvailability: {bitstream: 0},
    contentAvailability: [{bitstream: 1}],
    childSubtreeAvailability: {constant: 0},
  };
  const jsonBytes = Buffer.from(`${JSON.stringify(json)}  `);
  const header = Buffer.alloc(24);
  header.write("subt", 0, 4, "ascii");
  header.writeUInt32LE(1, 4);
  header.writeBigUInt64LE(BigInt(jsonBytes.byteLength), 8);
  header.writeBigUInt64LE(BigInt(binary.byteLength), 16);
  return Buffer.concat([header, jsonBytes, binary]);
}

function neutralizeSidecars() {
  for (const file of [
    path.join(cityDir, "metadata.json"),
    path.join(cityDir, "report.json"),
    path.join(rootDir, "artifacts/evaluation/procedural-city-3dtiles-42.json"),
    path.join(rootDir, "artifacts/evaluation/procedural-city-3dtiles-42.evaluation.json"),
  ]) {
    if (!fs.existsSync(file)) continue;
    const data = readJSON(file);
    neutralizeObject(data);
    writeJSON(file, data);
  }
}

function neutralizeObject(value) {
  if (!value || typeof value !== "object") return;
  if (value.profileName === "amsterdam") value.profileName = "procedural-city";
  if (value.profile === "amsterdam") value.profile = "procedural-city";
  if (value.name === "amsterdam") value.name = "procedural-city";
  if (value.description && typeof value.description === "string" && value.description.includes("Amsterdam")) {
    value.description = "Generated procedural city profile used for 3D Tiles examples.";
  }
  if (value.source?.note && typeof value.source.note === "string") {
    value.source.note = "Representative generated city preset for 3D Tiles examples.";
  }
  for (const child of Object.values(value)) {
    neutralizeObject(child);
  }
}

function districtIndexFor(gridX, gridY) {
  if (gridX < 0 && gridY >= 0) return 0;
  if (gridX >= 0 && gridY >= 0) return 1;
  if (gridX < 0 && gridY < 0) return 2;
  return 3;
}

function setBit(bytes, index) {
  bytes[index >> 3] |= 1 << (index & 7);
}

function tilesBeforeLevel(level) {
  let total = 0;
  for (let i = 0; i < level; i++) total += 1 << (i * 2);
  return total;
}

function morton2D(x, y) {
  let value = 0;
  for (let bit = 0; bit < 16; bit++) {
    value |= ((x >> bit) & 1) << (2 * bit);
    value |= ((y >> bit) & 1) << (2 * bit + 1);
  }
  return value;
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}
