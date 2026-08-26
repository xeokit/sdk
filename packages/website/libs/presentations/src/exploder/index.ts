/**
 * # Scene Model Exploder
 *
 * The `exploder` module offsets each {@link model!scene.SceneMesh | SceneMesh}
 * in a {@link model!scene.SceneModel | SceneModel} away from the model centre.
 * The offset is controlled by a numeric factor and is written to
 * `mesh.matrix`; geometry and materials are not changed.
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class SceneModelExploder {
 *       +factor : number
 *       +rebuild() this
 *       +setFactor(f) this
 *       +reset() this
 *       +destroy()
 *     }
 *     class SceneModelExploderParams {
 *       +scene          : Scene
 *       +sceneModel     : SceneModel
 *       +collisionIndex : SceneCollisionIndex
 *       +minFactor?     : number
 *       +maxFactor?     : number
 *       +step?          : number
 *       +initialFactor? : number
 *     }
 *     class ExplodeState {
 *       <<internal>>
 *       +modelCenterInScene : number[]
 *       +meshes             : ExplodeMeshState[]
 *     }
 *     class ExplodeMeshState {
 *       <<internal>>
 *       +mesh          : SceneMesh
 *       +centerInScene : number[]
 *       +baseMatrix    : number[]
 *     }
 *     class Scene {
 *       <<scene>>
 *     }
 *     class SceneModel {
 *       <<scene>>
 *     }
 *     class SceneCollisionIndex {
 *       <<collision>>
 *       +getMeshAABB(mesh)
 *     }
 *     class HTMLSlider {
 *       <<DOM>>
 *     }
 *     SceneModelExploder ..> SceneModelExploderParams : reads
 *     SceneModelExploder o-- Scene : reads coord system
 *     SceneModelExploder o-- SceneModel : displaces meshes
 *     SceneModelExploder o-- SceneCollisionIndex : reads AABBs
 *     SceneModelExploder "1" *-- "1" ExplodeState : cached rest pose
 *     ExplodeState "1" *-- "*" ExplodeMeshState
 *     SceneModelExploder ..> HTMLSlider : mounts on document.body
 * ```
 *
 * <br>
 *
 * ## How it works
 *
 * ```mermaid
 * flowchart TD
 *     A[constructor] --> B[mount HTML slider]
 *     B --> C{initialFactor != 0?}
 *     C -- yes --> D[setFactor]
 *     C -- no --> E[idle]
 *     D --> F[rebuild — walk meshes, cache rest pose]
 *     F --> G[per mesh: mesh.matrix = baseMatrix + dir × factor]
 *     E -- user drags --> D
 *     G --> H[viewer re-renders]
 *     H -- factor = 0 --> I[reset — restore baseMatrix]
 * ```
 *
 * <br>
 *
 * ## Behavior
 *
 * - **One radial direction per mesh** — the direction is from the model
 *   centre to the mesh's world-AABB centre (read once via the supplied
 *   {@link spatial!collision.SceneCollisionIndex | SceneCollisionIndex}).
 * - **Cross-coordinate-system aware** — the displacement vector is
 *   computed in the {@link model!scene.Scene | Scene}'s world frame and
 *   transformed into the SceneModel's local frame before being
 *   applied, so a SceneModel with its own non-trivial
 *   {@link model!scene.CoordinateSystem | CoordinateSystem} explodes
 *   correctly.
 * - **One-shot rebuild** — the rest pose (per-mesh base matrix +
 *   centre) is cached at first
 *   {@link SceneModelExploder.setFactor | setFactor} (or explicit
 *   {@link SceneModelExploder.rebuild | rebuild}), then reused on
 *   subsequent slider ticks.
 * - **Pure transform displacement** — touches only `mesh.matrix`;
 *   geometry, materials, and bindings are untouched. `reset()`
 *   restores the rest pose.
 * - **Built-in HTML slider** — a floating control mounts on
 *   `document.body` at construction; drag it to drive
 *   {@link SceneModelExploder.factor | factor} live. Style and
 *   placement are inline so the control is self-contained.
 * - **Rebuild on model swap** — when the underlying SceneModel
 *   changes meshes or materials at runtime (e.g. after
 *   `applyHeatMapMaterials` swaps every mesh), call
 *   {@link SceneModelExploder.rebuild | rebuild} to recapture the
 *   new rest pose.
 *
 * ## Usage
 *
 * ### 1) Import the entry point
 *
 * ```javascript
 * import { SceneModelExploder } from "../libs/presentations/dist/index.js";
 * ```
 *
 * <br>
 *
 * ### 2) Mount the exploder on a SceneModel
 *
 * Pass the {@link model!scene.Scene | Scene}, the target
 * {@link model!scene.SceneModel | SceneModel}, and the
 * {@link spatial!collision.SceneCollisionIndex | SceneCollisionIndex}
 * used to read world AABBs. The HTML slider mounts
 * on `document.body`.
 *
 * ```javascript
 * import {SceneCollisionIndex} from "@xeokit/sdk/spatial/collision";
 *
 * const collisionIndex = new SceneCollisionIndex(scene);
 *
 * const exploder = new SceneModelExploder({
 *   scene,
 *   sceneModel:     scene.models["building"],
 *   collisionIndex
 * });
 * ```
 *
 * <br>
 *
 * ### 3) Drive the factor programmatically
 *
 * Set `factor` (or call {@link SceneModelExploder.setFactor | setFactor})
 * to animate the offset in code. The slider's value follows so the
 * UI stays in sync.
 *
 * ```javascript
 * exploder.setFactor(0.6);                // pop everything out
 * exploder.factor = 1.2;                  // farther
 * exploder.reset();                       // back to rest pose
 * ```
 *
 * <br>
 *
 * ### 4) Tune the slider range
 *
 * Override `minFactor` / `maxFactor` / `step` on construction. The
 * default range is `[0, 2]` with step `0.05`.
 *
 * ```javascript
 * const exploder = new SceneModelExploder({
 *   scene,
 *   sceneModel,
 *   collisionIndex,
 *   minFactor:     0,
 *   maxFactor:     5,
 *   step:          0.1,
 *   initialFactor: 0.3
 * });
 * ```
 *
 * <br>
 *
 * ### 5) Rebuild after a mesh swap
 *
 * Other systems that destroy + recreate meshes on the SceneModel
 * (e.g. `applyHeatMapMaterials`) leave the exploder's cached
 * `baseMatrix` pointing at destroyed meshes. Call
 * {@link SceneModelExploder.rebuild | rebuild} after such a swap to
 * recapture the new rest pose.
 *
 * ```javascript
 * applyHeatMapMaterials({ sceneModel, scalars: temperatureField });
 * exploder.rebuild();
 * ```
 *
 * <br>
 *
 * ### 6) Tearing down
 *
 * {@link SceneModelExploder.destroy | destroy} resets the factor to
 * `0` (so the model lands at rest), unmounts the slider element,
 * and drops the cached state. Idempotent — call it whenever the
 * hosting UI hides or the SceneModel is destroyed.
 *
 * ```javascript
 * exploder.destroy();
 * ```
 *
 * @module exploder
 */
export * from "./SceneModelExploder";
export * from "./SceneModelExploderParams";
