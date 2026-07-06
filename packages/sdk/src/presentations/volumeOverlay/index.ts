/**
 * # Volume Overlays
 *
 * 3D scalar-field overlays for AECO scenes. Use these for fields such as
 * CFD, thermal simulation, acoustic SPL, or sensor interpolation.
 *
 * A {@link VoxelGrid} carries scalar data on a regular 3D lattice. The
 * builders bake views of that data into SceneModels:
 *
 *   - {@link buildVolumeSlicePlane} — a movable cross-section
 *     through the field.
 *
 * ## Usage
 *
 * ```ts
 * import * as xeokit from "@xeokit/sdk";
 *
 * // Build a synthetic field. Real workflows usually load simulation output.
 * const grid: xeokit.presentations.volumeOverlay.VoxelGrid = {
 *   resolution: [40, 40, 20],
 *   min: [-10, -10,  0],
 *   max: [ 10,  10, 10],
 *   data: makeTemperatureField(40, 40, 20),
 *   unit: "°C",
 *   valueRange: [18, 32],
 *   name: "Atrium temperature",
 * };
 *
 * // Bake a horizontal slice at z = 1.5 m (work-plane height).
 * const slice = xeokit.presentations.volumeOverlay.buildVolumeSlicePlane(
 *   scene, grid, {axis: "z", position: 1.5}
 * );
 * ```
 *
 * Other builders use the same data primitive: the {@link VoxelGrid}
 * stays the same, while the builder selects the output geometry.
 *
 * @module volumeOverlay
 */

export * from "./VoxelGrid";
export * from "./VectorGrid";
export * from "./colormaps";
export * from "./buildVolumeSlicePlane";
export * from "./buildVolumeIsosurface";
export * from "./buildVolumeStreamlines";
export * from "./marchingCubes";
export * from "./demoFields";
export * from "./loadVTI";
