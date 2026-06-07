/**
 * Exports a {@link model!scene.SceneModel | SceneModel} to a binary Autodesk FBX file.
 *
 * ```javascript
 * import {FBXExporter} from "@xeokit/sdk/formats/fbx";
 *
 * const exporter = new FBXExporter();
 * const arrayBuffer = await exporter.write({ sceneModel });
 * ```
 *
 * The inverse of {@link FBXLoader}: writes mesh geometry (positions,
 * triangulated polygons, per-vertex normals + UVs), each mesh's transform as
 * `Lcl Translation / Rotation / Scaling`, diffuse material colour, and embedded
 * diffuse textures. Geometry shared across meshes is instanced via the FBX
 * `Connections` graph. Animation, skinning, external-file textures, and the
 * SceneModel coordinate system aren't written.
 */
import {ModelExporter} from "../ModelExporter";
import {encode as encodeBinary} from "./versions/binary/encode";

export class FBXExporter extends ModelExporter {
  constructor() {
    super({
      format: "fbx",
      fileDataType: "arraybuffer",
      encoders: {
        binary: encodeBinary,
      },
      defaultVersion: "binary",
    });
  }
}
