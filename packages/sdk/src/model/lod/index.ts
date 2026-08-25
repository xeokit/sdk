/**
 * # Model LOD Shell Generation
 *
 * The `model.lod` module builds coarse triangle shells from existing
 * {@link model!scene.SceneObject | SceneObject}s and can install those shells
 * as SceneModel representation sets. A shell is generated in model space from
 * source triangle geometry, then referenced by a shell representation in the
 * same SceneModel as the detailed source objects.
 *
 * Shell generation is offline or setup-time work. It does not change scene
 * visibility and does not install any camera-driven switching. Use
 * {@link createShellRep | createShellRep} to author representation sets, and
 * {@link viewing!lod.RepresentationLODSelector | RepresentationLODSelector}
 * when you want runtime per-view LOD switching over those authored
 * representations.
 *
 * ## Pipeline
 *
 * ```mermaid
 * flowchart TD
 *     A["SceneObject[]"] --> B["collectShellSourceTriangles"]
 *     B --> C["voxelizeShellTriangles"]
 *     C --> D["floodShellExterior"]
 *     D --> E["extractShellMesh"]
 *     E --> F{"surfaceNets?"}
 *     F -- yes --> G["smoothShellMesh"]
 *     F -- no --> H["simplifyShellMesh"]
 *     G --> H
 *     H --> I["ShellGeneratorResult"]
 * ```
 *
 * ## Usage
 *
 * Generate a shell directly from loaded scene objects:
 *
 * ```javascript
 * import {ShellGenerator} from "@xeokit/sdk/model/lod";
 *
 * const generator = new ShellGenerator();
 * const result = generator.generate(objects, {
 *   shellResolution: 64,
 *   extraction: "surfaceNets",
 *   smoothing: {
 *     iterations: 4
 *   },
 *   simplification: {
 *     targetTriangleCount: 5000
 *   }
 * });
 *
 * console.log(result.positions, result.indices, result.stats);
 * ```
 *
 * Reuse collected triangles when comparing multiple shell settings:
 *
 * ```javascript
 * import {
 *   collectShellSourceTriangles,
 *   generateShellFromTriangles
 * } from "@xeokit/sdk/model/lod";
 *
 * const source = collectShellSourceTriangles(objects);
 * const coarse = generateShellFromTriangles(source, {shellResolution: 32});
 * const smooth = generateShellFromTriangles(source, {
 *   shellResolution: 96,
 *   extraction: "surfaceNets"
 * });
 * ```
 *
 * Create a SceneModel representation set from source objects:
 *
 * ```javascript
 * import {createShellRep} from "@xeokit/sdk/model/lod";
 *
 * const result = createShellRep({
 *   model: sceneModel,
 *   id: "tower-core-lod",
 *   objectIds: ["wall-01", "slab-01", "column-01"],
 *   generation: {
 *     shellResolution: 64,
 *     extraction: "surfaceNets"
 *   },
 *   selection: {
 *     strategy: "projectedSize",
 *     hysteresisPixels: 16
 *   },
 *   detailedRange: {
 *     minPixels: 128
 *   },
 *   shellRange: {
 *     maxPixels: 96
 *   }
 * });
 * ```
 *
 * @module lod
 */
export * from "./ShellGenerationParams";
export * from "./ShellGenerationStats";
export * from "./ShellGenerator";
export * from "./ShellRep";
export * from "./ShellRepParams";
