# 3D Tiles Example Datasets

These small datasets back the website examples under
`packages/website/examples/import/threedtiles/*`.

Generated local fixtures:

- `PointCloud`: sampled `pnts` content from the real
  `Nalls-Pumpkin-Hill/laz/model.laz` LiDAR scan.
- `Instancing`: small `i3dm` content with separated embedded glTF instances.
- `Composite`: mixed `cmpt` content with the sampled Pumpkin Hill `pnts`
  payload and nested `i3dm` payloads.

Copied CesiumGS fixtures:

- `MetadataGranularities`: 3D Tiles 1.1 tileset, group, tile, and content metadata.
- `FeatureIdAttributeAndPropertyTable`: glTF `EXT_mesh_features` feature IDs
  linked to `EXT_structural_metadata` property-table rows.

Known unsupported cases are intentionally not represented as successful demos:
multiple contents per tile, feature ID textures, property textures, KTX2/Basis
textures, implicit subtree metadata, and i3dm oct-encoded normals /
`EAST_NORTH_UP` orientation. Those should get separate diagnostic examples only
when the loader reports them explicitly enough for users to understand the
failure mode.
