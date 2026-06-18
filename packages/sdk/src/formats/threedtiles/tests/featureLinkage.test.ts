import * as fs from "fs";
import * as path from "path";
import {Scene} from "../../../model/scene/Scene";
import {Data} from "../../../model/data/Data";
import {ThreeDTilesLoader} from "../ThreeDTilesLoader";

// Integration test against a real Cesium sample (CesiumGS/3d-tiles-samples,
// Apache-2.0): a tileset whose content is a bare JSON glTF (not GLB) with a
// single triangle mesh carrying an EXT_mesh_features _FEATURE_ID_0 attribute
// that partitions its 16 vertices into 4 features, each a row of an
// EXT_structural_metadata property table. Exercises two things end-to-end
// through the tileset loader: JSON-glTF tile content, and the per-feature mesh
// split that links each SceneObject to its property-table DataObject by id.

const DIR = path.resolve(__dirname, "fixtures/FeatureIdAttributeAndPropertyTable");

function diskFetch(url: string): Promise<ArrayBuffer> {
  const b = fs.readFileSync(url);
  return Promise.resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

describe("ThreeDTilesLoader — JSON-glTF content + EXT_mesh_features linkage", () => {
  it("loads JSON glTF content, splits per feature, and links each SceneObject to its metadata", async () => {
    const tileset = JSON.parse(fs.readFileSync(path.join(DIR, "tileset.json"), "utf8"));
    const sceneModel = new Scene().createModel({id: "features"}).value!;
    const dataModel = new Data().createModel({id: "features"}).value!;

    await new ThreeDTilesLoader().load(
      {fileData: tileset, sceneModel, dataModel},
      {baseUri: `${DIR}/`, fetchArrayBuffer: diskFetch},
    );

    // The JSON-glTF content decoded and split into one SceneObject per feature.
    expect(Object.keys(sceneModel.objects).length).toBe(4);

    // The 4 property-table rows became typed DataObjects.
    const featureDataObjects = Object.values(dataModel.objects).filter(o => o.type === "exampleMetadataClass");
    expect(featureDataObjects.length).toBe(4);

    // Linkage: every feature DataObject shares its id with a SceneObject.
    for (const dataObject of featureDataObjects) {
      expect(sceneModel.objects[dataObject.id]).toBeDefined();
      expect(sceneModel.objects[dataObject.id].meshes.length).toBe(1);
    }

    // The metadata values came through (one VEC3 per feature row).
    const props = dataModel.propertySets[`${featureDataObjects[0].id}-props`];
    const vec3 = props.properties.find(p => p.name === "example_VEC3_FLOAT32");
    expect(vec3).toBeDefined();
    expect(vec3!.value.length).toBe(3);

    // The split preserved the geometry: 8 triangles total across the 4 features.
    const totalTriangles = Object.values(sceneModel.geometries)
      .reduce((sum, g: any) => sum + (g.indices ? g.indices.length / 3 : 0), 0);
    expect(totalTriangles).toBe(8);
  });
});
