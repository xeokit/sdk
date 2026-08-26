# Streaming a Procedural City as 3D Tiles

This example loads a generated procedural city that has been exported as an explicit 3D Tiles 1.1 tileset with GLB tile payloads.

The dataset contains:

- 1 root GLB for global city content
- 59 spatial GLB tiles
- 1,800 generated buildings
- about 494k triangles
- about 31 MB of tile content

The example builds a 3D Tiles tree from `tileset.json`, then drives a `TilesetStreamer` from the active camera. On each 
camera change, the streamer walks the tile tree, culls tiles whose spatial bounding volumes fall outside the camera 
frustum, and selects visible tiles using screen-space error. Screen-space error estimates how large a tile projects onto the canvas from the tile's geometric error, camera distance, field of view, and viewport height.

When a tile becomes selected, the streamer fetches its GLB content and decodes it into a per-tile `SceneModel`. When a previously loaded tile is no longer selected, for example because it moved out of view or exceeds the loaded-tile budget, that tile's `SceneModel` is destroyed and its geometry is removed from the scene. This keeps the rendered city tied to the current camera-visible tile set instead of loading the entire tileset permanently.
