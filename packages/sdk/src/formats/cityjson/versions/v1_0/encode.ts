import {yieldToHost} from "../../../../base/utils/yieldToHost";
import type {ModelEncodeParams} from "../../../ModelEncodeParams";
import type {LoaderProgress} from "../../../LoaderProgress";

// Quantisation grid for the CityJSON `transform`. 1mm is plenty for city-scale
// models in metres and keeps the integer vertices compact.
const PRECISION = 0.001;

/**
 * Encodes a {@link model!scene.SceneModel | SceneModel} (and optional
 * {@link model!data.DataModel | DataModel}) into a CityJSON document — the
 * inverse of the v1.0 {@link parse | parser}.
 *
 * Each SceneObject becomes a CityObject carrying a single `MultiSurface`
 * geometry: every triangle of the object's meshes is emitted as one surface
 * referencing the shared, quantised `vertices` array (the mesh world matrix is
 * embedded, since CityJSON surfaces reference absolute vertices). Mesh colour +
 * opacity become `appearance.materials` (`transparency = 1 - opacity`); the
 * DataModel supplies each CityObject's `type` and the parent/child links.
 *
 * Not handled (symmetric with the loader's v1 scope): the SceneModel
 * `coordinateSystem` (geometry is emitted in its stored space) and textures.
 *
 * @private
 */
export async function encode(params: ModelEncodeParams, options?: any): Promise<any> {
  const {sceneModel, dataModel} = params;
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

  if (!sceneModel) {
    throw "CityJSONExporter requires params.sceneModel";
  }

  // ── Materials — dedup by (colour, opacity) → CityJSON material index ──────
  const materials: any[] = [];
  const materialKeyToIndex = new Map<string, number>();
  const materialIndexFor = (color: any, opacity: number): number => {
    const r = color ? color[0] : 0.8, g = color ? color[1] : 0.8, b = color ? color[2] : 0.8;
    const a = opacity !== undefined && opacity !== null ? opacity : 1.0;
    const key = `${r}_${g}_${b}_${a}`;
    let idx = materialKeyToIndex.get(key);
    if (idx === undefined) {
      idx = materials.length;
      materials.push({name: `material-${idx}`, diffuseColor: [r, g, b], transparency: 1.0 - a});
      materialKeyToIndex.set(key, idx);
    }
    return idx;
  };

  // ── Pass 1 — bake each mesh's world vertices, track the scene extent ───────
  // CityJSON surfaces reference absolute vertices (no per-object transform),
  // so the mesh's world matrix is folded into the coordinates here.
  const objectMeshData: Array<{
    objectId: string;
    meshes: Array<{world: number[]; indices: number[]; matIdx: number}>;
  }> = [];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  const sceneObjects = Object.values(sceneModel.objects);
  for (let i = 0, len = sceneObjects.length; i < len; i++) {
    if ((i & 0x1F) === 0) await step("Encoding city objects", i, len);
    const sceneObject: any = sceneObjects[i];
    const meshesOut: Array<{world: number[]; indices: number[]; matIdx: number}> = [];
    const meshes = sceneObject.meshes;
    for (let j = 0, lenj = meshes.length; j < lenj; j++) {
      const sceneMesh = meshes[j];
      const geometry = sceneMesh.geometry;
      if (!geometry || !geometry.positionsCompressed || !geometry.aabb) {
        continue;
      }
      const m = sceneMesh.worldMatrix;
      const aabb = geometry.aabb;
      const pc = geometry.positionsCompressed;
      const world = new Array(pc.length);
      for (let k = 0, lenk = pc.length; k < lenk; k += 3) {
        // Dequantise from 16-bit storage to the geometry's local space …
        const lx = pc[k] * ((aabb[3] - aabb[0]) / 65535) + aabb[0];
        const ly = pc[k + 1] * ((aabb[4] - aabb[1]) / 65535) + aabb[1];
        const lz = pc[k + 2] * ((aabb[5] - aabb[2]) / 65535) + aabb[2];
        // … then transform by the mesh world matrix into absolute coordinates.
        const x = m ? m[0] * lx + m[4] * ly + m[8] * lz + m[12] : lx;
        const y = m ? m[1] * lx + m[5] * ly + m[9] * lz + m[13] : ly;
        const z = m ? m[2] * lx + m[6] * ly + m[10] * lz + m[14] : lz;
        world[k] = x; world[k + 1] = y; world[k + 2] = z;
        if (x < min[0]) min[0] = x; if (x > max[0]) max[0] = x;
        if (y < min[1]) min[1] = y; if (y > max[1]) max[1] = y;
        if (z < min[2]) min[2] = z; if (z > max[2]) max[2] = z;
      }
      const indices = geometry.indices
        ? Array.from(geometry.indices as ArrayLike<number>)
        : sequentialIndices(pc.length / 3);
      meshesOut.push({world, indices, matIdx: materialIndexFor(sceneMesh.color, sceneMesh.opacity)});
    }
    if (meshesOut.length > 0) {
      objectMeshData.push({objectId: sceneObject.id, meshes: meshesOut});
    }
  }

  // ── Quantisation transform ────────────────────────────────────────────────
  const scale = [PRECISION, PRECISION, PRECISION];
  const translate = isFinite(min[0]) ? [min[0], min[1], min[2]] : [0, 0, 0];

  // ── Pass 2 — shared vertex array (deduped ints) + CityObjects ─────────────
  const vertices: number[][] = [];
  const vertexKeyToIndex = new Map<string, number>();
  const vertexIndexFor = (x: number, y: number, z: number): number => {
    const ix = Math.round((x - translate[0]) / scale[0]);
    const iy = Math.round((y - translate[1]) / scale[1]);
    const iz = Math.round((z - translate[2]) / scale[2]);
    const key = `${ix}_${iy}_${iz}`;
    let idx = vertexKeyToIndex.get(key);
    if (idx === undefined) {
      idx = vertices.length;
      vertices.push([ix, iy, iz]);
      vertexKeyToIndex.set(key, idx);
    }
    return idx;
  };

  const cityObjects: any = {};
  for (let i = 0, len = objectMeshData.length; i < len; i++) {
    if ((i & 0x3F) === 0) await step("Building boundaries", i, len);
    const {objectId, meshes} = objectMeshData[i];
    const boundaries: number[][][] = [];
    const surfaceMaterials: number[] = [];
    for (const {world, indices, matIdx} of meshes) {
      const numVerts = world.length / 3;
      const localToGlobal = new Array(numVerts);
      for (let v = 0; v < numVerts; v++) {
        localToGlobal[v] = vertexIndexFor(world[v * 3], world[v * 3 + 1], world[v * 3 + 2]);
      }
      for (let t = 0; t + 2 < indices.length; t += 3) {
        // Each triangle is one CityJSON surface: an array of rings, one outer
        // ring of vertex indices, no holes.
        boundaries.push([[localToGlobal[indices[t]], localToGlobal[indices[t + 1]], localToGlobal[indices[t + 2]]]]);
        surfaceMaterials.push(matIdx);
      }
    }

    const dataObject = dataModel ? dataModel.objects[objectId] : undefined;
    const cityObject: any = {
      type: dataObject ? dataObject.type : "GenericCityObject",
      geometry: [{
        type: "MultiSurface",
        lod: "1",
        boundaries,
        // One shared material per object collapses to a single `value`; mixed
        // materials emit the per-surface `values` array.
        material: {default: uniform(surfaceMaterials) ? {value: surfaceMaterials[0]} : {values: surfaceMaterials}},
      }],
    };
    cityObjects[objectId] = cityObject;
  }

  // ── Relationships → parents / children ────────────────────────────────────
  if (dataModel) {
    const rels = dataModel.relationships;
    for (let i = 0, len = rels.length; i < len; i++) {
      const parentId = rels[i].relatingObject.id;
      const childId = rels[i].relatedObject.id;
      const child = cityObjects[childId];
      const parent = cityObjects[parentId];
      if (child) (child.parents || (child.parents = [])).push(parentId);
      if (parent) (parent.children || (parent.children = [])).push(childId);
    }
  }

  const cityJSON: any = {
    type: "CityJSON",
    version: "1.0",
    transform: {scale, translate},
    vertices,
    CityObjects: cityObjects,
  };
  if (isFinite(min[0])) {
    cityJSON.metadata = {geographicalExtent: [min[0], min[1], min[2], max[0], max[1], max[2]]};
  }
  if (materials.length > 0) {
    cityJSON.appearance = {materials};
  }
  await step("Building boundaries", objectMeshData.length, objectMeshData.length);
  return cityJSON;
}

function sequentialIndices(n: number): number[] {
  const a = new Array(n);
  for (let i = 0; i < n; i++) a[i] = i;
  return a;
}

function uniform(values: number[]): boolean {
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[0]) return false;
  }
  return true;
}
