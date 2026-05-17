import type {ModelParseParams} from "../../../ModelParseParams";
import {createUUID, yieldToHost} from "../../../../base/utils";
import {TrianglesPrimitive} from "../../../../base/constants";
import {buildBox} from "../../../../model/procgen/buildGeometry";
import {createMat4Float64, type Mat4, mulMat4} from "../../../../base/math/matrix";
import type {LoaderProgress} from "../../../LoaderProgress";

import {parseInstanceGraph} from "./parseInstanceGraph";
import {walkProducts} from "./walkProducts";

/**
 * Parse an ISO 10303-21 STEP (`.step` / `.stp`) text file into a
 * {@link model!scene.SceneModel | SceneModel} and/or a
 * {@link model!data.DataModel | DataModel}.
 *
 * **Status: partial — instance-graph walker landed.**
 *
 * Three passes:
 *
 *   1. **HEADER** — extracts `FILE_DESCRIPTION`, `FILE_NAME`,
 *      `FILE_SCHEMA`. The schema tag flows through to each emitted
 *      DataObject.
 *
 *   2. **DATA** — runs the {@link parseInstanceGraph} EXPRESS
 *      tokenizer + parser to build a `Map<ref, Entity>` plus a
 *      per-type bucket index. Bad statements are recovered at
 *      `;` boundaries; the lexer never throws.
 *
 *   3. **Product walk** — {@link walkProducts} resolves each
 *      `PRODUCT` along the
 *      `PRODUCT_DEFINITION_FORMATION → PRODUCT_DEFINITION →
 *       PRODUCT_DEFINITION_SHAPE → SHAPE_DEFINITION_REPRESENTATION →
 *       SHAPE_REPRESENTATION` chain to its first
 *      `AXIS2_PLACEMENT_3D` and bakes that into a 4×4 world matrix.
 *      Products without a resolvable chain fall back to a synthetic
 *      grid layout so the SceneObject is still pickable in
 *      isolation.
 *
 * Each PRODUCT becomes one SceneObject pointing at a single shared
 * placeholder cube, with its real placement applied to the mesh
 * matrix where the chain resolved.
 *
 * **Still TODO** — assembly walks
 * (`NEXT_ASSEMBLY_USAGE_OCCURRENCE` + `MAPPED_ITEM`),
 * `ITEM_DEFINED_TRANSFORMATION` for scaled / rotated frames, and
 * the actual B-Rep tessellator that replaces the placeholder cube
 * with the file's `MANIFOLD_SOLID_BREP` triangles.
 *
 * Routed for AP203, AP214, AP242 — all three currently land here.
 * Split into per-schema parsers when handling diverges (e.g.
 * AP242's PMI / kinematics extensions).
 *
 * @private
 */
export async function parse(params: ModelParseParams, options?: any): Promise<void> {

  const {fileData, sceneModel, dataModel} = params;
  if (!sceneModel && !dataModel) return;

  if (typeof fileData !== "string") {
    throw new Error("[STEPLoader.parse] Expected text file data");
  }

  const opts = options || {};
  const onProgress: ((p: LoaderProgress) => void) | undefined = opts.onProgress;
  const signal: AbortSignal | undefined = opts.signal;
  // Reusable progress payload — see the LoaderProgress contract:
  // consumers must copy out fields they retain.
  const progress: LoaderProgress = {phase: "Decoding STEP", current: 0, total: 0};
  const emit = (phase: string, current: number, total: number): void => {
    if (!onProgress) return;
    progress.phase = phase;
    progress.current = current;
    progress.total = total;
    onProgress(progress);
  };

  emit("Decoding STEP HEADER", 0, 0);
  await yieldToHost(signal);

  const header = parseHeader(fileData);

  emit("Building STEP instance graph", 0, 0);
  await yieldToHost(signal);

  // Parse the DATA section into a STEP instance graph. We slice the
  // section ourselves and hand the bounds to parseInstanceGraph so
  // the lexer doesn't waste time scanning HEADER + ENDSEC noise.
  const dataStart = fileData.indexOf("DATA;");
  const dataEnd = dataStart >= 0
    ? fileData.indexOf("ENDSEC;", dataStart)
    : -1;
  const graphStart = dataStart >= 0 ? dataStart + "DATA;".length : 0;
  const graphEnd   = dataEnd   >  0 ? dataEnd : fileData.length;
  const graph = parseInstanceGraph(fileData, graphStart, graphEnd);

  emit("Resolving STEP product placements", 0, 0);
  await yieldToHost(signal);

  const products = walkProducts(graph);

  // Namespace ids per load so multiple STEP files into the same Scene
  // don't collide. createUUID also gives us a unique placeholder
  // geometry id without needing to probe `sceneModel.geometries`.
  const baseId = createUUID();
  const placeholderGeometryId = `step-${baseId}-placeholder`;

  // Shared placeholder cube — used by every product that didn't
  // tessellate into real geometry.
  const needsPlaceholder = sceneModel && products.some(p => !p.geometry);
  if (needsPlaceholder) {
    const cube = buildBox({xSize: 0.5, ySize: 0.5, zSize: 0.5});
    if (cube.ok === false) {
      throw new Error(`[STEPLoader.parse] buildBox failed -> ${cube.error}`);
    }
    const geomRes = sceneModel!.createGeometry({
      id: placeholderGeometryId,
      primitive: TrianglesPrimitive,
      positions: cube.value.positions,
      indices:   cube.value.indices,
    });
    if (geomRes.ok === false) {
      throw new Error(`[STEPLoader.parse] createGeometry failed -> ${geomRes.error}`);
    }
  }

  // Per-PD tessellated geometries — emit one createGeometry per
  // unique TessellatedGeometry object reference so multi-instance
  // parts (4 bolts) share their geometry across all occurrences.
  const tessellatedGeomIds = new Map<object, string>();
  if (sceneModel) {
    for (const p of products) {
      if (!p.geometry) continue;
      if (tessellatedGeomIds.has(p.geometry)) continue;
      const id = `step-${baseId}-geom-${tessellatedGeomIds.size}`;
      const r = sceneModel.createGeometry({
        id,
        primitive: TrianglesPrimitive,
        positions: p.geometry.positions,
        normals:   p.geometry.normals,
        indices:   p.geometry.indices,
      });
      if (r.ok === false) {
        throw new Error(`[STEPLoader.parse] createGeometry failed -> ${r.error}`);
      }
      tessellatedGeomIds.set(p.geometry, id);
    }
  }

  // Synthetic-grid fallback for products without a resolved
  // placement, so they don't all stack at the origin.
  // PRODUCTs whose chain resolved go in at their real coords.
  const unplacedCount = products.reduce((n, p) => n + (p.hasPlacement ? 0 : 1), 0);
  const gridCols = Math.max(1, Math.ceil(Math.sqrt(unplacedCount)));
  const cell     = 1.5;

  const schema = header.schema || "STEP";
  let unplacedSeen = 0;

  for (let i = 0, len = products.length; i < len; i++) {
    if ((i & 0x3F) === 0) {
      emit("Building products", i, len);
      await yieldToHost(signal);
    }
    const product = products[i];

    // walkProducts has already disambiguated multi-occurrence
    // PRODUCTs by suffixing `id#N`. The collision check below is
    // a defensive guard for prior loaded models with overlapping
    // ids — namespacing into the per-load uuid avoids breaking
    // either side.
    let objectId = product.objectId || product.id || `step-${baseId}-${product.ref}`;
    if (sceneModel && sceneModel.objects[objectId]) {
      objectId = `step-${baseId}-${product.ref}-${i}`;
    }

    if (sceneModel) {
      const meshId = `${objectId}-mesh`;

      // Choose the geometry + mesh matrix for this product:
      //   - Real tessellated BREP: reference the per-PD geometry,
      //     matrix is just the world matrix (geometry already in
      //     PD-local coords).
      //   - BREP AABB only: shared placeholder cube, matrix is
      //     world × aabbBoxMat (scale + translate cube to bounds).
      //   - Placement only: shared placeholder cube, matrix is
      //     just the world matrix.
      //   - Nothing resolved: shared placeholder cube, position
      //     from the synthetic grid layout.
      const tessId = product.geometry ? tessellatedGeomIds.get(product.geometry) : undefined;
      const geometryId = tessId ?? placeholderGeometryId;

      let meshMatrix: Mat4 | undefined;
      let meshPosition: [number, number, number] | undefined;
      if (tessId) {
        meshMatrix = product.hasPlacement ? (product.matrix as Mat4) : undefined;
      } else if (product.aabb) {
        const aabbMat = aabbBoxMatrix(product.aabb);
        meshMatrix = product.hasPlacement
          ? mulMat4(product.matrix as Mat4, aabbMat, createMat4Float64())
          : aabbMat;
      } else if (product.hasPlacement) {
        meshMatrix = product.matrix as Mat4;
      } else {
        meshPosition = gridCellPosition(unplacedSeen++, gridCols, cell);
      }

      const meshRes = sceneModel.createMesh({
        id: meshId,
        geometryId,
        ...(meshMatrix   ? {matrix:   meshMatrix as any} : {}),
        ...(meshPosition ? {position: meshPosition}      : {}),
        color: [0.7, 0.7, 0.7],
        opacity: 1.0,
      });
      if (meshRes.ok === false) {
        throw new Error(`[STEPLoader.parse] createMesh failed -> ${meshRes.error}`);
      }
      const objRes = sceneModel.createObject({
        id: objectId,
        meshIds: [meshId],
      });
      if (objRes.ok === false) {
        throw new Error(`[STEPLoader.parse] createObject failed -> ${objRes.error}`);
      }
    }

    if (dataModel && !dataModel.objects[objectId]) {
      // Non-fatal: a DataModel rejection (e.g. id collision with a
      // prior loaded model) shouldn't abort the whole load.
      dataModel.createObject({
        id: objectId,
        type: "PRODUCT",
        schema,
        name: product.name || product.id || undefined,
        description: product.description || undefined,
      });
    }
  }

  emit("Building products", products.length, products.length);
}

function gridCellPosition(index: number, cols: number, cell: number): [number, number, number] {
  const col = index % cols;
  const row = Math.floor(index / cols);
  return [
    (col - (cols - 1) * 0.5) * cell,
    0,
    (row - (cols - 1) * 0.5) * cell,
  ];
}

/**
 * Build a 4×4 matrix that scales + translates a unit-extent
 * placeholder cube (positions in `[-0.5, 0.5]³`) so it occupies
 * the supplied AABB. A near-zero size on any axis is clamped up
 * to a thin shell (1e-3) so degenerate parts still appear and
 * remain pickable rather than collapsing to a 0-area mesh.
 */
function aabbBoxMatrix(
  aabb: [number, number, number, number, number, number],
): Mat4 {
  const sx = Math.max(aabb[3] - aabb[0], 1e-3);
  const sy = Math.max(aabb[4] - aabb[1], 1e-3);
  const sz = Math.max(aabb[5] - aabb[2], 1e-3);
  const cx = (aabb[0] + aabb[3]) * 0.5;
  const cy = (aabb[1] + aabb[4]) * 0.5;
  const cz = (aabb[2] + aabb[5]) * 0.5;
  const m = createMat4Float64();
  // Column-major: scale on the diagonal, translation in the last col.
  m[0]  = sx; m[1]  = 0;  m[2]  = 0;  m[3]  = 0;
  m[4]  = 0;  m[5]  = sy; m[6]  = 0;  m[7]  = 0;
  m[8]  = 0;  m[9]  = 0;  m[10] = sz; m[11] = 0;
  m[12] = cx; m[13] = cy; m[14] = cz; m[15] = 1;
  return m;
}


// ── HEADER parsing ────────────────────────────────────────────────

interface STEPHeader {
  description: string[];
  fileName: string;
  schema: string;
}

function parseHeader(text: string): STEPHeader {
  const headerStart = text.indexOf("HEADER;");
  const headerEnd   = text.indexOf("ENDSEC;", headerStart < 0 ? 0 : headerStart);
  const block = (headerStart >= 0 && headerEnd > headerStart)
    ? text.slice(headerStart, headerEnd)
    : "";
  return {
    description: matchAll(block, /FILE_DESCRIPTION\s*\(\s*\(\s*'([^']*)'/gi),
    fileName:    match1(block,  /FILE_NAME\s*\(\s*'([^']*)'/i)         ?? "",
    schema:      match1(block,  /FILE_SCHEMA\s*\(\s*\(\s*'([^']*)'/i)  ?? "",
  };
}

function match1(text: string, re: RegExp): string | null {
  const m = re.exec(text);
  return m ? m[1] : null;
}

function matchAll(text: string, re: RegExp): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(m[1]);
  return out;
}
