/**
 * <img style="padding:0; padding-top:20px; padding-bottom:30px; height:130px;"
 *      src="https://xeokit.github.io/sdk/docs/assets/obj_logo.png"/>
 *
 * # mtl — Wavefront MTL Loader
 *
 * Loads {@link https://en.wikipedia.org/wiki/Wavefront_.obj_file#Material_template_library | Wavefront MTL}
 * files into a {@link model!scene.SceneModel | SceneModel}.
 *
 * ## Overview
 *
 * `MTLLoader` parses **MTL** files and creates {@link model!scene.SceneMaterial | SceneMaterials}
 * within a {@link model!scene.SceneModel | SceneModel}.
 *
 * MTL files define surface appearance for OBJ geometry, including:
 *
 * - diffuse, ambient, and specular colors
 * - texture maps (eg. diffuse maps)
 * - transparency and illumination models
 *
 * This loader is typically used alongside an {@link formats!obj.OBJLoader | OBJLoader} that references the same materials.
 *
 * ---
 *
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class MTLLoader {
 *       +format : "MTL"
 *       +load(params, options?) Promise~void~
 *     }
 *     class MTLExporter {
 *       +format : "MTL"
 *       +write(params, options?) Promise~string~
 *     }
 *     class ModelLoader {
 *       <<formats>>
 *     }
 *     class ModelExporter {
 *       <<formats>>
 *     }
 *     ModelLoader <|-- MTLLoader
 *     ModelExporter <|-- MTLExporter
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **Wavefront MTL** — material companion to {@link formats!obj | OBJ}.
 * - **Diffuse + ambient + specular** — classic Phong material
 *   parameters mapped to PBR equivalents in
 *   {@link model!scene.SceneMaterial | SceneMaterial}.
 * - **Texture map support** — `map_Kd`, `map_Ks`, `map_Bump`, etc.
 *   loaded into matching {@link model!scene.SceneTexture | SceneTextures}.
 *
 * ---
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ---
 *
 * ## Example: loading an MTL file
 *
 * ```ts
 * import { Scene } from "@xeokit/sdk/model/scene";
 * import { Viewer } from "@xeokit/sdk/viewing/viewer";
 * import { WebGLRenderer } from "@xeokit/sdk/viewing/renderers/webGL";
 * import { ModelNavigationController } from "@xeokit/sdk/viewing/navigation/model";
 * import { MTLLoader } from "@xeokit/sdk/formats/mtl";
 *
 * const handleError = (error: string) => {
 *   console.error(error);
 * };
 *
 * // 1) Create scene + viewer
 * const scene = new Scene();
 * const viewer = new Viewer({ scene });
 * new WebGLRenderer({ viewer });
 *
 * // 2) Create a view
 * const viewResult = viewer.createView({
 *   id: "myView",
 *   elementId: "myCanvas"
 * });
 *
 * if (!viewResult.ok) {
 *   handleError(viewResult.error);
 *   return;
 * }
 *
 * const view = viewResult.value;
 *
 * // 3) Enable camera control
 * new ModelNavigationController(view, {});
 *
 * // 4) Create a SceneModel to receive materials
 * const sceneModelResult = scene.createModel({ id: "myModel" });
 *
 * if (!sceneModelResult.ok) {
 *   handleError(sceneModelResult.error);
 *   return;
 * }
 *
 * const sceneModel = sceneModelResult.value;
 *
 * // 5) Create loader
 * const mtlLoader = new MTLLoader();
 *
 * // 6) Load MTL file
 * fetch("model.mtl")
 *   .then(r => r.text())
 *   .then(fileData => {
 *     return mtlLoader.load({
 *       fileData,
 *       sceneModel
 *     });
 *   })
 *   .then(() => {
 *     // Materials are now available on the SceneModel
 *   })
 *   .catch(err => {
 *     sceneModel.destroy();
 *     handleError(`Error loading MTL -> ${err}`);
 *   });
 * ```
 *
 * ---
 *
 * ## Notes
 *
 * - MTL files define **materials only**, not geometry.
 * - Typically used together with OBJ loading workflows.
 * - Materials are attached to the provided {@link model!scene.SceneModel | SceneModel}.
 *
 * @module mtl
 */
export * from "./MTLLoader";
export * from "./MTLExporter";
