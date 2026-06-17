import {ModelExporter} from "../ModelExporter";
import {encode as encode_v1} from "./versions/v1/encode";

/**
 * Exports a {@link model!scene.SceneModel | SceneModel}'s triangle geometry to a
 * Dassault Systèmes **3DXML** (`.3dxml`) file — the inverse of
 * {@link ThreeDXMLLoader}.
 *
 * ```ts
 * const fileData = await new ThreeDXMLExporter().write({ sceneModel });
 * // fileData is an ArrayBuffer of .3dxml (ZIP) bytes
 * ```
 *
 * Each triangle {@link model!scene.SceneMesh | SceneMesh} is written as a part:
 * its (dequantized) geometry goes into a `.3DRep` representation document, and
 * the product structure places it under a single root with the mesh's matrix as
 * the instance `RelativeMatrix`. Round-trips with the loader: a model exported
 * and re-imported reproduces the same triangles, transforms and flat colours.
 *
 * v1 exports triangle-family geometry only (no lines / points / splats), one
 * representation per mesh (no instancing dedup), and no semantic data. Single
 * `"*"` version — 3DXML is detected from its ZIP container, not a version header.
 */
export class ThreeDXMLExporter extends ModelExporter {
  constructor() {
    super({
      format: "3dxml",
      fileDataType: "arraybuffer",
      encoders: {"*": encode_v1},
      defaultVersion: "*",
    });
  }
}
