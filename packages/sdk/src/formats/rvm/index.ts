/**
 * # rvm — AVEVA RVM Importer / Exporter
 *
 * ---
 *
 * **Loads AVEVA RVM v2 binary files (the plant-design format produced
 * by PDMS / E3D) into a `SceneModel`, and exports a `SceneModel` back
 * out as a minimal RVM v2 file.**
 *
 * ---
 *
 * <br>
 *
 * ## Shape
 *
 * ```mermaid
 * classDiagram
 *     direction TB
 *     class RVMLoader {
 *       +format : "RVM"
 *       +load(params, options?) Promise~void~
 *     }
 *     class RVMExporter {
 *       +format : "RVM"
 *       +write(params, options?) Promise~ArrayBuffer~
 *     }
 *     class ChunkReader / ChunkWriter {
 *       <<low-level helpers>>
 *     }
 *     class RVMPrimitive {
 *       <<wire format>>
 *     }
 *     class ModelLoader {
 *       <<formats>>
 *     }
 *     class ModelExporter {
 *       <<formats>>
 *     }
 *     ModelLoader <|-- RVMLoader
 *     ModelExporter <|-- RVMExporter
 *     RVMLoader ..> ChunkReader : reads
 *     RVMExporter ..> ChunkWriter : writes
 * ```
 *
 * <br>
 *
 * ## Features
 *
 * - **AVEVA RVM v2** — plant-design and process-piping format
 *   common in oil-and-gas / power-plant CAD pipelines.
 * - **Implicit primitives** — RVM stores parametric primitives
 *   (boxes, cylinders, spheres, snouts, tori, dish heads); the
 *   loader tessellates them via {@link model!procgen.buildGeometry | procgen}.
 * - **Round-trip** — exporter writes one `CNTB` per SceneObject +
 *   one Box `PRIM` per SceneMesh, preserving placement + hierarchy
 *   (geometry compressed to per-mesh AABBs).
 * - **Low-level escape hatch** — {@link ChunkReader} /
 *   {@link ChunkWriter} / {@link RVMPrimitive} are exported for
 *   hand-crafted RVM bytes (sample fixtures, fuzzers, tooling).
 *
 * ## Loader
 *
 * Walks the chunk hierarchy (`HEAD` / `MODL` / `CNTB` / `PRIM` /
 * `CNTE` / `END`) and decodes:
 *
 *   - Box, Cylinder, Sphere — procedurally built via `procgen`.
 *   - Pyramid (4-sided frustum, with optional top offset).
 *   - Snout (truncated cone — radii decoded; shears/offsets TODO).
 *   - RectTorus (rectangular cross-section sweep, with end caps for
 *     partial sweep angles).
 *   - CircTorus (donut sweep, with end caps for partial sweep angles).
 *   - EllipDish, SpherDish (vessel-head caps).
 *   - FacetGroup (polygon soup; outer contours fan-triangulated, holes
 *     ignored — good enough for visualisation, real triangulation
 *     needed for cut-outs).
 *   - Line — recognised but skipped (1D data; the renderer is
 *     triangle-only on this code path).
 *   - The paired `.attr` / `.att` text-attribute file is not yet
 *     consumed.
 *
 * ## Exporter
 *
 * Writes a minimal RVM v2 file with one `CNTB` per `SceneObject` and
 * one Box `PRIM` per `SceneMesh`. Every geometry is emitted as its
 * AABB, so the result preserves placement + hierarchy but discards
 * triangle-mesh detail. RVM is primarily a write-once plant-design
 * output format; a fuller exporter would need to detect which scene
 * meshes originated as RVM primitives and emit them as such.
 *
 * @example
 * ```ts
 * import { RVMLoader, RVMExporter } from "@xeokit/sdk/formats/rvm";
 *
 * const loader = new RVMLoader();
 * await loader.load({ fileData: rvmBytes, sceneModel });
 *
 * const exporter = new RVMExporter();
 * const out = await exporter.write({ sceneModel });
 * ```
 *
 * @module rvm
 */
export * from "./RVMLoader";
export * from "./RVMExporter";
// Low-level helpers — exposed so applications can hand-craft RVM bytes
// (sample / test fixtures, fuzzers, ...).
export {ChunkReader} from "./versions/v2/chunkReader";
export {ChunkWriter} from "./versions/v2/chunkWriter";
export {RVMPrimitive} from "./versions/v2/RVMPrimitive";
