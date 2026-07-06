import type {VoxelGrid} from "./VoxelGrid";
import type {VectorGrid} from "./VectorGrid";


/**
 * Demo scalar field generator. Produces a {@link VoxelGrid} with
 * vertical stratification and a Gaussian heat plume inside the supplied
 * bbox.
 *
 * Used by the Toolbar's Volume Overlay button when the application has
 * not supplied a field, and exported for demos and tests.
 *
 * @module presentations/volumeOverlay
 */
export function makeDemoScalarField(
  min: [number, number, number],
  max: [number, number, number],
  resolution: [number, number, number] = [40, 40, 24],
): VoxelGrid {

  const [nx, ny, nz] = resolution;
  const data = new Float32Array(nx * ny * nz);
  const sx = min[0] + 0.35 * (max[0] - min[0]);
  const sy = min[1] + 0.35 * (max[1] - min[1]);
  const sigma = 0.18 * Math.max(max[0] - min[0], max[1] - min[1]);
  const TBase = 18.0;     // floor temperature
  const TLapse = 5.0;     // K from floor to ceiling

  for (let iz = 0; iz < nz; iz++) {
    const wz = min[2] + (iz + 0.5) / nz * (max[2] - min[2]);
    const zFrac = (max[2] === min[2]) ? 0.5 :
      (wz - min[2]) / (max[2] - min[2]);
    for (let iy = 0; iy < ny; iy++) {
      const wy = min[1] + (iy + 0.5) / ny * (max[1] - min[1]);
      for (let ix = 0; ix < nx; ix++) {
        const wx = min[0] + (ix + 0.5) / nx * (max[0] - min[0]);
        let T = TBase + zFrac * TLapse;          // vertical stratification
        const dx = wx - sx;
        const dy = wy - sy;
        const plumeRadius = sigma + Math.max(0, wz - min[2]) * 0.3;
        const r2 = (dx * dx + dy * dy) / (plumeRadius * plumeRadius);
        T += 8.0 * Math.exp(-r2) * Math.exp(-Math.max(0, min[2] + 1 - wz));  // Gaussian plume
        if (wz < min[2] + 0.5) T -= 1.5;         // cool floor slab
        data[iz * nx * ny + iy * nx + ix] = T;
      }
    }
  }
  return {
    data,
    resolution,
    min,
    max,
    unit: "°C",
    valueRange: [18, 32],
    name: "Demo Temperature",
  };
}


/**
 * Demo vector field generator paired with {@link makeDemoScalarField}.
 * Produces a simple natural-convection field: updraft over the plume,
 * floor inflow, and ceiling outflow.
 *
 * Used by the Toolbar's Volume Overlay button when no vector field is
 * supplied.
 */
export function makeDemoVectorField(
  min: [number, number, number],
  max: [number, number, number],
  resolution: [number, number, number] = [30, 30, 18],
): VectorGrid {

  const [nx, ny, nz] = resolution;
  const data = new Float32Array(nx * ny * nz * 3);
  const sx = min[0] + 0.35 * (max[0] - min[0]);
  const sy = min[1] + 0.35 * (max[1] - min[1]);
  const sigma = 0.20 * Math.max(max[0] - min[0], max[1] - min[1]);

  for (let iz = 0; iz < nz; iz++) {
    const wz = min[2] + (iz + 0.5) / nz * (max[2] - min[2]);
    const zFrac = (max[2] === min[2]) ? 0.5 :
      (wz - min[2]) / (max[2] - min[2]);
    for (let iy = 0; iy < ny; iy++) {
      const wy = min[1] + (iy + 0.5) / ny * (max[1] - min[1]);
      for (let ix = 0; ix < nx; ix++) {
        const wx = min[0] + (ix + 0.5) / nx * (max[0] - min[0]);
        const dx = wx - sx;
        const dy = wy - sy;
        const r  = Math.hypot(dx, dy);
        const rN = r / sigma;

        const updraft = Math.exp(-rN * rN) * (0.4 + 0.8 * zFrac);
        const radial  = -Math.exp(-rN * rN * 0.5) * (1.0 - 2.0 * zFrac);
        const ux = (r > 0.1) ? radial * (dx / r) : 0;
        const uy = (r > 0.1) ? radial * (dy / r) : 0;
        const drift = 0.05 * (1.0 - zFrac);

        const o = (iz * nx * ny + iy * nx + ix) * 3;
        data[o]     = ux + drift;
        data[o + 1] = uy;
        data[o + 2] = updraft;
      }
    }
  }
  return {
    data,
    resolution,
    min,
    max,
    unit: "m/s",
    magnitudeRange: [0, 1.5],
    name: "Demo Air Velocity",
  };
}
