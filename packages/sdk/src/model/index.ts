/**
 * The **scene graph** (3D geometry, materials, objects) and the **data graph** (semantic entities, relationships,
 * property sets). Both are renderer-agnostic and run identically in the browser and Node. Streaming and procedural
 * authoring live here too.
 *
 * @submodule model
 */
export * as data from "./data";
export * as procgen from "./procgen";
export * as scene from "./scene";
export * as streaming from "./streaming";
