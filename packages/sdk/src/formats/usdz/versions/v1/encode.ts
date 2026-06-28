import type {ModelEncodeParams} from "../../../ModelEncodeParams";
import type {LoaderProgress} from "../../../LoaderProgress";
import {yieldToHost} from "../../../../base/utils";
import {buildUSDA, type USDAScene, type USDAObject, type USDAMesh, type USDAMaterial} from "./buildUSDA";
import {packUSDZ} from "../../usdzWriter";
import {findTriplanarTextureSkip, triplanarSkipWarning} from "../../../findTriplanarTextureSkip";

/**
 * v1 USDZ encoder — writes a SceneModel to a USDZ package.
 *
 * Emits an ASCII USD (`.usda`) root layer (so this runs anywhere — no
 * wasm, unlike the loader) wrapped in a stored, 64-byte-aligned ZIP.
 * SceneModel geometry is stored quantised, so positions are dequantised
 * against each geometry's AABB and normals are oct-decoded here (the same
 * math the FBX exporter uses) before serialisation.
 *
 * Each SceneObject becomes an `Xform` of `Mesh` prims; each SceneMaterial
 * becomes a UsdPreviewSurface. Geometry is inlined per mesh (USD
 * reference-instancing is a future optimisation).
 *
 * @private
 */
const ROOT_LAYER = "model.usda";

export async function encode(params: ModelEncodeParams, options?: any): Promise<ArrayBuffer> {
  const onProgress: ((p: LoaderProgress) => void) | undefined = options?.onProgress;
  const signal: AbortSignal | undefined = options?.signal;
  onProgress?.({phase: "Encoding USDZ", current: 0, total: 1});

  const sceneModel: any = params.sceneModel;

  // USDZ materials here are colour-only (no texture maps), so triplanar
  // (world-projected) textures aren't exported regardless; warn so the loss
  // is visible. (Other textures are also dropped — a separate limitation.)
  if (sceneModel) {
    const triplanarSkip = findTriplanarTextureSkip(sceneModel);
    if (triplanarSkip.any) {
      const warn = options?.onWarning ?? ((m: string) => console.warn(m));
      warn(triplanarSkipWarning("USDZ", triplanarSkip));
    }
  }

  const objects: USDAObject[] = [];
  const materials: USDAMaterial[] = [];
  const materialNameById = new Map<string, string>();
  const usedObjectNames = new Set<string>();
  const usedMaterialNames = new Set<string>();

  const emitMaterial = (mat: any): string | undefined => {
    if (!mat || mat.id == null) return undefined;
    const existing = materialNameById.get(mat.id);
    if (existing) return existing;
    const name = uniqueName(sanitize(String(mat.id), "material"), usedMaterialNames);
    const m: USDAMaterial = {name};
    if (mat.color) m.color = [mat.color[0], mat.color[1], mat.color[2]];
    if (typeof mat.opacity === "number") m.opacity = mat.opacity;
    if (typeof mat.metallic === "number") m.metallic = mat.metallic;
    if (typeof mat.roughness === "number") m.roughness = mat.roughness;
    materials.push(m);
    materialNameById.set(mat.id, name);
    return name;
  };

  if (sceneModel) {
    for (const objectId in sceneModel.objects) {
      const sceneObject = sceneModel.objects[objectId];
      const meshes: USDAMesh[] = [];
      const usedMeshNames = new Set<string>();
      let meshSeq = 0;

      for (const mesh of sceneObject.meshes) {
        const geom = mesh.geometry;
        const positions = dequantizePositions(geom);
        if (!positions) continue;
        const indices = geom.indices ? Array.from(geom.indices as ArrayLike<number>) : sequential(positions.length / 3);
        const usdaMesh: USDAMesh = {
          name: uniqueName(`mesh_${meshSeq++}`, usedMeshNames),
          positions,
          indices,
          matrix: mesh.matrix ? Array.from(mesh.matrix as ArrayLike<number>) : undefined,
        };
        const normals = dequantizeNormals(geom);
        if (normals) usdaMesh.normals = normals;
        const materialName = emitMaterial(mesh.material);
        if (materialName) usdaMesh.materialName = materialName;
        meshes.push(usdaMesh);
      }

      if (meshes.length > 0) {
        objects.push({name: uniqueName(sanitize(objectId, "object"), usedObjectNames), meshes});
      }
      await yieldToHost(signal);
    }
  }

  const scene: USDAScene = {objects, materials};
  const usda = new TextEncoder().encode(buildUSDA(scene));
  const archive = packUSDZ([{name: ROOT_LAYER, data: usda}]);

  onProgress?.({phase: "Encoding USDZ", current: 1, total: 1});
  return archive;
}

// ── geometry dequantisation (mirrors the FBX exporter) ──────────────────

/** int16 quantised positions → float, using the geometry's AABB. */
function dequantizePositions(geom: any): number[] | null {
  const pc = geom?.positionsCompressed;
  const aabb = geom?.aabb;
  if (!pc || !aabb || pc.length === 0) return null;
  const sx = (aabb[3] - aabb[0]) / 65535;
  const sy = (aabb[4] - aabb[1]) / 65535;
  const sz = (aabb[5] - aabb[2]) / 65535;
  const out = new Array(pc.length);
  for (let i = 0; i < pc.length; i += 3) {
    out[i]     = pc[i]     * sx + aabb[0];
    out[i + 1] = pc[i + 1] * sy + aabb[1];
    out[i + 2] = pc[i + 2] * sz + aabb[2];
  }
  return out;
}

/** Oct-encoded normal pairs → unit 3D normals. */
function dequantizeNormals(geom: any): number[] | null {
  const oct = geom?.normalsCompressed;
  if (!oct || oct.length === 0) return null;
  const out = new Array((oct.length / 2) * 3);
  for (let i = 0, j = 0; i < oct.length; i += 2, j += 3) {
    let x = (2 * oct[i] + 1) / 255;
    let y = (2 * oct[i + 1] + 1) / 255;
    const z = 1 - Math.abs(x) - Math.abs(y);
    if (z < 0) {
      const tx = (1 - Math.abs(y)) * Math.sign(x);
      const ty = (1 - Math.abs(x)) * Math.sign(y);
      x = tx; y = ty;
    }
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    out[j] = x / len; out[j + 1] = y / len; out[j + 2] = z / len;
  }
  return out;
}

// ── name helpers ────────────────────────────────────────────────────────

/** Maps an arbitrary id to a valid USD prim identifier. */
function sanitize(s: string, fallback: string): string {
  let r = (s || "").replace(/[^A-Za-z0-9_]/g, "_");
  if (r.length === 0) r = fallback;
  if (/^[0-9]/.test(r)) r = "_" + r;
  return r;
}

function uniqueName(base: string, used: Set<string>): string {
  if (!used.has(base)) { used.add(base); return base; }
  let i = 1;
  while (used.has(`${base}_${i}`)) i++;
  const name = `${base}_${i}`;
  used.add(name);
  return name;
}

function sequential(n: number): number[] {
  const a = new Array(n);
  for (let i = 0; i < n; i++) a[i] = i;
  return a;
}
