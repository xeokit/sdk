/**
 * # Fix Strategies
 *
 * Built-in {@link Fix} catalog. Each file exports a single
 * `*Fix` constant — one per remediation — so each is easy
 * to find in an IDE's "go to symbol" / file tree, and each can be
 * registered, replaced, or omitted independently.
 *
 * Strategies in this directory ship pre-registered into
 * {@link DEFAULT_FIX_REGISTRY}. To add your own, either:
 *
 * ```ts
 * // Mutate the singleton — applies to every applyFixes() call.
 * import {DEFAULT_FIX_REGISTRY, Fix} from "@xeokit/sdk/quality/sceneModel";
 *
 * const myFix: Fix = {
 *   codes: ["MY_CUSTOM_CODE"],
 *   description: "...",
 *   apply(issue, sceneModel) { ... },
 * };
 * DEFAULT_FIX_REGISTRY.register(myFix);
 * ```
 *
 * ```ts
 * // Or build a fresh registry — leaves the default untouched.
 * import {FixRegistry, mergeDuplicateGeometries, applyFixes} from "@xeokit/sdk/quality/sceneModel";
 *
 * const registry = new FixRegistry();
 * registry.register(mergeDuplicateGeometries);   // pick what you want
 * registry.register(myFix);
 *
 * applyFixes({sceneModel, report, registry});
 * ```
 *
 * @module sceneModelInspector/fixes
 */

export * from "./pruneDanglingMeshRefs";
export * from "./dropUnusedMaterial";
export * from "./dropUnusedTexture";
export * from "./dropUnusedTransform";
export * from "./dropIdentityTransform";
export * from "./mergeDuplicateGeometries";
export * from "./mergeSimilarGeometries";
export * from "./splitDenseGeometry";
export * from "./splitLargeGeometry";
export * from "./splitOversizedGeometry";
export * from "./dropDegenerateTriangles";
export * from "./compactUnusedVertices";
export * from "./mergeDuplicateVertices";
export * from "./downgradeNonWatertight";
export * from "./dropDuplicateObject";
export * from "./recenterGeometry";
export * from "./unifyTriangleWinding";
export * from "./tightenAabb";
export * from "./dropDuplicateTriangles";
