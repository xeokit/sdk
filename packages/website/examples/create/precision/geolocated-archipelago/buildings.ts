// =============================================================================
// Building & ship placement
//
// Loads the Duplex, IfcOpenHouse4, and Ferry models and plants them in the
// scene — each in its own SceneModel whose UTM origin carries the large
// double-precision offset, keeping the loaded geometry's float32 vertices
// small. Also builds the stone foundations (in the archipelago model) that the
// two buildings rest on. Factored out of index.js to keep that file focused.
//
// `model` is the archipelago SceneModel — the foundation boxes go there and
// reuse its "MAT_MATTE" material; the loaded models get their own SceneModels.
// =============================================================================

import {TrianglesPrimitive} from "@xeokit/sdk/base/constants";
import {GLTFLoader} from "@xeokit/sdk/formats/gltf";
import {IFCLoader} from "@xeokit/sdk/formats/ifc";
import {XGFLoader} from "@xeokit/sdk/formats/xgf";
import {buildBox} from "@xeokit/sdk/model/generation/buildGeometry";
import {buildMat4} from "@xeokit/sdk/model/scene";

export async function placeBuildings(scene, data, model, {
  UTM_EAST, UTM_NORTH, duplexAnchor, houseAnchor, SEA_LEVEL,
}) {
  // Stone pedestal under the Duplex, centred on its anchor boulder so the
  // slab top sits flush with the building's foot.
  if (duplexAnchor) {
    const [drx, dry, drz] = duplexAnchor;
    const PED_X = 11, PED_Y = 30, PED_Z = 2;
    const pedGeom = buildBox({
      xSize: PED_X, ySize: PED_Y, zSize: PED_Z
    });
    if (pedGeom.ok) {
      model.createGeometry({
        id: "duplex_pedestal_geom",
        primitive: TrianglesPrimitive,
        positions: pedGeom.value.positions,
        normals:   pedGeom.value.normals,
        indices:   pedGeom.value.indices
      });
      model.createMesh({
        id: "duplex_pedestal_mesh",
        geometryId: "duplex_pedestal_geom",
        materialId: "MAT_MATTE",
        matrix: buildMat4({
          position: [drx, dry, drz],
          rotation: [0, 0, 0],
          scale:    [1, 1, 1]
        }),
        color: [0.55, 0.55, 0.58]
      });
      model.createObject({
        id: "duplex_pedestal",
        meshIds: ["duplex_pedestal_mesh"]
      });
    }
  }

  // Duplex — loaded into its own SceneModel whose UTM origin carries the
  // double-precision offset (UTM east/north + the anchor's local x/y), so its
  // float32 vertices stay small. Duplex is authored Y-up; the SceneModel basis
  // lets the Scene's Z-up world do the Y/Z remap.
  if (duplexAnchor) {
    const [drx, dry, drz] = duplexAnchor;
    const duplexResult = scene.createModel({
      id: "duplex",
      coordinateSystem: {
        basis:  [1, 0, 0,   0, 1, 0,   0, 0, 1],
        origin: [UTM_EAST + drx, drz + 3.0, UTM_NORTH + dry],
        units:  "meters",
        scaleToMeters: 1
      }
    });
    if (duplexResult.ok) {
      try {
        await new XGFLoader().load({
          fileData: await fetchArrayBuffer("../../../../models/Duplex/xgf/model.xgf"),
          sceneModel: duplexResult.value
        });
      } catch (err) {
        console.error("Error loading Duplex XGF:", err);
        duplexResult.value.destroy();
      }
    }
  }

  // IfcOpenHouse4 — an IFC house on island AB, on the far side of the
  // archipelago from the Duplex, mounted on its own stone slab. Loaded from
  // the .ifc source (the shipped .glb has a corrupt header).
  if ( houseAnchor) {
    const [hrx, hry, hrz] = houseAnchor;
    const HSLAB_X = 16, HSLAB_Y = 16, HSLAB_Z = 2;
    const slabGeom = buildBox({
      xSize: HSLAB_X, ySize: HSLAB_Y, zSize: HSLAB_Z
    });
    if (slabGeom.ok) {
      model.createGeometry({
        id: "house_slab_geom",
        primitive: TrianglesPrimitive,
        positions: slabGeom.value.positions,
        indices:   slabGeom.value.indices,
        normals:   slabGeom.value.normals
      });
      model.createMesh({
        id: "house_slab_mesh",
        geometryId: "house_slab_geom",
        materialId: "MAT_MATTE",
        matrix: buildMat4({
          position: [hrx, hry, hrz+6],
          rotation: [0, 0, 0],
          scale:    [1, 1, 1]
        }),
        color: [0.55, 0.55, 0.58]
      });
      model.createObject({
        id: "house_slab",
        meshIds: ["house_slab_mesh"]
      });
    }

    const houseDataResult  = data.createModel({ id: "house" });
    const houseSceneResult = scene.createModel({
      id: "house",
      coordinateSystem: {
        // IFC is Z-up by convention, so an identity basis needs no remapping.
        basis:  [1, 0, 0,   0, 1, 0,   0, 0, 1],
        origin: [UTM_EAST + hrx, (hrz + HSLAB_Z / 2)+12, UTM_NORTH + hry],
        units:  "meters",
        scaleToMeters: 1
      }
    });
    if (houseSceneResult.ok && houseDataResult.ok) {
      try {
        await new IFCLoader().load({
          fileData: await fetchArrayBuffer("../../../../models/IfcOpenHouse4/ifc/model.ifc"),
          sceneModel: houseSceneResult.value,
          dataModel:  houseDataResult.value,
        });
      } catch (err) {
        console.error("Error loading IfcOpenHouse4 IFC:", err?.message ?? err, err?.stack);
        houseSceneResult.value.destroy();
        houseDataResult.value.destroy();
      }
    }
  }

  // Ferry — Y-up glTF afloat in the SE quadrant. Its SceneModel declares an
  // identity basis (Y-up source); the Scene's Z-up basis handles the Y/Z swap.
  const FERRY_E = 8500;   // east of UTM origin
  const FERRY_N = -8500;  // south of UTM origin
  const ferryResult = scene.createModel({
    id: "ferry",
    coordinateSystem: {
      basis:  [1, 0, 0,   0, 1, 0,   0, 0, 1],   // identity (Y-up source)
      origin: [UTM_EAST + FERRY_E, SEA_LEVEL, UTM_NORTH + FERRY_N],
      units:  "meters",
      scaleToMeters: 1
    }
  });
  if (ferryResult.ok) {
    try {
      await new GLTFLoader().load({
        fileData: await fetchArrayBuffer("../../../../models/Ferry/gltf/model.glb"),
        sceneModel: ferryResult.value
      });
    } catch (err) {
      console.error("Error loading Ferry glTF:", err);
      ferryResult.value.destroy();
    }
  }
}

async function fetchArrayBuffer(src) {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Unable to load ${src}: ${response.status} ${response.statusText}`);
  }
  return response.arrayBuffer();
}
