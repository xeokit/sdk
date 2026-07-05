/**
 * <img style="padding:10px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_components_icon.png"/>
 *
 * # FBX
 *
 * Loads binary Autodesk FBX (`.fbx`) files into a
 * {@link model!scene.SceneModel | SceneModel} via {@link FBXLoader}, and writes
 * a SceneModel back out via {@link FBXExporter}.
 *
 * v1 covers binary FBX: mesh geometry (positions, polygon triangulation,
 * normals, UVs), per-Model local transforms, basic diffuse materials, and
 * embedded diffuse textures, wired from the FBX object/connection graph. ASCII
 * FBX, animation, skinning, external-file textures, and NURBS are not yet
 * supported.
 *
 * Drive {@link FBXLoader} directly — fetch the bytes, create a SceneModel, and
 * hand both to the loader:
 *
 * ```javascript
 * import {FBXLoader} from "@xeokit/sdk/formats/fbx";
 *
 * const fileData = await (await fetch("model.fbx")).arrayBuffer();
 * const sceneModel = scene.createModel({id: "myModel"}).value;
 * await new FBXLoader().load({fileData, sceneModel});
 * ```
 *
 * Export a SceneModel back to FBX with {@link FBXExporter}:
 *
 * ```javascript
 * import {FBXExporter} from "@xeokit/sdk/formats/fbx";
 *
 * const arrayBuffer = await new FBXExporter().write({sceneModel});
 * ```
 *
 * @module fbx
 * @document ./README.md
 */
export {FBXLoader} from "./FBXLoader";
export {FBXExporter} from "./FBXExporter";
