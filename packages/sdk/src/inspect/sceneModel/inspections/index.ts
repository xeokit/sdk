/**
 * # Inspections
 *
 * Built-in {@link Inspection} catalog. Each file exports a single
 * `*Inspection` constant — one per topical concern — so each is
 * easy to find in an IDE's "go to symbol" / file tree, and each can
 * be registered, replaced, or omitted independently.
 *
 * Inspections in this directory ship pre-registered into
 * {@link DEFAULT_INSPECTION_REGISTRY}. Plugins typically register
 * their own inspections into that singleton on import. Tests / one-
 * off pipelines build a fresh {@link InspectionRegistry} instead.
 *
 * ```ts
 * // Mutate the singleton — applies to every inspectSceneModel() call.
 * import {DEFAULT_INSPECTION_REGISTRY, Inspection} from "@xeokit/sdk/demo";
 *
 * const myInspection: Inspection = {
 *   codes: ["MyApp/STALE_PROPERTY_SET"],
 *   description: "Find deprecated property sets",
 *   run(sceneModel) { ... },
 * };
 * DEFAULT_INSPECTION_REGISTRY.register(myInspection);
 * ```
 *
 * ```ts
 * // Or build a fresh registry — leaves the default untouched.
 * import {InspectionRegistry, geometryDataIntegrity, inspectSceneModel} from "@xeokit/sdk/demo";
 *
 * const registry = new InspectionRegistry();
 * registry.register(geometryDataIntegrity);   // pick what you want
 * registry.register(myInspection);
 *
 * inspectSceneModel({sceneModel, registry});
 * ```
 *
 * @module sceneModelInspector/inspections
 */

export * from "./geometryDataIntegrity";
export * from "./meshReferences";
export * from "./objectMeshReferences";
export * from "./transformParentCycles";
export * from "./unusedResources";
export * from "./identityTransforms";
export * from "./duplicateGeometries";
export * from "./similarGeometries";
export * from "./denseGeometries";
export * from "./geometryArrayLengths";
export * from "./largeGeometries";
export * from "./geometryQuality";
export * from "./objectPlacement";
export * from "./textureDimensions";
export * from "./farFromOriginGeometries";
