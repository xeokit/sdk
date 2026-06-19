import {
  LinesPrimitive,
  PointsPrimitive,
  SolidPrimitive,
  SurfacePrimitive,
  TrianglesPrimitive,
} from "../../../../../base/constants";
import {decompressPositions3WithAABB3} from "../../../../../base/math/compression";
import {getMeshWorldMatrix, type SceneModel} from "../../../../../model/scene";
import type {DataModel} from "../../../../../model/data";
import type {Vec3} from "../../../../../base/math/vector";
import {yieldToHost} from "../../../../../base/utils";
import type {XKTData_v12} from "./XKTData_v12";

const MESH_ATTRIBUTES = 6; // RGB, opacity, metallic, roughness

const IDENTITY16 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** SceneModel primitive constant → XKT v12 primitive code (undefined = skip). */
function xktPrimitiveCode(primitive: number): number | undefined {
  switch (primitive) {
    case SolidPrimitive: return 0;
    case TrianglesPrimitive: return 1;
    case SurfacePrimitive: return 1;
    case PointsPrimitive: return 2;
    case LinesPrimitive: return 3;
    default: return undefined; // GaussianSplats etc — no XKT v12 representation
  }
}

interface MeshItem {
  world: Float32Array;
  indices?: Uint32Array;
  colors?: Uint8Array;
  code: number;
  color: Vec3;
  opacity: number;
  metallic: number;
  roughness: number;
}

/**
 * Encode a SceneModel (and optional DataModel) into the XKT v12 payload.
 *
 * Each mesh becomes one geometry whose vertex positions are transformed to the
 * model's coordinate frame (the mesh's world matrix baked in) and 16-bit
 * quantised against the whole-model AABB — a single tile. Geometry is not
 * instanced (one geometry per mesh) and textures are not written; the result
 * is a valid uncompressed XKT v12 file. The DataModel's objects and property
 * sets are written as the model metadata.
 *
 * @private
 */
export async function modelToXKT(params: {
  sceneModel: SceneModel;
  dataModel?: DataModel;
  options?: any;
}): Promise<XKTData_v12> {

  const {sceneModel, dataModel, options} = params;
  const coordinateSystem = options?.coordinateSystem;

  const items: MeshItem[] = [];
  const eachEntityId: string[] = [];
  const entityMeshBase: number[] = [];
  const worldAABB = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];

  const objects = Object.values(sceneModel.objects);
  for (let o = 0; o < objects.length; o++) {
    if ((o & 0x1f) === 0) await yieldToHost(options?.signal);
    const object: any = objects[o];
    const base = items.length;
    for (const mesh of object.meshes) {
      const geometry = mesh.geometry;
      const code = xktPrimitiveCode(geometry.primitive);
      if (code === undefined || !geometry.positionsCompressed) continue;

      const local = decompressPositions3WithAABB3(
        geometry.positionsCompressed, geometry.aabb, new Float32Array(geometry.positionsCompressed.length),
      );
      const m = getMeshWorldMatrix(mesh, coordinateSystem);
      const world = new Float32Array(local.length);
      for (let i = 0; i < local.length; i += 3) {
        const x = local[i], y = local[i + 1], z = local[i + 2];
        const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
        const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
        const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
        world[i] = wx; world[i + 1] = wy; world[i + 2] = wz;
        if (wx < worldAABB[0]) worldAABB[0] = wx;
        if (wy < worldAABB[1]) worldAABB[1] = wy;
        if (wz < worldAABB[2]) worldAABB[2] = wz;
        if (wx > worldAABB[3]) worldAABB[3] = wx;
        if (wy > worldAABB[4]) worldAABB[4] = wy;
        if (wz > worldAABB[5]) worldAABB[5] = wz;
      }

      const material: any = mesh.material;
      items.push({
        world,
        indices: code === 2 ? undefined : (geometry.indices ? new Uint32Array(geometry.indices) : undefined),
        colors: code === 2 && geometry.colorsCompressed ? new Uint8Array(geometry.colorsCompressed) : undefined,
        code,
        color: mesh.effectiveColor,
        opacity: mesh.effectiveOpacity,
        metallic: material?.metallic ?? 0,
        roughness: material?.roughness ?? 1,
      });
    }
    if (items.length > base) {
      eachEntityId.push(object.id);
      entityMeshBase.push(base);
    }
  }

  const numGeometries = items.length;
  if (numGeometries === 0) {
    for (let i = 0; i < 6; i++) worldAABB[i] = 0;
  }

  let totalPositions = 0, totalIndices = 0, totalColors = 0;
  for (const it of items) {
    totalPositions += it.world.length;
    if (it.indices) totalIndices += it.indices.length;
    if (it.colors) totalColors += it.colors.length;
  }

  const positions = new Uint16Array(totalPositions);
  const indices = new Uint32Array(totalIndices);
  const colors = new Uint8Array(totalColors);
  const eachGeometryPrimitiveType = new Uint8Array(numGeometries);
  const eachGeometryPositionsPortion = new Uint32Array(numGeometries);
  const eachGeometryNormalsPortion = new Uint32Array(numGeometries);
  const eachGeometryColorsPortion = new Uint32Array(numGeometries);
  const eachGeometryUVsPortion = new Uint32Array(numGeometries);
  const eachGeometryIndicesPortion = new Uint32Array(numGeometries);
  const eachGeometryEdgeIndicesPortion = new Uint32Array(numGeometries);
  const eachMeshGeometriesPortion = new Uint32Array(numGeometries);
  const eachMeshMatricesPortion = new Uint32Array(numGeometries);
  const eachMeshTextureSet = new Int32Array(numGeometries).fill(-1);
  const eachMeshMaterialAttributes = new Uint8Array(numGeometries * MESH_ATTRIBUTES);

  // Quantise world positions against the whole-model AABB (the single tile).
  const sx = worldAABB[3] - worldAABB[0] || 1;
  const sy = worldAABB[4] - worldAABB[1] || 1;
  const sz = worldAABB[5] - worldAABB[2] || 1;
  const quant = (v: number, min: number, span: number): number => {
    const q = Math.round(((v - min) / span) * 65535);
    return q < 0 ? 0 : q > 65535 ? 65535 : q;
  };

  let posBase = 0, indBase = 0, colBase = 0;
  for (let g = 0; g < numGeometries; g++) {
    const it = items[g];
    eachGeometryPrimitiveType[g] = it.code;
    eachGeometryPositionsPortion[g] = posBase;
    for (let i = 0; i < it.world.length; i += 3) {
      positions[posBase + i] = quant(it.world[i], worldAABB[0], sx);
      positions[posBase + i + 1] = quant(it.world[i + 1], worldAABB[1], sy);
      positions[posBase + i + 2] = quant(it.world[i + 2], worldAABB[2], sz);
    }
    posBase += it.world.length;

    eachGeometryIndicesPortion[g] = indBase;
    if (it.indices) {
      indices.set(it.indices, indBase);
      indBase += it.indices.length;
    }
    eachGeometryColorsPortion[g] = colBase;
    if (it.colors) {
      colors.set(it.colors, colBase);
      colBase += it.colors.length;
    }

    eachMeshGeometriesPortion[g] = g; // one geometry per mesh
    const a = g * MESH_ATTRIBUTES;
    eachMeshMaterialAttributes[a] = clampByte(it.color[0] * 255);
    eachMeshMaterialAttributes[a + 1] = clampByte(it.color[1] * 255);
    eachMeshMaterialAttributes[a + 2] = clampByte(it.color[2] * 255);
    eachMeshMaterialAttributes[a + 3] = clampByte(it.opacity * 255);
    eachMeshMaterialAttributes[a + 4] = clampByte(it.metallic * 255);
    eachMeshMaterialAttributes[a + 5] = clampByte(it.roughness * 255);
  }

  return {
    metadata: buildMetadata(sceneModel, dataModel),
    textureData: new Uint8Array(0),
    eachTextureDataPortion: new Uint32Array(0),
    eachTextureAttributes: new Uint16Array(0),
    positions,
    normals: new Int8Array(0),
    colors,
    uvs: new Float32Array(0),
    indices,
    edgeIndices: new Uint32Array(0),
    eachTextureSetTextures: new Int32Array(0),
    matrices: new Float32Array(IDENTITY16),
    reusedGeometriesDecodeMatrix: new Float32Array(IDENTITY16),
    eachGeometryPrimitiveType,
    eachGeometryAxisLabel: {},
    eachGeometryPositionsPortion,
    eachGeometryNormalsPortion,
    eachGeometryColorsPortion,
    eachGeometryUVsPortion,
    eachGeometryIndicesPortion,
    eachGeometryEdgeIndicesPortion,
    eachMeshGeometriesPortion,
    eachMeshMatricesPortion,
    eachMeshTextureSet,
    eachMeshMaterialAttributes,
    eachEntityId,
    eachEntityMeshesPortion: new Uint32Array(entityMeshBase),
    eachTileAABB: new Float64Array(worldAABB),
    eachTileEntitiesPortion: new Uint32Array([0]),
  };
}

function clampByte(v: number): number {
  v = Math.round(v);
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/** Build the model metadata (`metaObjects` + `propertySets`) from the DataModel. */
function buildMetadata(sceneModel: SceneModel, dataModel?: DataModel): any {
  const metaObjects: any[] = [];
  const propertySets: any[] = [];
  if (dataModel) {
    const parentOf: Record<string, string> = {};
    for (const rel of (dataModel as any).relationships || []) {
      if (rel.relatedObject && rel.relatingObject) parentOf[rel.relatedObject.id] = rel.relatingObject.id;
    }
    for (const o of Object.values((dataModel as any).objects) as any[]) {
      metaObjects.push({
        id: o.id,
        name: o.name ?? o.id,
        type: o.type ?? "Default",
        parent: parentOf[o.id] ?? null,
        propertySetIds: o.propertySetIds,
      });
    }
    for (const ps of Object.values((dataModel as any).propertySets) as any[]) {
      propertySets.push({
        id: ps.id,
        name: ps.name ?? ps.id,
        type: ps.type ?? "Default",
        properties: (ps.properties || []).map((p: any) => ({name: p.name, value: p.value})),
      });
    }
  }
  return {id: sceneModel.id, metaObjects, propertySets};
}
