import {
  createVec2Float64,
  createVec3Float64,
  cross3Vec3,
  dotVec3,
  lenVec3,
  mulVec3Scalar,
  normalizeVec3,
  subVec3
} from "../../../../base/math/vector";
// @ts-ignore
import {earcut} from './earcut';
import type {ModelParser} from "../../../ModelParser";
import {TrianglesPrimitive} from "../../../../base/constants";
import {yieldToHost} from "../../../../base/utils";
import type {LoaderProgress} from "../../../LoaderProgress";

const tempVec2a = createVec2Float64();
const tempVec3a = createVec3Float64();
const tempVec3b = createVec3Float64();
const tempVec3c = createVec3Float64();

const SCHEMA = "cityjson_2_0_1";

/**
 * @private
 */
export const parse: ModelParser = async (
  params,
  options
) => {
  const {fileData, sceneModel, dataModel} = params;
  const opts = options || {};
  const onProgress: ((p: LoaderProgress) => void) | undefined = opts.onProgress;
  const signal: AbortSignal | undefined = opts.signal;
  const progress: LoaderProgress = {phase: "", current: 0, total: 0};
  const step = async (phase: string, current: number, total: number): Promise<void> => {
    if (onProgress) {
      progress.phase = phase;
      progress.current = current;
      progress.total = total;
      onProgress(progress);
    }
    await yieldToHost(signal);
  };

  if (sceneModel || dataModel) {
    const ctx = {
      fileData,
      errors: [],
      warnings: [],
      vertices: (fileData.transform && sceneModel)
        ? transformVertices(fileData.vertices, fileData.transform)
        : fileData.vertices,
      sceneModel,
      dataModel,
      nextId: 0,
      options: opts
    };
    const ok = await parseCityJSON(ctx, step);
    if (!ok) {
      throw new Error(
        ctx.errors.length > 0
          ? `[CityJSONLoader] Failed to parse CityJSON file:${ctx.errors[0]}`
          : `[CityJSONLoader] Failed to parse CityJSON file: Unknown error`);
    }
  }
};


function transformVertices(vertices: any, transform: any) {
  const transformedVertices = [];
  const scale = transform.scale || createVec3Float64([1, 1, 1]);
  const translate = transform.translate || createVec3Float64([0, 0, 0]);
  for (let i = 0, j = 0; i < vertices.length; i++, j += 3) {
    const x = (vertices[i][0] * scale[0]) + translate[0];
    const y = (vertices[i][1] * scale[1]) + translate[1];
    const z = (vertices[i][2] * scale[2]) + translate[2];
    transformedVertices.push([x, y, z]);
  }
  return transformedVertices;
}

async function parseCityJSON(
  ctx: any,
  step: (phase: string, current: number, total: number) => Promise<void>,
): Promise<boolean> {
  const fileData = ctx.fileData;
  const cityObjects = fileData.CityObjects;
  const ids = Object.keys(cityObjects);
  const total = ids.length;
  for (let i = 0; i < total; i++) {
    if ((i & 0x1F) === 0) await step("Parsing city objects", i, total);
    const objectId = ids[i];
    if (!parseCityObject(ctx, cityObjects[objectId], objectId)) {
      return false;
    }
  }
  if (ctx.dataModel) {
    for (let i = 0; i < total; i++) {
      if ((i & 0x3F) === 0) await step("Building relationships", i, total);
      const objectId = ids[i];
      if (!parseRelationship(ctx, cityObjects[objectId], objectId)) {
        return false;
      }
    }
  }
  await step("Parsing city objects", total, total);
  return true;
}

function parseCityObject(ctx: any, cityObject: any, objectId: any): boolean {
  if (ctx.dataModel) {
    const result = ctx.dataModel.createObject({
      id: objectId,
      name: cityObject.type + " : " + objectId,
      type: cityObject.type,
      schema: SCHEMA,
      parent: cityObject.parents ? cityObject.parents[0] : null
    });
    if (!result.ok) {
      ctx.errors.push(`[CityJSONLoader] Failed to create data object for CityJSON object ${objectId} -> ${result.error}`);
      return false;
    }
  }
  if (ctx.sceneModel) {
    if (!(cityObject.geometry && cityObject.geometry.length > 0)) {
      ctx.warnings.push(`[CityJSONLoader] CityJSON object ${objectId} has no geometry`);
      return true;
    }
    const meshIds: string | any[] = [];
    for (let i = 0, len = cityObject.geometry.length; i < len; i++) {
      const geometry = cityObject.geometry[i];
      let objectMaterial;
      let surfaceMaterials;
      const appearance = ctx.fileData.appearance;
      if (appearance) {
        const materials = appearance.materials;
        if (materials) {
          const geometryMaterial = geometry.material;
          if (geometryMaterial) {
            const themeIds = Object.keys(geometryMaterial);
            if (themeIds.length > 0) {
              const themeId = themeIds[0];
              const theme = geometryMaterial[themeId];
              if (theme.value !== undefined) {
                objectMaterial = materials[theme.value];
              } else {
                const values = theme.values;
                if (values) {
                  surfaceMaterials = [];
                  for (let j = 0, lenj = values.length; j < lenj; j++) {
                    const value = values[i];
                    const surfaceMaterial = materials[value];
                    surfaceMaterials.push(surfaceMaterial);
                  }
                }
              }
            }
          }
        }
      }
      if (surfaceMaterials) {
        if (!parseGeometrySurfacesWithOwnMaterials(ctx, geometry, surfaceMaterials, meshIds)) {
          return false;
        }
      } else {
        if (!parseGeometrySurfacesWithSharedMaterial(ctx, geometry, objectMaterial, meshIds)) {
          return false;
        }
      }
    }
    if (meshIds.length > 0) {
      const result = ctx.sceneModel.createObject({
        id: objectId,
        schema: SCHEMA,
        meshIds: meshIds
      });
      if (!result.ok) {
        ctx.errors.push(`[CityJSONLoader] Failed to create scene object for CityJSON object ${objectId} -> ${result.error}`);
        return false;
      }
    }
  }
  return true;
}

function parseRelationship(ctx: any, cityObject: any, objectId: any): boolean {
  if (cityObject.parents) {
    const result = ctx.dataModel.createRelationship({
      relatingObjectId: cityObject.parents[0],
      relatedObjectId: objectId,
      type: "BasicAggregation"
    });
    if (!result.ok) {
      ctx.errors.push(`[CityJSONLoader] Failed to create relationship for CityJSON object ${objectId} -> ${result.error}`);
      return false;
    }
  }
  return true;
}

function parseGeometrySurfacesWithOwnMaterials(ctx: any, geometry: any, surfaceMaterials: any, meshIds: any): boolean {
  const geomType = geometry.type;
  switch (geomType) {
    case "MultiPoint":
      break;
    case "MultiLineString":
      break;
    case "MultiSurface":
    case "CompositeSurface":
      const surfaces = geometry.boundaries;
      return parseSurfacesWithOwnMaterials(ctx, surfaceMaterials, surfaces, meshIds);
    case "Solid":
      const shells = geometry.boundaries;
      for (let j = 0; j < shells.length; j++) {
        const surfaces = shells[j];
        return parseSurfacesWithOwnMaterials(ctx, surfaceMaterials, surfaces, meshIds);
      }
      break;
    case "MultiSolid":
    case "CompositeSolid":
      const solids = geometry.boundaries;
      for (let j = 0; j < solids.length; j++) {
        for (let k = 0; k < solids[j].length; k++) {
          const surfaces = solids[j][k];
          return parseSurfacesWithOwnMaterials(ctx, surfaceMaterials, surfaces, meshIds);
        }
      }
      break;
    case "GeometryInstance":
      break;
  }
  return true;
}

function parseSurfacesWithOwnMaterials(ctx: any, surfaceMaterials: any, surfaces: any, meshIds: any): boolean {
  const vertices = ctx.vertices;
  const sceneModel = ctx.sceneModel;
  for (let i = 0; i < surfaces.length; i++) {
    const surface = surfaces[i];
    const surfaceMaterial = surfaceMaterials[i] || {diffuseColor: [0.8, 0.8, 0.8], transparency: 1.0};
    const face = [];
    const holes = [];
    const sharedIndices: any[] = [];
    const geometryCfg: any = {
      positions: [],
      indices: []
    };
    for (let j = 0; j < surface.length; j++) {
      if (face.length > 0) {
        holes.push(face.length);
      }
      const newFace = extractLocalIndices(ctx, surface[j], sharedIndices, geometryCfg);
      face.push(...newFace);
    }
    if (face.length === 3) { // Triangle
      geometryCfg.indices.push(face[0]);
      geometryCfg.indices.push(face[1]);
      geometryCfg.indices.push(face[2]);
    } else if (face.length > 3) { // Polygon
      // Prepare to triangulate
      const pList = [];
      for (let k = 0; k < face.length; k++) {
        pList.push({
          x: vertices[sharedIndices[face[k]]][0],
          y: vertices[sharedIndices[face[k]]][1],
          z: vertices[sharedIndices[face[k]]][2]
        });
      }
      const normal = getNormalOfPositions(pList, createVec3Float64());
      // Convert to 2D
      const pv = [];
      for (let k = 0; k < pList.length; k++) {
        to2D(pList[k], normal, tempVec2a);
        pv.unshift(tempVec2a[0]);
        pv.unshift(tempVec2a[1]);
      }
      // Triangulate
      const tr = earcut(pv, holes, 2);
      // Create triangles
      for (let k = 0; k < tr.length; k += 3) {
        geometryCfg.indices.unshift(face[tr[k]]);
        geometryCfg.indices.unshift(face[tr[k + 1]]);
        geometryCfg.indices.unshift(face[tr[k + 2]]);
      }
    }
    const geometryId = "" + ctx.nextId++;
    const result = sceneModel.createGeometry({
      id: geometryId,
      primitive: TrianglesPrimitive,
      positions: geometryCfg.positions,
      indices: geometryCfg.indices
    });
    if (!result.ok) {
      ctx.errors.push(`[CityJSONLoader] Failed to create geometry for CityJSON surface -> ${result.error}`);
      return false;
    }
    const meshId = "" + ctx.nextId++;
    const result2 = sceneModel.createMesh({
      id: meshId,
      geometryId,
      color: (surfaceMaterial && surfaceMaterial.diffuseColor) ? surfaceMaterial.diffuseColor : [0.8, 0.8, 0.8],
      opacity: (surfaceMaterial && surfaceMaterial.transparency !== undefined) ? (1.0 - surfaceMaterial.transparency) : 1.0
    });
    if (!result2.ok) {
      ctx.errors.push(`[CityJSONLoader] Failed to create mesh for CityJSON surface -> ${result2.error}`);
      return false;
    }
    meshIds.push(meshId);
  }
  return true;
}

function parseGeometrySurfacesWithSharedMaterial(ctx: any, geometry: any, objectMaterial: any, meshIds: any): boolean {
  const sceneModel = ctx.sceneModel;
  const sharedIndices: any = [];
  const geometryCfg: any = {
    positions: [],
    indices: []
  };
  const geomType = geometry.type;
  switch (geomType) {
    case "MultiPoint":
      break;
    case "MultiLineString":
      break;
    case "MultiSurface":
    case "CompositeSurface":
      const surfaces = geometry.boundaries;
      if (!parseSurfacesWithSharedMaterial(ctx, surfaces, sharedIndices, geometryCfg)) {
        return false;
      }
      break;
    case "Solid":
      const shells = geometry.boundaries;
      for (let j = 0; j < shells.length; j++) {
        const surfaces = shells[j];
        if (!parseSurfacesWithSharedMaterial(ctx, surfaces, sharedIndices, geometryCfg)) {
          return false;
        }
      }
      break;
    case "MultiSolid":
    case "CompositeSolid":
      const solids = geometry.boundaries;
      for (let j = 0; j < solids.length; j++) {
        for (let k = 0; k < solids[j].length; k++) {
          const surfaces = solids[j][k];
          if (!parseSurfacesWithSharedMaterial(ctx, surfaces, sharedIndices, geometryCfg)) {
            return false;
          }
        }
      }
      break;
    case "GeometryInstance":
      break;
  }
  if (geometryCfg.positions.length > 0 && geometryCfg.indices.length > 0) {
    const geometryId = "" + ctx.nextId++;
    const geometryResult = sceneModel.createGeometry({
      id: geometryId,
      primitive: TrianglesPrimitive,
      positions: geometryCfg.positions,
      indices: geometryCfg.indices
    });
    if (!geometryResult.ok) {
      ctx.errors.push(`[CityJSONLoader] Failed to create geometry for CityJSON object -> ${geometryResult.error}`);
      return false;
    }
    const meshId = "" + ctx.nextId++;
    const meshResult = sceneModel.createMesh({
      id: meshId,
      geometryId,
      color: (objectMaterial && objectMaterial.diffuseColor) ? objectMaterial.diffuseColor : [0.8, 0.8, 0.8],
      opacity: 1.0
    });
    if (!meshResult.ok) {
      ctx.errors.push(`[CityJSONLoader] Failed to create mesh for CityJSON object -> ${meshResult.error}`);
      return false;
    }
    meshIds.push(meshId);
  }
  return true;
}

function parseSurfacesWithSharedMaterial(ctx: any, surfaces: any, sharedIndices: any, primitiveCfg: any): boolean {
  const vertices = ctx.vertices;
  for (let i = 0; i < surfaces.length; i++) {
    const boundary = [];
    const holes = [];
    for (let j = 0; j < surfaces[i].length; j++) {
      if (boundary.length > 0) {
        holes.push(boundary.length);
      }
      const newBoundary = extractLocalIndices(ctx, surfaces[i][j], sharedIndices, primitiveCfg);
      boundary.push(...newBoundary);
    }
    if (boundary.length === 3) { // Triangle
      primitiveCfg.indices.push(boundary[0]);
      primitiveCfg.indices.push(boundary[1]);
      primitiveCfg.indices.push(boundary[2]);
    } else if (boundary.length > 3) { // Polygon
      const pList = [];
      for (let k = 0; k < boundary.length; k++) {
        pList.push({
          x: vertices[sharedIndices[boundary[k]]][0],
          y: vertices[sharedIndices[boundary[k]]][1],
          z: vertices[sharedIndices[boundary[k]]][2]
        });
      }
      const normal = getNormalOfPositions(pList, createVec3Float64());
      const pv = [];
      for (let k = 0; k < pList.length; k++) {
        to2D(pList[k], normal, tempVec2a);
        pv.unshift(tempVec2a[0]);
        pv.unshift(tempVec2a[1]);
      }
      const tr = earcut(pv, holes, 2);
      for (let k = 0; k < tr.length; k += 3) {
        primitiveCfg.indices.unshift(boundary[tr[k]]);
        primitiveCfg.indices.unshift(boundary[tr[k + 1]]);
        primitiveCfg.indices.unshift(boundary[tr[k + 2]]);
      }
    }
  }
  return true;
}

function extractLocalIndices(ctx: any, boundary: any, sharedIndices: any, geometryCfg: any) {
  const vertices = ctx.vertices;
  const newBoundary = []
  for (let i = 0, len = boundary.length; i < len; i++) {
    const index = boundary[i];
    if (sharedIndices.includes(index)) {
      const vertexIndex = sharedIndices.indexOf(index);
      newBoundary.push(vertexIndex);
    } else {
      geometryCfg.positions.push(vertices[index][0]);
      geometryCfg.positions.push(vertices[index][1]);
      geometryCfg.positions.push(vertices[index][2]);
      newBoundary.push(sharedIndices.length);
      sharedIndices.push(index);
    }
  }
  return newBoundary
}

function getNormalOfPositions(positions: any, normal: any) {
  for (let i = 0; i < positions.length; i++) {
    let nexti = i + 1;
    if (nexti === positions.length) {
      nexti = 0;
    }
    normal[0] += ((positions[i].y - positions[nexti].y) * (positions[i].z + positions[nexti].z));
    normal[1] += ((positions[i].z - positions[nexti].z) * (positions[i].x + positions[nexti].x));
    normal[2] += ((positions[i].x - positions[nexti].x) * (positions[i].y + positions[nexti].y));
  }
  return normalizeVec3(normal);
}

function to2D(_p: any, _n: any, re: any) {
  const p = tempVec3a;
  const n = tempVec3b;
  const x3 = tempVec3c;
  p[0] = _p.x;
  p[1] = _p.y;
  p[2] = _p.z;
  n[0] = _n.x;
  n[1] = _n.y;
  n[2] = _n.z;
  x3[0] = 1.1;
  x3[1] = 1.1;
  x3[2] = 1.1;
  const dist = lenVec3(subVec3(x3, n));
  if (dist < 0.01) {
    x3[0] += 1.0;
    x3[1] += 2.0;
    x3[2] += 3.0;
  }
  const dot = dotVec3(x3, n);
  const tmp2 = mulVec3Scalar(n, dot, createVec3Float64());
  x3[0] -= tmp2[0];
  x3[1] -= tmp2[1];
  x3[2] -= tmp2[2];
  normalizeVec3(x3);
  const y3 = cross3Vec3(n, x3, createVec3Float64());
  const x = dotVec3(p, x3);
  const y = dotVec3(p, y3);
  re[0] = x;
  re[1] = y;
}
