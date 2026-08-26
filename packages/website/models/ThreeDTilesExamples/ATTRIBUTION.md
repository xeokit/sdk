# Test fixtures — 3D Tiles samples

These tilesets are vendored from [CesiumGS/3d-tiles-samples](https://github.com/CesiumGS/3d-tiles-samples),
licensed Apache-2.0:

- `1.1/SparseImplicitQuadtree`, `1.1/SparseImplicitOctree` — implicit-tiling path
  (`.subtree` parsing, Morton traversal across nested subtrees, templated content URIs, glTF/GLB decode).
- `1.1/MetadataGranularities` — tileset / group / tile metadata mapping to the DataModel.
- `glTF/EXT_structural_metadata/FeatureIdAttributeAndPropertyTable` — per-feature glTF
  `EXT_mesh_features` (`_FEATURE_ID_0` attribute) + `EXT_structural_metadata` property table,
  for feature-to-object linkage.

They are used solely as integration-test data for the 3D Tiles loader.
