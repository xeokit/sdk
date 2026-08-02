import type {MeshData, Vec2, Vec3} from "../types";

export class MeshBuilder {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly indices: number[] = [];

  addMesh(mesh: Pick<MeshData, "positions" | "normals" | "indices">): void {
    const base = this.positions.length / 3;
    this.positions.push(...mesh.positions);
    this.normals.push(...mesh.normals);
    for (const idx of mesh.indices) {
      this.indices.push(base + idx);
    }
  }

  addQuad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, normal?: Vec3): void {
    const n = normal || faceNormal(a, b, c);
    const base = this.positions.length / 3;
    this.positions.push(...a, ...b, ...c, ...d);
    this.normals.push(...n, ...n, ...n, ...n);
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  addBox(center: Vec3, size: Vec3, yaw = 0): void {
    const hx = size[0] / 2;
    const hy = size[1] / 2;
    const hz = size[2] / 2;
    const corners: Vec3[] = [
      [-hx, -hy, -hz], [ hx, -hy, -hz], [ hx,  hy, -hz], [-hx,  hy, -hz],
      [-hx, -hy,  hz], [ hx, -hy,  hz], [ hx,  hy,  hz], [-hx,  hy,  hz]
    ].map((p) => transformPoint(p, center, yaw));
    this.addQuad(corners[0], corners[1], corners[2], corners[3], rotateNormal([0, 0, -1], yaw));
    this.addQuad(corners[4], corners[7], corners[6], corners[5], rotateNormal([0, 0, 1], yaw));
    this.addQuad(corners[0], corners[4], corners[5], corners[1], rotateNormal([0, -1, 0], yaw));
    this.addQuad(corners[1], corners[5], corners[6], corners[2], rotateNormal([1, 0, 0], yaw));
    this.addQuad(corners[2], corners[6], corners[7], corners[3], rotateNormal([0, 1, 0], yaw));
    this.addQuad(corners[3], corners[7], corners[4], corners[0], rotateNormal([-1, 0, 0], yaw));
  }

  addCylinder(center: Vec3, radius: number, height: number, segments = 10): void {
    const base = this.positions.length / 3;
    const z0 = center[2] - height / 2;
    const z1 = center[2] + height / 2;
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const x = Math.cos(a);
      const y = Math.sin(a);
      this.positions.push(center[0] + x * radius, center[1] + y * radius, z0);
      this.positions.push(center[0] + x * radius, center[1] + y * radius, z1);
      this.normals.push(x, y, 0, x, y, 0);
    }
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      this.indices.push(base + i * 2, base + j * 2, base + j * 2 + 1);
      this.indices.push(base + i * 2, base + j * 2 + 1, base + i * 2 + 1);
    }
  }

  addDisc(center: Vec3, radius: number, segments = 16, normal: Vec3 = [0, 0, 1]): void {
    const base = this.positions.length / 3;
    this.positions.push(...center);
    this.normals.push(...normal);
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      this.positions.push(center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius, center[2]);
      this.normals.push(...normal);
    }
    for (let i = 0; i < segments; i++) {
      this.indices.push(base, base + 1 + i, base + 1 + ((i + 1) % segments));
    }
  }

  addRoadSegment(a: Vec2, b: Vec2, width: number, z = 0.015): void {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 0.001) {
      return;
    }
    const yaw = Math.atan2(dy, dx);
    this.addBox([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z], [len + width * 0.25, width, 0.03], yaw);
  }

  toMesh(materialId: string, id?: string): MeshData {
    return {
      id,
      materialId,
      positions: this.positions,
      normals: this.normals,
      indices: this.indices
    };
  }
}

export function transformPoint(point: Vec3, center: Vec3, yaw: number): Vec3 {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [
    center[0] + point[0] * c - point[1] * s,
    center[1] + point[0] * s + point[1] * c,
    center[2] + point[2]
  ];
}

function rotateNormal(n: Vec3, yaw: number): Vec3 {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [n[0] * c - n[1] * s, n[0] * s + n[1] * c, n[2]];
}

function faceNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}
