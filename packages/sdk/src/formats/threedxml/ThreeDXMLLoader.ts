import {ModelLoader} from "../ModelLoader";
import {isZip} from "./unzip";
import {parse as parse_v1} from "./versions/v1/parse";

/**
 * Loads Dassault Systèmes **3DXML** (`.3dxml`) files into a
 * {@link model!scene.SceneModel | SceneModel} (tessellated geometry, assembly
 * structure, baked per-instance transforms, flat per-part colours).
 *
 * Like every other format loader it targets a `SceneModel` through the
 * {@link ModelLoader} base, so 3DXML imports as "just another model":
 *
 * ```ts
 * const sceneModel = scene.createModel({ id: "myModel" }).value;
 * fetch("model.3dxml")
 *   .then(r => r.arrayBuffer())
 *   .then(fileData => new ThreeDXMLLoader().load({ fileData, sceneModel }));
 * ```
 *
 * 3DXML is a ZIP of XML documents (a `Manifest.xml`, a product-structure file,
 * and tessellated representation files). The loader unzips it, walks the
 * product structure, and emits one geometry per representation, one mesh per
 * instance (with the assembly transform baked into the mesh matrix), and one
 * object per instance. No {@link model!data.DataModel | DataModel} is produced
 * in this version. Single `"*"` version — the schema is detected from the ZIP
 * container, not a version header.
 */
export class ThreeDXMLLoader extends ModelLoader {
  constructor() {
    super({
      format: "3dxml",
      fileDataType: "arraybuffer",
      parsers: {"*": parse_v1},
      getVersion: (fileData: any): string => (isZip(fileData) ? "*" : ""),
    });
  }
}
