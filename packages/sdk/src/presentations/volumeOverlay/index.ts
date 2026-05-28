/**
 * # Volume Overlays
 *
 * 3D scalar-field visualisation on top of an AECO scene — the
 * "interrogate the building's behaviour" complement to
 * {@link presentations!daylightAnalysis | DaylightAnalysis}'s
 * 2D work-plane heatmaps.
 *
 * A {@link VoxelGrid} carries the raw field (CFD output, thermal
 * sim, acoustic SPL, sensor interpolation, etc.) on a regular 3D
 * lattice. The builders then bake views of that data into
 * SceneModels that drop straight into the existing render pipeline:
 *
 *   - {@link buildVolumeSlicePlane} — a movable cross-section
 *     through the field, the workhorse technique for CFD / HVAC
 *     review.
 *
 * ## Usage
 *
 * ```ts
 * import * as xeokit from "@xeokit/sdk";
 *
 * // Build a synthetic field (real workflows load from CFD output).
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
 * Future visualisation techniques (isosurfaces, full volume
 * ray-march, streamlines for vector fields) plug into the same
 * data primitive — the {@link VoxelGrid} stays put, only the
 * builder swaps.
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
