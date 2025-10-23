This directory contains classes that manage GPU-resident data textures for WebGL rendering. These classes handle:

- **DTXMatrixArray**: Storage and updates for 4x4 transformation matrices in a GPU texture.
- **DTXMeshAttribs**: Management of mesh attributes (e.g., vertex and index data) in an RGBA32UI texture.
- **DTXMeshViewAttribs**: Storage of mesh view attributes (e.g., color, render flags) in an RGBA8UI texture.
- **DTXPointerArray**: Allocation and management of 32-bit unsigned integers in an R32UI texture.
- **DTXPointerTable**: Similar to `DTXPointerArray`, but stores 32-bit integers encoded in RGBA8UI textures.
- **DTXPositionsArray**: Storage of vertex positions (XYZ) in an RGBA16UI texture.
- **DTXPrimDrawList**: Management of primitive draw lists partitioned by render passes in an R32UI texture.
- **DTXQuantRanges**: Storage of dequantization ranges (offset and scale) for geometry in an RGBA32F texture.
- **DTXVertexColorsArray**: Storage of vertex colors (RGB) in an RGBA8UI texture.