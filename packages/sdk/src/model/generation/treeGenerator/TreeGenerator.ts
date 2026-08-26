import {TrianglesPrimitive} from "../../../base/constants";
import {type SDKResult} from "../../../base/core";
import {type Mat4} from "../../../base/math/matrix";
import {type SceneModel} from "../../scene/SceneModel";
import {buildBox, buildCylinder, buildSphere, type GeometryArrays} from "../buildGeometry";

export type TreeGeneratorVec3 = [number, number, number];

export type TreeGeneratorPresetName = "oak" | "pine" | "columnar" | "windswept";

export interface TreeGeneratorPreset {
  height: number;
  levels: number;
  spread: number;
  density: number;
  leafSize: number;
  trunkRadius: number;
  branchRings: number;
  ringBranches: number;
  upwardBias: number;
  taper: number;
  lengthFalloff: number;
  crownLift: number;
  wind: number;
  leafColor: TreeGeneratorVec3;
  leafColorAlt: TreeGeneratorVec3;
  barkColor: TreeGeneratorVec3;
}

export interface TreeGeneratorParams extends Partial<TreeGeneratorPreset> {
  species?: TreeGeneratorPresetName | string;
  seed?: number;
  includeGround?: boolean;
  position?: TreeGeneratorVec3;
  rotation?: number;
  scale?: number;
  groundSize?: number;
  groundColor?: TreeGeneratorVec3;
  idPrefix?: string;
  geometryIdPrefix?: string;
}

export interface TreeGeneratorStats {
  branches: number;
  leaves: number;
  meshes: number;
}

interface TreeGeneratorResolvedSettings extends TreeGeneratorPreset {
  species: string;
  seed: number;
  includeGround: boolean;
  position: TreeGeneratorVec3;
  rotation: number;
  scale: number;
  groundSize: number;
  groundColor: TreeGeneratorVec3;
  idPrefix: string;
  geometryIdPrefix: string;
}

interface GrowBranchParams {
  createBranch: (start: TreeGeneratorVec3, end: TreeGeneratorVec3, radius: number, colorScale?: number) => void;
  createLeaf: (position: TreeGeneratorVec3, radius: number, tint: number) => void;
  random: () => number;
  settings: TreeGeneratorResolvedSettings;
  start: TreeGeneratorVec3;
  dir: TreeGeneratorVec3;
  length: number;
  radius: number;
  level: number;
  maxLevel: number;
}

const TREE_GENERATOR_PRESETS: Record<TreeGeneratorPresetName, TreeGeneratorPreset> = {
  oak: {
    height: 13,
    levels: 4,
    spread: 0.78,
    density: 0.72,
    leafSize: 1.15,
    trunkRadius: 0.42,
    branchRings: 5,
    ringBranches: 4,
    upwardBias: 0.32,
    taper: 0.63,
    lengthFalloff: 0.64,
    crownLift: 0.22,
    wind: 0,
    leafColor: [0.12, 0.31, 0.13],
    leafColorAlt: [0.17, 0.36, 0.15],
    barkColor: [0.38, 0.24, 0.13]
  },
  pine: {
    height: 16,
    levels: 5,
    spread: 0.46,
    density: 0.86,
    leafSize: 0.82,
    trunkRadius: 0.34,
    branchRings: 7,
    ringBranches: 6,
    upwardBias: 0.18,
    taper: 0.58,
    lengthFalloff: 0.68,
    crownLift: 0.12,
    wind: 0,
    leafColor: [0.05, 0.22, 0.13],
    leafColorAlt: [0.08, 0.27, 0.15],
    barkColor: [0.36, 0.25, 0.17]
  },
  columnar: {
    height: 17,
    levels: 4,
    spread: 0.34,
    density: 0.70,
    leafSize: 0.95,
    trunkRadius: 0.32,
    branchRings: 6,
    ringBranches: 5,
    upwardBias: 0.62,
    taper: 0.60,
    lengthFalloff: 0.58,
    crownLift: 0.30,
    wind: 0,
    leafColor: [0.10, 0.30, 0.16],
    leafColorAlt: [0.14, 0.35, 0.17],
    barkColor: [0.42, 0.30, 0.19]
  },
  windswept: {
    height: 11,
    levels: 4,
    spread: 0.96,
    density: 0.58,
    leafSize: 1.05,
    trunkRadius: 0.38,
    branchRings: 5,
    ringBranches: 4,
    upwardBias: 0.22,
    taper: 0.64,
    lengthFalloff: 0.66,
    crownLift: 0.18,
    wind: 0.58,
    leafColor: [0.13, 0.29, 0.12],
    leafColorAlt: [0.18, 0.34, 0.13],
    barkColor: [0.35, 0.25, 0.16]
  }
};

/**
 * Generates procedural tree meshes into a {@link model!scene.SceneModel | SceneModel}.
 *
 * The generator creates shared branch, foliage and optional ground geometries,
 * then adds one SceneObject per generated mesh. It is deterministic for a given
 * seed and settings object.
 */
export class TreeGenerator {
  static readonly PRESETS = TREE_GENERATOR_PRESETS;

  generate(sceneModel: SceneModel, params: TreeGeneratorParams = {}): TreeGeneratorStats {
    const settings = this.resolveSettings(params);
    this.createSharedGeometry(sceneModel, settings.geometryIdPrefix, settings.includeGround);
    return this.createTree(sceneModel, settings);
  }

  getPreset(name: string): TreeGeneratorPreset {
    return TreeGenerator.PRESETS[name as TreeGeneratorPresetName] || TreeGenerator.PRESETS.oak;
  }

  private resolveSettings(params: TreeGeneratorParams): TreeGeneratorResolvedSettings {
    const species = params.species || "oak";
    const preset = this.getPreset(species);
    return {
      species,
      seed: Math.max(1, Math.floor(params.seed ?? 1)),
      height: params.height ?? preset.height,
      levels: params.levels ?? preset.levels,
      spread: params.spread ?? preset.spread,
      density: params.density ?? preset.density,
      leafSize: params.leafSize ?? preset.leafSize,
      trunkRadius: params.trunkRadius ?? preset.trunkRadius,
      branchRings: params.branchRings ?? preset.branchRings,
      ringBranches: params.ringBranches ?? preset.ringBranches,
      upwardBias: params.upwardBias ?? preset.upwardBias,
      taper: params.taper ?? preset.taper,
      lengthFalloff: params.lengthFalloff ?? preset.lengthFalloff,
      crownLift: params.crownLift ?? preset.crownLift,
      wind: params.wind ?? preset.wind,
      leafColor: params.leafColor ?? preset.leafColor,
      leafColorAlt: params.leafColorAlt ?? preset.leafColorAlt,
      barkColor: params.barkColor ?? preset.barkColor,
      includeGround: params.includeGround !== false,
      position: params.position ?? [0, 0, 0],
      rotation: params.rotation ?? 0,
      scale: Math.max(0.001, params.scale ?? 1),
      groundSize: params.groundSize ?? 15,
      groundColor: params.groundColor ?? [0.36, 0.43, 0.31],
      idPrefix: params.idPrefix ?? "",
      geometryIdPrefix: params.geometryIdPrefix ?? params.idPrefix ?? ""
    };
  }

  private createSharedGeometry(sceneModel: SceneModel, idPrefix: string, includeGround: boolean) {
    const branchId = `${idPrefix}branch`;
    const leafClusterId = `${idPrefix}leafCluster`;
    const groundId = `${idPrefix}ground`;

    if (!sceneModel.geometries[branchId]) {
      this.addGeometry(sceneModel, branchId, buildCylinder({
        radiusTop: 1,
        radiusBottom: 1,
        height: 1,
        radialSegments: 12,
        heightSegments: 1
      }));
    }
    if (!sceneModel.geometries[leafClusterId]) {
      this.addGeometry(sceneModel, leafClusterId, buildSphere({
        radius: 1,
        heightSegments: 12,
        widthSegments: 14
      }));
    }
    if (includeGround && !sceneModel.geometries[groundId]) {
      this.addGeometry(sceneModel, groundId, buildBox({
        xSize: 1,
        ySize: 1,
        zSize: 1
      }));
    }
  }

  private addGeometry(sceneModel: SceneModel, id: string, result: SDKResult<GeometryArrays>) {
    if (sceneModel.geometries[id]) {
      return;
    }
    const geometry = must(result);
    must(sceneModel.createGeometry({
      id,
      primitive: TrianglesPrimitive,
      positions: geometry.positions,
      normals: geometry.normals,
      indices: geometry.indices
    }));
  }

  private createTree(sceneModel: SceneModel, settings: TreeGeneratorResolvedSettings): TreeGeneratorStats {
    const random = mulberry32(settings.seed);
    const stats: TreeGeneratorStats = {branches: 0, leaves: 0, meshes: 0};
    let nextId = 0;

    const geometryId = (id: string) => `${settings.geometryIdPrefix}${id}`;
    const createMesh = (baseGeometryId: string, matrix: Mat4, color: TreeGeneratorVec3) => {
      const meshId = `${settings.idPrefix}mesh_${nextId}`;
      const objectId = `${settings.idPrefix}object_${nextId}`;
      nextId++;
      must(sceneModel.createMesh({
        id: meshId,
        geometryId: geometryId(baseGeometryId),
        matrix,
        color
      }));
      must(sceneModel.createObject({id: objectId, meshIds: [meshId]}));
      stats.meshes++;
      return meshId;
    };

    const createBranch = (start: TreeGeneratorVec3, end: TreeGeneratorVec3, radius: number, colorScale = 1) => {
      const bark = settings.barkColor.map((v) => clamp01(v * colorScale)) as TreeGeneratorVec3;
      createMesh("branch", branchMatrix(
        transformPoint(start, settings),
        transformPoint(end, settings),
        radius * settings.scale
      ), bark);
      stats.branches++;
    };

    const createLeaf = (position: TreeGeneratorVec3, radius: number, tint: number) => {
      this.createLeafCluster(createMesh, settings, position, radius, tint);
      stats.leaves++;
    };

    if (settings.includeGround) {
      createMesh("ground", orientedScaleMatrix(
        transformPoint([0, 0, -0.08], settings),
        [settings.groundSize * settings.scale, settings.groundSize * settings.scale, 0.04 * settings.scale],
        settings.rotation
      ), settings.groundColor);
    }

    const trunkHeight = settings.height * (settings.species === "pine" ? 0.92 : 0.62);
    const trunkTop: TreeGeneratorVec3 = [settings.wind * settings.height * 0.10, 0, trunkHeight];
    createBranch([0, 0, 0], trunkTop, settings.trunkRadius, 0.92);
    this.addRoots(createBranch, settings, random);

    const ringCount = settings.branchRings;
    for (let ring = 0; ring < ringCount; ring++) {
      const t = ringCount === 1 ? 0.5 : ring / (ringCount - 1);
      const heightT = settings.crownLift + t * (0.93 - settings.crownLift);
      const ringZ = trunkHeight * heightT;
      const trunkX = trunkTop[0] * heightT;
      const start: TreeGeneratorVec3 = [trunkX, 0, ringZ];
      const branchCount = settings.ringBranches - (ring % 2);
      const ringRadius = settings.trunkRadius * (1.02 - heightT * 0.66);
      const baseLength = settings.height * settings.spread * (0.28 + (1 - t) * 0.20);
      const phase = random() * Math.PI * 2 + ring * 0.72;

      for (let i = 0; i < branchCount; i++) {
        const azimuth = phase + (i / branchCount) * Math.PI * 2 + jitter(random, 0.22);
        const horizontal = Math.max(0.12, settings.spread) * (settings.species === "pine" ? 0.75 : 1);
        const dir = normalize([
          Math.cos(azimuth) * horizontal + settings.wind * (0.34 + t * 0.35),
          Math.sin(azimuth) * horizontal,
          settings.upwardBias + 0.18 + t * 0.48 + random() * 0.18
        ]);
        this.growBranch({
          createBranch,
          createLeaf,
          random,
          settings,
          start,
          dir,
          length: baseLength * (0.78 + random() * 0.34),
          radius: ringRadius * (0.52 + random() * 0.18),
          level: 1,
          maxLevel: settings.levels
        });
      }
    }

    if (settings.species === "pine" || settings.species === "columnar") {
      const leaderTop: TreeGeneratorVec3 = [trunkTop[0] + settings.wind * settings.height * 0.16, 0, settings.height];
      createBranch(trunkTop, leaderTop, settings.trunkRadius * 0.30, 1.08);
      createLeaf(leaderTop, settings.leafSize * 1.1, random());
    }

    return stats;
  }

  private growBranch({createBranch, createLeaf, random, settings, start, dir, length, radius, level, maxLevel}: GrowBranchParams) {
    const bend = settings.wind * level * 0.12;
    const end: TreeGeneratorVec3 = [
      start[0] + dir[0] * length + bend,
      start[1] + dir[1] * length,
      start[2] + dir[2] * length
    ];
    createBranch(start, end, radius, 0.95 + random() * 0.16);

    if (level >= maxLevel || radius < 0.045) {
      const clusters = Math.max(1, Math.round(settings.density * (settings.species === "pine" ? 4 : 3)));
      for (let i = 0; i < clusters; i++) {
        const offset = randomUnitVector(random);
        const position: TreeGeneratorVec3 = [
          end[0] + offset[0] * settings.leafSize * 0.45,
          end[1] + offset[1] * settings.leafSize * 0.45,
          end[2] + Math.abs(offset[2]) * settings.leafSize * 0.24
        ];
        createLeaf(position, settings.leafSize * (0.70 + random() * 0.55), random());
      }
      return;
    }

    const childCount = settings.species === "pine"
      ? 2 + (random() > 0.48 ? 1 : 0)
      : 2 + (random() > 0.70 ? 1 : 0);
    for (let i = 0; i < childCount; i++) {
      const azimuth = Math.atan2(dir[1], dir[0]) + (i - (childCount - 1) / 2) * (0.95 + settings.spread * 0.55) + jitter(random, 0.42);
      const lateral = settings.spread * (0.50 + random() * 0.34) / (level + 0.65);
      const childDir = normalize([
        dir[0] * 0.56 + Math.cos(azimuth) * lateral + settings.wind * 0.12,
        dir[1] * 0.56 + Math.sin(azimuth) * lateral,
        dir[2] * 0.62 + settings.upwardBias * 0.34 + random() * 0.28
      ]);
      this.growBranch({
        createBranch,
        createLeaf,
        random,
        settings,
        start: end,
        dir: childDir,
        length: length * settings.lengthFalloff * (0.78 + random() * 0.28),
        radius: radius * settings.taper,
        level: level + 1,
        maxLevel
      });
    }
  }

  private createLeafCluster(
    createMesh: (geometryId: string, matrix: Mat4, color: TreeGeneratorVec3) => string,
    settings: TreeGeneratorResolvedSettings,
    position: TreeGeneratorVec3,
    radius: number,
    tint: number) {
    const color = mixColor(settings.leafColor, settings.leafColorAlt, 0.25 + tint * 0.15);
    const flatten = settings.species === "pine" ? 1.35 : 0.72;
    createMesh("leafCluster", orientedScaleMatrix(transformPoint(position, settings), [
      radius * settings.scale * (0.85 + tint * 0.28),
      radius * settings.scale * (settings.species === "columnar" ? 0.68 : 1.05),
      radius * settings.scale * flatten
    ], settings.rotation), color);
  }

  private addRoots(
    createBranch: (start: TreeGeneratorVec3, end: TreeGeneratorVec3, radius: number, colorScale?: number) => void,
    settings: TreeGeneratorResolvedSettings,
    random: () => number) {
    const roots = 6;
    for (let i = 0; i < roots; i++) {
      const angle = (i / roots) * Math.PI * 2 + jitter(random, 0.22);
      const len = settings.trunkRadius * (2.3 + random() * 1.8);
      const end: TreeGeneratorVec3 = [
        Math.cos(angle) * len,
        Math.sin(angle) * len,
        0.08
      ];
      createBranch([0, 0, 0.18], end, settings.trunkRadius * (0.18 + random() * 0.08), 0.82);
    }
  }
}

function must<T>(result: SDKResult<T>): T {
  if (result.ok) {
    return result.value;
  }
  throw new Error((result as { ok: false; error: string }).error);
}

function transformPoint(point: TreeGeneratorVec3, settings: TreeGeneratorResolvedSettings): TreeGeneratorVec3 {
  const cos = Math.cos(settings.rotation);
  const sin = Math.sin(settings.rotation);
  const x = point[0] * settings.scale;
  const y = point[1] * settings.scale;
  return [
    settings.position[0] + x * cos - y * sin,
    settings.position[1] + x * sin + y * cos,
    settings.position[2] + point[2] * settings.scale
  ];
}

function orientedScaleMatrix(position: TreeGeneratorVec3, scale: TreeGeneratorVec3, rotation: number): Mat4 {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return [
    cos * scale[0], sin * scale[0], 0, 0,
    -sin * scale[1], cos * scale[1], 0, 0,
    0, 0, scale[2], 0,
    position[0], position[1], position[2], 1
  ] as Mat4;
}

function branchMatrix(start: TreeGeneratorVec3, end: TreeGeneratorVec3, radius: number): Mat4 {
  const axisY = subtract(end, start);
  const length = Math.hypot(axisY[0], axisY[1], axisY[2]) || 1;
  const y: TreeGeneratorVec3 = [axisY[0] / length, axisY[1] / length, axisY[2] / length];
  const helper: TreeGeneratorVec3 = Math.abs(dot(y, [0, 0, 1])) > 0.92 ? [1, 0, 0] : [0, 0, 1];
  const x = normalize(cross(helper, y));
  const z = cross(y, x);
  const center: TreeGeneratorVec3 = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2
  ];
  return [
    x[0] * radius, x[1] * radius, x[2] * radius, 0,
    y[0] * length, y[1] * length, y[2] * length, 0,
    z[0] * radius, z[1] * radius, z[2] * radius, 0,
    center[0], center[1], center[2], 1
  ] as Mat4;
}

function mulberry32(seed: number) {
  return function next() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function randomUnitVector(random: () => number): TreeGeneratorVec3 {
  const angle = random() * Math.PI * 2;
  const z = random() * 2 - 1;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [Math.cos(angle) * r, Math.sin(angle) * r, z];
}

function mixColor(a: TreeGeneratorVec3, b: TreeGeneratorVec3, t: number): TreeGeneratorVec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

function jitter(random: () => number, amount: number) {
  return (random() - 0.5) * amount;
}

function subtract(a: TreeGeneratorVec3, b: TreeGeneratorVec3): TreeGeneratorVec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a: TreeGeneratorVec3, b: TreeGeneratorVec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: TreeGeneratorVec3, b: TreeGeneratorVec3): TreeGeneratorVec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function normalize(v: TreeGeneratorVec3): TreeGeneratorVec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
