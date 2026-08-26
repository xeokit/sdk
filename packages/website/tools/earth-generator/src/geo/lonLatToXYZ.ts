import type {LonLat} from "../types";

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export function lonLatToXYZ([lonDeg, latDeg]: LonLat, radius: number): [number, number, number] {
  const lon = lonDeg * DEG2RAD;
  const lat = latDeg * DEG2RAD;
  const cosLat = Math.cos(lat);
  return [
    radius * cosLat * Math.cos(lon),
    radius * Math.sin(lat),
    radius * cosLat * Math.sin(lon)
  ];
}

export function normalize3(x: number, y: number, z: number): [number, number, number] {
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

export function unitFromLonLat(p: LonLat): [number, number, number] {
  return normalize3(...lonLatToXYZ(p, 1));
}

export function lonLatFromUnit([x, y, z]: [number, number, number]): LonLat {
  return [Math.atan2(z, x) * RAD2DEG, Math.asin(Math.max(-1, Math.min(1, y))) * RAD2DEG];
}
