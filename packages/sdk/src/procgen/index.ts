/**
 * <img style="padding:0px; padding-top:30px; padding-bottom:10px; height:130px;" src="https://xeokit.github.io/sdk/docs/assets/xeokit_logo_mesh.png"/>
 *
 * # xeokit Procedural Generation
 *
 * ---
 *
 * ***Functions to procedurally generate 3D content***
 *
 * ---
 *
 * Three submodules:
 *
 *   - {@link geometry} — primitive geometry builders (boxes, cylinders,
 *     spheres, tori, grids, vector text). Each returns a
 *     `GeometryArrays` suitable for `SceneModel.createGeometry`.
 *   - {@link materials} — tileable PBR texture painters (masonry,
 *     interior finishes, metals, glass). Each returns a
 *     `MaterialMaps` triple of `MaterialPixelBuffer`s suitable for
 *     `SceneModel.createTexture` and `SceneModel.createMaterial`.
 *   - {@link environments} — equirectangular environment images for
 *     image-based lighting, suitable for `IBL.setEnvironmentImage`.
 *
 * # Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * # Usage
 *
 * Build a single textured sphere in a {@link scene!SceneModel | SceneModel}:
 *
 * ```javascript
 * import { Scene } from "@xeokit/sdk/scene";
 * import { sRGBEncoding, LinearEncoding, TrianglesPrimitive } from "@xeokit/sdk/constants";
 * import { buildSphere } from "@xeokit/sdk/procgen/geometry";
 * import { paintCopper } from "@xeokit/sdk/procgen/materials";
 *
 * const scene = new Scene();
 *
 * const sceneModelResult = scene.createModel({ id: "demo" });
 *
 * if (!sceneModelResult.ok) {
 *   console.error(sceneModelResult.error);
 *   // ..handle error
 * }
 *
 * const sceneModel = sceneModelResult.value;
 *
 * // 1) Build a unit sphere with smooth normals and UVs.
 *
 * const sphereResult = buildSphere({ radius: 1 });
 *
 * if (!sphereResult.ok) {
 *   console.error(sphereResult.error);
 *   // ..handle error
 * }
 *
 * const sphere = sphereResult.value;
 *
 * sceneModel.createGeometry({
 *   id: "sphere",
 *   primitive: TrianglesPrimitive,
 *   positions: sphere.positions,
 *   normals:   sphere.normals,
 *   uvs:       sphere.uv,
 *   indices:   sphere.indices
 * });
 *
 * // 2) Paint a 256x256 copper PBR set, upload each map, and bind them
 * //    into a SceneMaterial. Colour is sRGB; normal and metallic-
 * //    roughness are linear.
 *
 * const maps = paintCopper(256);
 *
 * sceneModel.createTexture({ id: "copperColor",  imageData: maps.color,  encoding: sRGBEncoding });
 * sceneModel.createTexture({ id: "copperNormal", imageData: maps.normal, encoding: LinearEncoding });
 * sceneModel.createTexture({ id: "copperMR",     imageData: maps.mr,     encoding: LinearEncoding });
 *
 * sceneModel.createMaterial({
 *   id:                         "copper",
 *   colorTextureId:             "copperColor",
 *   normalsTextureId:           "copperNormal",
 *   metallicRoughnessTextureId: "copperMR"
 * });
 *
 * // 3) Create a mesh referencing the geometry and material, and wrap
 * //    it in a SceneObject (the scene-graph entity).
 *
 * sceneModel.createMesh({
 *   id:         "sphereMesh",
 *   geometryId: "sphere",
 *   materialId: "copper"
 * });
 *
 * sceneModel.createObject({ id: "sphereObject", meshIds: ["sphereMesh"] });
 *
 * sceneModel.build();
 * ```
 *
 * @module procgen
 */
export * as buildGeometry from "./buildGeometry";
export * as paintMaterials from "./paintMaterials";
export * as paintEnvironments from "./paintEnvironments";
