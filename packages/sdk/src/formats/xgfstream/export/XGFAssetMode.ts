/**
 * XGF v2 chunk role.
 *
 * - `full` writes a self-contained visual model.
 * - `assetLibrary` writes reusable geometry/material/texture assets only.
 * - `referencesOnly` writes transforms, meshes and objects that reference
 *   previously-loaded assets by stable ID.
 */
export type XGFAssetMode = "full" | "assetLibrary" | "referencesOnly";
