import * as fs from "fs";
import * as path from "path";
import {Scene} from "../../../model/scene/Scene";
import {Data} from "../../../model/data/Data";
import {ThreeDTilesLoader} from "../ThreeDTilesLoader";

// Integration test against a real Cesium 3D Tiles 1.1 sample
// (CesiumGS/3d-tiles-samples, Apache-2.0), vendored under fixtures/. It
// exercises the implicit-tiling path end-to-end on real data: nested `.subtree`
// files (a root subtree plus child subtrees), QUADTREE Morton traversal across
// subtree boundaries, templated content URIs, and glTF/GLB content decode.

const DIR = path.resolve(__dirname, "fixtures/SparseImplicitQuadtree");

function diskFetch(url: string): Promise<ArrayBuffer> {
  const b = fs.readFileSync(url);
  return Promise.resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

const OCTREE_DIR = path.resolve(__dirname, "fixtures/SparseImplicitOctree");

async function loadSample(dir: string) {
  const tileset = JSON.parse(fs.readFileSync(path.join(dir, "tileset.json"), "utf8"));
  const sceneModel = new Scene().createModel({id: "sample"}).value!;
  await new ThreeDTilesLoader().load(
    {fileData: tileset, sceneModel},
    {baseUri: `${dir}/`, fetchArrayBuffer: diskFetch},
  );
  return sceneModel;
}

describe("ThreeDTilesLoader — Cesium implicit-tiling samples", () => {

  it("loads every available tile of the SparseImplicitQuadtree sample", async () => {
    const sceneModel = await loadSample(DIR);
    const contentFiles = fs.readdirSync(path.join(DIR, "content")).filter(f => f.endsWith(".glb"));
    expect(Object.values(sceneModel.objects).length).toBe(contentFiles.length);
    expect(Object.values(sceneModel.geometries).length).toBeGreaterThan(0);
    expect(Object.values(sceneModel.meshes).length).toBeGreaterThanOrEqual(contentFiles.length);
  });

  it("loads every available tile of the SparseImplicitOctree sample", async () => {
    const sceneModel = await loadSample(OCTREE_DIR);
    const contentFiles = fs.readdirSync(path.join(OCTREE_DIR, "content")).filter(f => f.endsWith(".glb"));
    expect(Object.values(sceneModel.objects).length).toBe(contentFiles.length);
    expect(Object.values(sceneModel.geometries).length).toBeGreaterThan(0);
  });
});

const MD_DIR = path.resolve(__dirname, "fixtures/MetadataGranularities");

describe("ThreeDTilesLoader — Cesium tileset-level metadata", () => {

  it("maps tileset / group / tile metadata to the DataModel", async () => {
    const tileset = JSON.parse(fs.readFileSync(path.join(MD_DIR, "tileset.json"), "utf8"));
    const houseGlb = fs.readFileSync(path.join(MD_DIR, "house1-1.glb"));
    const glb = houseGlb.buffer.slice(houseGlb.byteOffset, houseGlb.byteOffset + houseGlb.byteLength);

    const sceneModel = new Scene().createModel({id: "md"}).value!;
    const dataModel = new Data().createModel({id: "md"}).value!;
    // The real tileset.json drives the metadata; any glb satisfies content.
    const fetchArrayBuffer = async (url: string): Promise<ArrayBuffer> => {
      if (url.endsWith(".glb")) return glb;
      throw new Error(`no fixture for ${url}`);
    };

    await new ThreeDTilesLoader().load(
      {fileData: tileset, sceneModel, dataModel},
      {baseUri: `${MD_DIR}/`, fetchArrayBuffer},
    );

    // Tileset-level metadata on the root DataObject.
    expect(dataModel.objects["tileset"]).toBeDefined();
    const tsProps = dataModel.propertySets["tileset-metadata"];
    const tsByName = Object.fromEntries(tsProps.properties.map(p => [p.name, p.value]));
    expect(tsByName.author).toBe("Cesium");
    expect(tsByName.tileCount).toBe(4);

    // Two metadata groups.
    expect(dataModel.objects["group-0"]).toBeDefined();
    expect(dataModel.objects["group-1"]).toBeDefined();

    // Four tiles carry tile metadata (district / population).
    const tileObjs = Object.values(dataModel.objects).filter(o => o.type === "exampleTileMetadataClass");
    expect(tileObjs.length).toBe(4);
    const aTile = dataModel.propertySets[`${tileObjs[0].id}-metadata`];
    const tileProps = Object.fromEntries(aTile.properties.map(p => [p.name, p.value]));
    expect(typeof tileProps.district).toBe("string");
    expect(typeof tileProps.population).toBe("number");
  });
});
