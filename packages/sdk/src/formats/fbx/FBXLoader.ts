/**
 * Loads a binary Autodesk FBX file into a {@link model!scene.SceneModel | SceneModel}.
 *
 * ```javascript
 * import {FBXLoader} from "@xeokit/sdk/formats/fbx";
 *
 * const loader = new FBXLoader();
 * await loader.load({ fileData: arrayBuffer, sceneModel });
 * ```
 *
 * v1 handles **binary** FBX: mesh geometry (positions, triangulated polygons,
 * normals, UVs), each Model's local TRS transform, and basic diffuse material
 * colour. ASCII FBX, animation, skinning, textures, and NURBS are not yet
 * supported. FBX is Y-up or Z-up per its GlobalSettings — set the SceneModel's
 * `coordinateSystem` to orient the result for your scene.
 */
import {ModelLoader} from "../ModelLoader";
import {isBinaryFBX} from "./fbxBinaryReader";
import {parse as parseBinary} from "./versions/binary/parse";

export class FBXLoader extends ModelLoader {
  constructor() {
    super({
      format: "fbx",
      fileDataType: "arraybuffer",
      parsers: {
        binary: parseBinary,
      },
      // The only "version" we recognise is the binary variant; ASCII FBX (and
      // anything else) returns "" → the base loader reports it as unsupported.
      getVersion: (fileData: any): string =>
        (fileData instanceof ArrayBuffer && isBinaryFBX(fileData)) ? "binary" : "",
    });
  }
}
