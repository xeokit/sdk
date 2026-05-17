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
 * Three submodules, each a pure-function library returning data ready
 * for the {@link model!scene.SceneModel | SceneModel} builder APIs:
 *
 *   - {@link buildGeometry | buildGeometry} — primitive geometry
 *     builders (boxes, cylinders, spheres, tori, grids, vector text).
 *     Each returns a `GeometryArrays` suitable for
 *     `SceneModel.createGeometry`.
 *   - {@link paintMaterials | paintMaterials} — tileable PBR texture
 *     painters (masonry, interior finishes, metals, glass). Each
 *     returns a `MaterialMaps` triple of `MaterialPixelBuffer`s
 *     suitable for `SceneModel.createTexture` +
 *     `SceneModel.createMaterial`.
 *   - {@link paintEnvironments | paintEnvironments} — equirectangular
 *     environment images for image-based lighting, suitable for
 *     `IBL.setEnvironmentImage`.
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class buildGeometry {
 *       <<sub-module>>
 *       buildBox(params)
 *       buildSphere(params)
 *       buildCylinder(params)
 *       buildTorus(params)
 *       buildGrid(params)
 *       buildVectorText(params)
 *     }
 *     class paintMaterials {
 *       <<sub-module>>
 *       paintBrick(size)
 *       paintConcrete(size)
 *       paintPolSteel(size)
 *       paintGlass(size)
 *       paintHeatMap(size, ramp, scalars)
 *       ...
 *     }
 *     class paintEnvironments {
 *       <<sub-module>>
 *       paintStudio()
 *       paintHorizon()
 *       paintOvercast()
 *       ...
 *     }
 *     class GeometryArrays {
 *       +positions / normals / uvs / indices
 *     }
 *     class MaterialMaps {
 *       +color  : MaterialPixelBuffer
 *       +normal : MaterialPixelBuffer
 *       +mr     : MaterialPixelBuffer
 *     }
 *     class EnvironmentImage {
 *       +data / width / height
 *     }
 *     class SceneModel {
 *       <<scene>>
 *       +createGeometry(args)
 *       +createTexture(args)
 *       +createMaterial(args)
 *     }
 *     buildGeometry ..> GeometryArrays : returns
 *     paintMaterials ..> MaterialMaps : returns
 *     paintEnvironments ..> EnvironmentImage : returns
 *     GeometryArrays ..> SceneModel : feed createGeometry
 *     MaterialMaps ..> SceneModel : feed createTexture / createMaterial
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Pure-function builders** — no scene side-effects; each call
 *   returns plain typed arrays the caller hands to the SceneModel
 *   builder. Same input → same output, easy to test, easy to
 *   memoise.
 * - **Curated catalogs** — geometry primitives, materials, and
 *   environments are organised into named entries so application
 *   menus can list them with metadata.
 * - **Tileable PBR painters** — the `paintMaterials` painters
 *   produce a colour + normal + metallic-roughness triple at any
 *   square texture size. Outputs are seamless under tiling, with
 *   engineering hatch metadata attached per painter for use by
 *   {@link presentations!sectionCaps | sectionCaps} and
 *   {@link presentations!materials | materials}.
 * - **Heat-map painter** — `paintHeatMap` takes a per-vertex scalar
 *   field + colour ramp and emits a heat-map texture together with
 *   planar UVs; consumed by
 *   {@link presentations!heatmaps | heatmaps}.
 * - **Equirect environments** — `paintEnvironments` returns
 *   pre-painted equirectangular RGBA images suitable for IBL prefilter.
 *
 * <br>
 *
 * # Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * # Usage
 *
 * Build a single textured sphere in a {@link model!scene.SceneModel | SceneModel}:
 *
 * ```javascript
 * import { Scene } from "@xeokit/sdk/model/scene";
 * import { sRGBEncoding, LinearEncoding, TrianglesPrimitive } from "@xeokit/sdk/base/constants";
 * import { buildSphere } from "@xeokit/sdk/model/procgen/geometry";
 * import { paintCopper } from "@xeokit/sdk/model/procgen/materials";
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
