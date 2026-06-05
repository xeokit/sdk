/**
 * # FBX
 *
 * Loads binary Autodesk FBX (`.fbx`) files into a
 * {@link model!scene.SceneModel | SceneModel} via {@link FBXLoader}.
 *
 * v1 covers binary FBX: mesh geometry (positions, polygon triangulation,
 * normals, UVs), per-Model local transforms, and basic diffuse materials,
 * wired from the FBX object/connection graph. ASCII FBX, animation, skinning,
 * textures, and NURBS are not yet supported.
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
 * @module fbx
 */
export {FBXLoader} from "./FBXLoader";
export {isBinaryFBX, readFBXBinary} from "./fbxBinaryReader";
export type {FBXNode} from "./FBXNode";
