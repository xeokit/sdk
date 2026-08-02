import type {MeshData, Vec2, Vec3} from "../types";
import {MeshBuilder} from "../geometry/MeshBuilder";
import {clamp, ensureCCW} from "../geometry/PolygonUtils";

export interface FacadeParams {
  bounds: [number, number, number, number];
  polygon?: Vec2[];
  baseZ: number;
  height: number;
  floors: number;
  district: string;
  usage: string;
  facadeStyle: "brick" | "stone" | "stucco" | "curtain-wall" | "concrete-grid" | "residential";
  glassMaterialId: string;
  trimMaterialId: string;
  balconyMaterialId: string;
}

export function createFacadeMeshes(params: FacadeParams): MeshData[] {
  const [minX, minY, maxX, maxY] = params.bounds;
  const width = maxX - minX;
  const depth = maxY - minY;
  const meshes: MeshData[] = [];
  const glass = new MeshBuilder();
  const trim = new MeshBuilder();
  const balconies = new MeshBuilder();
  const polygon = params.polygon && params.polygon.length >= 3 ? ensureCCW(params.polygon) : undefined;
  const edges = polygon ? facadeEdges(polygon) : [];
  const floorH = params.height / Math.max(1, params.floors);
  const zMin = params.baseZ;
  const isTower = params.facadeStyle === "curtain-wall";
  const isHistoric = params.facadeStyle === "brick" || params.facadeStyle === "stone" || params.facadeStyle === "stucco";
  const floorStep = isTower ? 2 : 1;
  const longBandWidth = width * (isTower ? 0.86 : isHistoric ? 0.58 : 0.70);
  const shortBandWidth = depth * (isTower ? 0.84 : isHistoric ? 0.54 : 0.68);
  const windowHeight = floorH * (isTower ? 0.72 : isHistoric ? 0.42 : 0.52);
  const eps = 0.08;

  for (let floor = 1; floor < params.floors; floor += floorStep) {
    const groupFloors = Math.min(floorStep, params.floors - floor);
    const z = zMin + floor * floorH + (floorH * groupFloors) * 0.52;
    const h = windowHeight * groupFloors + (isTower ? floorH * 0.34 * (groupFloors - 1) : 0);
    if (edges.length) {
      addEdgePanels(glass, edges, eps, isTower ? 0.86 : isHistoric ? 0.58 : 0.70, z, h);
    } else {
      addHorizontalPanel(glass, minY - eps, (minX + maxX) / 2, longBandWidth, z, h, [0, -1, 0]);
      addHorizontalPanel(glass, maxY + eps, (minX + maxX) / 2, longBandWidth, z, h, [0, 1, 0]);
      addVerticalPanel(glass, minX - eps, (minY + maxY) / 2, shortBandWidth, z, h, [-1, 0, 0]);
      addVerticalPanel(glass, maxX + eps, (minY + maxY) / 2, shortBandWidth, z, h, [1, 0, 0]);
    }

    if (!isTower && floor % 4 === 0) {
      if (edges.length) {
        addEdgePanels(trim, edges, eps * 1.5, 0.92, z - h / 2 - 0.18, 0.16);
      } else {
        trim.addBox([(minX + maxX) / 2, minY - eps * 1.5, z - h / 2 - 0.18], [width * 0.92, 0.16, 0.16], 0);
        trim.addBox([(minX + maxX) / 2, maxY + eps * 1.5, z - h / 2 - 0.18], [width * 0.92, 0.16, 0.16], 0);
      }
    }

    if (params.facadeStyle === "residential" && floor % 2 === 0 && width > 12) {
      const edge = edges.length ? longestEdge(edges) : undefined;
      const balconySpan = edge?.length ?? width;
      const balconyCount = Math.max(1, Math.floor(balconySpan / 18));
      for (let i = 0; i < balconyCount; i++) {
        if (edge) {
          const t = (i + 0.5) / balconyCount;
          const center: Vec3 = [
            edge.a[0] + (edge.b[0] - edge.a[0]) * t + edge.normal[0] * 0.9,
            edge.a[1] + (edge.b[1] - edge.a[1]) * t + edge.normal[1] * 0.9,
            z - h * 0.05
          ];
          balconies.addBox(center, [clamp(balconySpan / balconyCount * 0.42, 2.6, 5.8), 1.35, 0.16], edge.yaw);
        } else {
          const x = minX + (i + 0.5) * width / balconyCount;
          balconies.addBox([x, minY - 1.0, z - h * 0.05], [clamp(width / balconyCount * 0.42, 2.6, 5.8), 1.35, 0.16], 0);
        }
      }
    }
  }

  if (params.usage === "MixedUse" || params.usage === "Retail" || params.district === "Downtown") {
    const storefrontH = Math.min(4.2, floorH * 0.72);
    const streetEdge = edges.length ? longestEdge(edges) : undefined;
    if (streetEdge) {
      addEdgePanel(glass, streetEdge, eps * 1.4, 0.76, zMin + storefrontH * 0.62, storefrontH);
      addEdgePanel(trim, streetEdge, eps * 1.7, 0.82, zMin + storefrontH + 0.24, 0.28);
    } else {
      addHorizontalPanel(glass, minY - eps * 1.4, (minX + maxX) / 2, width * 0.76, zMin + storefrontH * 0.62, storefrontH, [0, -1, 0]);
      trim.addBox([(minX + maxX) / 2, minY - eps * 1.7, zMin + storefrontH + 0.24], [width * 0.82, 0.22, 0.28], 0);
    }
  }

  const corniceZ = params.baseZ + params.height - Math.min(0.7, floorH * 0.18);
  if (edges.length) {
    addEdgePanels(trim, edges, eps * 1.5, 1.02, corniceZ, 0.32);
  } else {
    trim.addBox([(minX + maxX) / 2, minY - eps * 1.5, corniceZ], [width * 1.02, 0.22, 0.32], 0);
    trim.addBox([(minX + maxX) / 2, maxY + eps * 1.5, corniceZ], [width * 1.02, 0.22, 0.32], 0);
    trim.addBox([minX - eps * 1.5, (minY + maxY) / 2, corniceZ], [0.22, depth * 1.02, 0.32], 0);
    trim.addBox([maxX + eps * 1.5, (minY + maxY) / 2, corniceZ], [0.22, depth * 1.02, 0.32], 0);
  }

  if (glass.indices.length) {
    meshes.push(glass.toMesh(params.glassMaterialId, "facade-glass"));
  }
  if (trim.indices.length) {
    meshes.push(trim.toMesh(params.trimMaterialId, "facade-trim"));
  }
  if (balconies.indices.length) {
    meshes.push(balconies.toMesh(params.balconyMaterialId, "facade-balconies"));
  }
  return meshes;
}

interface FacadeEdge {
  a: Vec2;
  b: Vec2;
  center: Vec2;
  dir: Vec2;
  normal: Vec2;
  length: number;
  yaw: number;
}

function facadeEdges(polygon: Vec2[]): FacadeEdge[] {
  const edges: FacadeEdge[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    if (length < 3) {
      continue;
    }
    edges.push({
      a,
      b,
      center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      dir: [dx / length, dy / length],
      normal: [dy / length, -dx / length],
      length,
      yaw: Math.atan2(dy, dx)
    });
  }
  return edges;
}

function longestEdge(edges: FacadeEdge[]): FacadeEdge {
  return edges.reduce((best, edge) => edge.length > best.length ? edge : best, edges[0]);
}

function addEdgePanels(builder: MeshBuilder, edges: FacadeEdge[], offset: number, widthFactor: number, centerZ: number, panelHeight: number): void {
  for (const edge of edges) {
    addEdgePanel(builder, edge, offset, widthFactor, centerZ, panelHeight);
  }
}

function addEdgePanel(builder: MeshBuilder, edge: FacadeEdge, offset: number, widthFactor: number, centerZ: number, panelHeight: number): void {
  const half = edge.length * widthFactor * 0.5;
  const cx = edge.center[0] + edge.normal[0] * offset;
  const cy = edge.center[1] + edge.normal[1] * offset;
  const x0 = cx - edge.dir[0] * half;
  const y0 = cy - edge.dir[1] * half;
  const x1 = cx + edge.dir[0] * half;
  const y1 = cy + edge.dir[1] * half;
  const z0 = centerZ - panelHeight / 2;
  const z1 = centerZ + panelHeight / 2;
  builder.addQuad(
    [x0, y0, z0],
    [x1, y1, z0],
    [x1, y1, z1],
    [x0, y0, z1],
    [edge.normal[0], edge.normal[1], 0]
  );
}

function addHorizontalPanel(
  builder: MeshBuilder,
  y: number,
  centerX: number,
  panelWidth: number,
  centerZ: number,
  panelHeight: number,
  normal: [number, number, number]
): void {
  const x0 = centerX - panelWidth / 2;
  const x1 = centerX + panelWidth / 2;
  const z0 = centerZ - panelHeight / 2;
  const z1 = centerZ + panelHeight / 2;
  builder.addQuad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], normal);
}

function addVerticalPanel(
  builder: MeshBuilder,
  x: number,
  centerY: number,
  panelWidth: number,
  centerZ: number,
  panelHeight: number,
  normal: [number, number, number]
): void {
  const y0 = centerY - panelWidth / 2;
  const y1 = centerY + panelWidth / 2;
  const z0 = centerZ - panelHeight / 2;
  const z1 = centerZ + panelHeight / 2;
  builder.addQuad([x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1], normal);
}
