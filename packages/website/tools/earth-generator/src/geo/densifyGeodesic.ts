import type {LonLat, Ring} from "../types";
import {lonLatFromUnit, unitFromLonLat} from "./lonLatToXYZ";

export function angularDistanceDeg(a: LonLat, b: LonLat): number {
  const av = unitFromLonLat(a);
  const bv = unitFromLonLat(b);
  const dot = Math.max(-1, Math.min(1, av[0] * bv[0] + av[1] * bv[1] + av[2] * bv[2]));
  return Math.acos(dot) * 180 / Math.PI;
}

export function densifyRingGeodesic(ring: Ring, maxEdgeAngleDeg: number): Ring {
  if (ring.length < 2) return ring;
  const closed = samePoint(ring[0], ring[ring.length - 1]);
  const source = closed ? ring.slice(0, -1) : ring;
  const out: Ring = [];
  for (let i = 0; i < source.length; i++) {
    const a = source[i];
    const b = source[(i + 1) % source.length];
    out.push(a);
    const angle = angularDistanceDeg(a, b);
    const steps = Math.max(1, Math.ceil(angle / maxEdgeAngleDeg));
    for (let s = 1; s < steps; s++) {
      out.push(slerpLonLat(a, b, s / steps));
    }
  }
  out.push(out[0]);
  return out;
}

export function densifyLineGeodesic(line: Ring, maxEdgeAngleDeg: number): Ring {
  if (line.length < 2) return line;
  const out: Ring = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i];
    const b = line[i + 1];
    out.push(a);
    const steps = Math.max(1, Math.ceil(angularDistanceDeg(a, b) / maxEdgeAngleDeg));
    for (let s = 1; s < steps; s++) {
      out.push(slerpLonLat(a, b, s / steps));
    }
  }
  out.push(line[line.length - 1]);
  return out;
}

function slerpLonLat(a: LonLat, b: LonLat, t: number): LonLat {
  const av = unitFromLonLat(a);
  const bv = unitFromLonLat(b);
  const dot = Math.max(-1, Math.min(1, av[0] * bv[0] + av[1] * bv[1] + av[2] * bv[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-10) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  const sinOmega = Math.sin(omega);
  const wa = Math.sin((1 - t) * omega) / sinOmega;
  const wb = Math.sin(t * omega) / sinOmega;
  return lonLatFromUnit([
    av[0] * wa + bv[0] * wb,
    av[1] * wa + bv[1] * wb,
    av[2] * wa + bv[2] * wb
  ]);
}

function samePoint(a?: LonLat, b?: LonLat): boolean {
  return !!a && !!b && Math.abs(a[0] - b[0]) < 1e-12 && Math.abs(a[1] - b[1]) < 1e-12;
}
