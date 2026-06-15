import {ModelLoader} from "../ModelLoader";
import type {ModelParseParams} from "../ModelParseParams";
import {parseSplat} from "./versions/v1/parseSplat";
import {GaussianSplatsPrimitive} from "../../base/constants";

/**
 * Loads compact `.splat` 3D-Gaussian-Splatting files into a
 * {@link model!scene.SceneModel | SceneModel} (baked RGB, no SH).
 *
 * Like every other format loader it targets a `SceneModel` through the
 * {@link ModelLoader} base, so splats import as "just another model":
 *
 * ```ts
 * const sceneModel = scene.createModel({ id: "splatScene" }).value;
 * fetch("scene.splat")
 *   .then(r => r.arrayBuffer())
 *   .then(fileData => new GaussianSplatLoader().load({ fileData, sceneModel }));
 * ```
 *
 * Produces one {@link base!constants.GaussianSplatsPrimitive | GaussianSplatsPrimitive}
 * geometry + a mesh + an object. Headerless format ⇒ a single `"*"` version.
 *
 * Splats load in their native `.splat`/COLMAP frame (authored Y-down). To stand a
 * scene upright in the SDK's Z-up world, configure the source frame on the
 * SceneModel's {@link model!scene.SceneModel.coordinateSystem | coordinateSystem}
 * at creation rather than baking a correction into the geometry — the SDK
 * premultiplies the model's meshes into the Scene frame for you.
 */
export class GaussianSplatLoader extends ModelLoader {
  constructor() {
    super({
      format: "splat",
      fileDataType: "arraybuffer",
      getVersion: () => "*",
      parsers: {"*": parseSplatModel},
    });
  }
}

async function parseSplatModel(params: ModelParseParams): Promise<void> {
  const sceneModel = params.sceneModel;
  if (!sceneModel) {
    throw new Error("[GaussianSplatLoader] params.sceneModel is required");
  }

  const {positions, scales, colors, rotations} = parseSplat(params.fileData);

  // parseSplat decodes the rotation bytes in file order (w, x, y, z under the
  // `.splat` convention). SceneGeometry stores quaternions as xyzw, so reorder.
  const rotationsXYZW = new Float32Array(rotations.length);
  for (let i = 0; i < rotations.length; i += 4) {
    rotationsXYZW[i]     = rotations[i + 1]; // x
    rotationsXYZW[i + 1] = rotations[i + 2]; // y
    rotationsXYZW[i + 2] = rotations[i + 3]; // z
    rotationsXYZW[i + 3] = rotations[i];     // w
  }

  const geom = sceneModel.createGeometry({
    id: "splats",
    primitive: GaussianSplatsPrimitive,
    positions,
    scales,
    rotations: rotationsXYZW,
    colorsCompressed: colors,
  });
  if (geom.ok === false) {
    throw new Error(geom.error);
  }
  const mesh = sceneModel.createMesh({id: "splatMesh", geometryId: "splats"});
  if (mesh.ok === false) {
    throw new Error(mesh.error);
  }
  const obj = sceneModel.createObject({id: "splatObject", meshIds: ["splatMesh"]});
  if (obj.ok === false) {
    throw new Error(obj.error);
  }
}
