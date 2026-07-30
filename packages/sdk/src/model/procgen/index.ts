/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # Procedural Generation
 *
 * Helpers for building procedural scene data.
 *
 * Submodules:
 *
 * - {@link geometry} - geometry builders for `SceneModel.createGeometry`.
 * - {@link materials} - PBR material painters for `SceneModel.createTexture`
 *   and `SceneModel.createMaterial`.
 * - {@link environments} - environment images for IBL.
 * - {@link treeGenerator} - procedural tree `SceneModel` generator.
 *
 * ## Example
 *
 * ```javascript
 * import { Scene } from "@xeokit/sdk/model/scene";
 * import { sRGBEncoding, LinearEncoding, TrianglesPrimitive } from "@xeokit/sdk/base/constants";
 * import { buildSphere } from "@xeokit/sdk/model/procgen/geometry";
 * import { paintCopper } from "@xeokit/sdk/model/procgen/materials";
 *
 * const scene = new Scene();
 * const sceneModelResult = scene.createModel({ id: "demo" });
 * if (!sceneModelResult.ok) throw new Error(sceneModelResult.error);
 *
 * const sceneModel = sceneModelResult.value;
 * const sphereResult = buildSphere({ radius: 1 });
 * if (!sphereResult.ok) throw new Error(sphereResult.error);
 *
 * const sphere = sphereResult.value;
 *
 * sceneModel.createGeometry({
 *   id: "sphere",
 *   primitive: TrianglesPrimitive,
 *   positions: sphere.positions,
 *   normals: sphere.normals,
 *   uvs: sphere.uv,
 *   indices: sphere.indices
 * });
 *
 * const maps = paintCopper(256);
 * sceneModel.createTexture({ id: "copperColor", imageData: maps.color, encoding: sRGBEncoding });
 * sceneModel.createTexture({ id: "copperNormal", imageData: maps.normal, encoding: LinearEncoding });
 * sceneModel.createTexture({ id: "copperMR", imageData: maps.mr, encoding: LinearEncoding });
 *
 * sceneModel.createMaterial({
 *   id: "copper",
 *   colorTextureId: "copperColor",
 *   normalsTextureId: "copperNormal",
 *   metallicRoughnessTextureId: "copperMR"
 * });
 *
 * sceneModel.createMesh({
 *   id: "sphereMesh",
 *   geometryId: "sphere",
 *   materialId: "copper"
 * });
 *
 * sceneModel.createObject({ id: "sphereObject", meshIds: ["sphereMesh"] });
 * sceneModel.build();
 * ```
 *
 * @module procgen
 */
export * as buildGeometry from "./buildGeometry";
export * as paintMaterials from "./paintMaterials";
export * as paintEnvironments from "./paintEnvironments";
export * as treeGenerator from "./treeGenerator";
