import {ModelExporter} from "../ModelExporter";
import {encode as encode_v2} from "./versions/v2/encode";

/**
 * Exports a {@link model!scene.SceneModel | SceneModel} to a minimal AVEVA
 * RVM v2 file.
 *
 * The encoder writes one `CNTB` per `SceneObject` and one Box `PRIM`
 * per `SceneMesh`, sized from the geometry's AABB. This is a common-
 * denominator round-trip — AVEVA tools can ingest the file but every
 * geometry comes back as its bounding box. Use this for hierarchy /
 * placement-only exchanges; for visual fidelity stick to glTF / XGF.
 *
 * @example
 * ```ts
 * const exporter = new RVMExporter();
 * const buffer = await exporter.write({ sceneModel });
 * ```
 */
export class RVMExporter extends ModelExporter {
  constructor() {
    super({
      format: "RVM",
      fileDataType: "arraybuffer",
      encoders: {
        "2.0.0": encode_v2
      },
      defaultVersion: "2.0.0"
    });
  }
}
