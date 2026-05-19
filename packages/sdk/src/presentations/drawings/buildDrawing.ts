import type {SceneModel} from "../../model/scene";
import {SDKErrorType, type SDKResult} from "../../base/core";
import {
  LinearEncoding,
  LinearFilter,
  LinesPrimitive,
  SolidPrimitive,
  sRGBEncoding,
  SurfacePrimitive,
  TrianglesPrimitive,
} from "../../base/constants";
import {decompressPositions3WithAABB3} from "../../base/math/compression";
import {transformPoint3} from "../../base/math/matrix";
import type {FloatArrayParam} from "../../base/math";
import type {Vec3} from "../../base/math/vector";
import {buildVectorText} from "../../model/procgen/buildGeometry/buildVectorText";

import {buildHLEDepthBuffer, visibleEdgeSegments} from "./hle/computeHLE";
import {extractFillsTiled} from "./fills/extractFillsTiled";
import {getSceneCollisionIndex} from "../../spatial/collision";

import type {DrawingProjectionFace} from "./DrawingProjectionFace";
import type {DrawingProjectionRay} from "./DrawingProjectionRay";
import type {DrawingProjectionDirection} from "./DrawingProjectionDirection";
import type {ProjectionBasis} from "./ProjectionBasis";
import type {DrawingProjectionParams} from "./DrawingProjectionParams";
import type {DrawingClipSpec} from "./DrawingClipSpec";
import type {ProgressiveSpec} from "./ProgressiveSpec";
import type {HLEOptions} from "./hle/HLEOptions";
import type {FillSpec} from "./fills/FillSpec";
import type {PanelSpec} from "./chrome/PanelSpec";
import type {TitleBlockSpec} from "./chrome/TitleBlockSpec";
import type {HLEDepthBuffer} from "./hle/HLEDepthBuffer";
import type {FillPolygons} from "./fills/FillPolygons";
import type {SpaceLabelSpec} from "./labels/SpaceLabelSpec";
import {computeLabelPlacement} from "./labels/computeLabelPlacement";


/**
 * Builds a 2D orthographic drawing of a 3D
 * {@link model!scene.SceneModel | SceneModel} — wireframes, filled
 * silhouettes, and section cut-aways — by projecting source
 * geometry onto one face of its AABB (or an arbitrary
 * {@link DrawingProjectionRay}) and emitting the result as a
 * new {@link model!scene.SceneModel | SceneModel} the host can render
 * in the same view as the source.
 *
 * The output mirrors the source SceneModel's hierarchy
 * (one {@link model!scene.SceneObject | SceneObject} per source
 * SceneObject, one {@link model!scene.SceneMesh | SceneMesh} per
 * source SceneMesh) and carries per-mesh colour from the
 * source, so the projection reads as a technical-drawing
 * "view" of the model that picks back to its source 1-to-1.
 *
 * Two output styles share the same pipeline:
 *
 * - **Wireframe** — projected crease/boundary edges as
 *   `LinesPrimitive` meshes. Optional hidden-line elimination
 *   (via the `hle` submodule) drops edges occluded by other
 *   source meshes from the projection direction.
 * - **Solid fill** — per-source-mesh filled silhouettes as
 *   `TrianglesPrimitive` meshes, with hidden-surface removal
 *   baked in: each pixel's "frontmost" owner is rasterised
 *   into a depth buffer, then per-owner masks are contour-
 *   traced and triangulated (see the `fills` submodule).
 *
 * Both styles can be emitted together or individually. Both
 * derive from the same depth buffer when both HLE and fills
 * are requested, so wireframe edges sit pixel-aligned on top
 * of the fill silhouettes.
 *
 * Per-style chrome — translucent backing panel, frame border,
 * and an optional title cartouche — rounds out the
 * technical-drawing look (see the `chrome` submodule).
 *
 * The caller owns both SceneModels. `sourceModel` is read-only;
 * `targetModel` is populated in-place with geometry, meshes, and
 * objects representing the projection. Source and target may live
 * in the same {@link model!scene.Scene | Scene} or in different ones —
 * the function reads world orientation and collision data from
 * `sourceModel.scene` and writes only to `targetModel`.
 *
 * SceneObject ids in the output follow the pattern
 * `"{sourceObjectId}__{targetModel.id}"`, with the target id
 * folded in so projecting the same source into multiple targets
 * produces distinct, Scene-globally unique ids. A pick on any
 * emitted geometry maps back to its source by stripping
 * `"__" + pickedObject.model.id`.
 *
 * Returns `targetModel` on success. On failure (missing source
 * geometry, a `createGeometry` / `createMesh` error from the
 * target, or a mid-projection target teardown), returns an
 * {@link base!core.SDKResult | SDKResult} error and leaves any
 * partial state on the target for the caller to handle.
 *
 * See {@link drawings | @xeokit/sdk/demo/systems/drawings} for
 * end-to-end usage examples.
 */
export async function buildDrawing(
    params: DrawingProjectionParams,
): Promise<SDKResult<SceneModel>> {
  const {sourceModel, targetModel: target, direction} = params;
  const offset = params.offset ?? 0;

  if (!sourceModel || sourceModel.destroyed) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildDrawing] sourceModel is missing or destroyed",
    };
  }
  if (!target || target.destroyed) {
    return {
      ok: false,
      type: SDKErrorType.InvalidInput,
      error: "[buildDrawing] targetModel is missing or destroyed",
    };
  }

  const aabb = params.aabb ?? computeWorldAABB(sourceModel);
  if (!aabb || aabb.length < 6 || !Number.isFinite(aabb[0])) {
    return {
      ok: false,
      type: SDKErrorType.InvalidOperation,
      error: "[buildDrawing] sourceModel has no projectable geometry to bound",
    };
  }

  // Resolve the direction (face name or ray) into a fully
  // orthonormal {right, up, forward} basis. From here on every
  // axis-dependent piece of the pipeline — rasteriser, fill
  // extraction, frame border, panel box, title block — works
  // off this basis instead of indexing world axes. World-up is
  // taken from the source's Scene since the source geometry
  // defines the orientation being projected.
  const sceneWorldUp = (sourceModel.scene.coordinateSystem as any).worldUp as [number, number, number] | undefined;
  const basis = resolveBasis(direction, sceneWorldUp);
  // Basis-space d-coord of the projection plane: just outside
  // the AABB on the camera side, offset by `offset`. Plane is
  // at `dMin - offset`, where `dMin = min(dot(corner, forward))`
  // over the 8 AABB corners.
  const dMin = computeBasisDMin(basis, aabb);
  const planeDepth = dMin - offset;
  const project = makeProjection(basis, planeDepth);

  // Resolve the optional cut-away clip planes to (point, normal)
  // pairs in world space. `params.clip` may be a single spec or
  // an array — typically the View's active SectionPlanes, fed in
  // by DrawingsPanel. Each plane contributes one row in the
  // per-plane scratch buffers; the per-edge tests below loop
  // over rows and reject on the first plane whose kept-side
  // test fails. Empty array → tests collapse to a single
  // `planeCount` compare.
  const clipSpecs: DrawingClipSpec[] = params.clip == null
      ? []
      : Array.isArray(params.clip) ? params.clip : [params.clip];
  const clipPlanesResolved = clipSpecs.map(spec => resolveClipPlane(spec, basis));
  const planeCount = clipPlanesResolved.length;
  const clipNx = new Float64Array(planeCount);
  const clipNy = new Float64Array(planeCount);
  const clipNz = new Float64Array(planeCount);
  const clipThr = new Float64Array(planeCount);
  for (let i = 0; i < planeCount; i++) {
    const p = clipPlanesResolved[i];
    clipNx[i] = p.normal[0];
    clipNy[i] = p.normal[1];
    clipNz[i] = p.normal[2];
    clipThr[i] = p.point[0] * p.normal[0] + p.point[1] * p.normal[1] + p.point[2] * p.normal[2];
  }

  // World-space anchor for every emitted mesh. The SceneGeometry
  // AABB is stored as Float32 (see `createAABB3Float32`), so
  // models far from the world origin would lose precision after
  // quantisation/dequantisation. We subtract this anchor off
  // every position before `createGeometry` and pass it back in
  // as the mesh's `position` (which lands in the mesh's Float64
  // local matrix), keeping the geometry coords small and the
  // world offset full-precision.
  const origin: [number, number, number] = [
    (aabb[0] + aabb[3]) * 0.5,
    (aabb[1] + aabb[4]) * 0.5,
    (aabb[2] + aabb[5]) * 0.5,
  ];

  // Progressive yields — when enabled, the per-source-object
  // emission loop awaits `yieldFn()` every `batchSize` objects
  // so the renderer can paint the partial result. Pure microtask
  // overhead when disabled (the async function still returns a
  // Promise; the body just never `await`s).
  const progressiveSpec: ProgressiveSpec | null =
      typeof params.progressive === "object"
          ? params.progressive as ProgressiveSpec
          : params.progressive
              ? {}
              : null;
  const batchSize  = Math.max(1, progressiveSpec?.batchSize ?? 50);
  const yieldFn    = progressiveSpec?.yield ?? defaultYield;

  // Per-projection SceneMaterial — carries the caller's
  // `lineWidth` over to the thick-line draw technique. Also
  // forwards the line `color`, because `SceneMesh.effectiveColor`
  // returns the material's color when a material is attached —
  // omitting it here would silently override the mesh's per-mesh
  // colour with the SceneMaterial default of white. Skipped
  // when no lineWidth was supplied so meshes keep their default
  // fall-through to `View.linesMaterial.lineWidth`.
  let lineMaterialId: string | undefined;
  if (params.lineWidth !== undefined && params.lineWidth > 0) {
    const matId = `${target.id}__lineMat`;
    const matRes = target.createMaterial({
      id:        matId,
      lineWidth: params.lineWidth,
      ...(params.color ? {color: params.color} : {}),
    });
    if (matRes.ok === false) {
      const err = {ok: false as const, type: matRes.type, error: matRes.error};
      return err;
    }
    lineMaterialId = matId;
  }

  // Optional translucent backing quad. Emitted *first* so it
  // sits behind every later line geometry in alpha-blending
  // order — the wireframe and frame lines read crisply over it.
  const frameMargin = (params.frame !== undefined && params.frame !== false)
      ? (typeof params.frame === "number" ? params.frame : 1.0)
      : 0;
  if (params.panel) {
    const spec: PanelSpec = typeof params.panel === "object" ? params.panel : {};
    const panelRes = emitPanel(target, basis, aabb, planeDepth, frameMargin, spec, origin, params.layerId);
    if (panelRes.ok === false) {
      const err = {ok: false as const, type: panelRes.type, error: panelRes.error};
      return err;
    }
  }
  if (params.frame !== undefined && params.frame !== false) {
    const frameColor = params.frameColor ?? params.color;
    const frameRes = emitFrame(target, basis, aabb, planeDepth, frameMargin, frameColor, origin, lineMaterialId, params.layerId);
    if (frameRes.ok === false) {
      const err = {ok: false as const, type: frameRes.type, error: frameRes.error};
      return err;
    }
  }

  // Optional title block at the bottom-right of the frame.
  if (params.titleBlock) {
    const tbRes = emitTitleBlock(
        target, basis, aabb, planeDepth, frameMargin,
        params.titleBlock,
        params.frameColor ?? params.color,
        origin,
        params.layerId,
    );
    if (tbRes.ok === false) {
      const err = {ok: false as const, type: tbRes.type, error: tbRes.error};
      return err;
    }
  }

  // Reusable scratch vectors — one per loop body, hoisted to
  // avoid per-edge Float32Array allocation. Each emit call
  // copies out of these before the next iteration mutates them.
  const v0: Vec3 = new Float32Array(3) as unknown as Vec3;
  const v1: Vec3 = new Float32Array(3) as unknown as Vec3;
  const p0: Vec3 = new Float32Array(3) as unknown as Vec3;
  const p1: Vec3 = new Float32Array(3) as unknown as Vec3;
  const sa: Vec3 = new Float32Array(3) as unknown as Vec3;
  const sb: Vec3 = new Float32Array(3) as unknown as Vec3;

  // Edge HLE and fill extraction historically shared one
  // depth+owner buffer; with fills now driven by the tiled
  // extractor those two paths split. HLE still uses
  // `buildHLEDepthBuffer` for its full-resolution depth (so
  // `visibleEdgeSegments` can sample any point), while fills
  // go through `extractFillsTiled` with `O(tileSize²)` peak
  // memory regardless of the effective output resolution.
  const wantHLE   = !!params.hideHidden;
  const wantFills = !!params.fill;

  // `transparentAsWireframe` filter — when on, transparent
  // meshes are excluded from both the HLE depth buffer and the
  // fill pass, but still flow through the edge-emission loop
  // below. Net effect: a glass pane draws only its outline and
  // doesn't hide the geometry behind it. Uses
  // `effectiveOpacity` so material-overridden opacity wins over
  // the per-mesh fallback — the same effective value the
  // renderer uses when deciding the opaque/transparent bin.
  const wantWireframeXP = params.transparentAsWireframe === true;
  const xpThreshold     = params.transparentThreshold ?? 0.99;
  const meshFilter = wantWireframeXP
      ? ((mesh: any /* SceneMesh */) => mesh.effectiveOpacity >= xpThreshold)
      : undefined;
  let hleBuffer: HLEDepthBuffer | undefined;
  let hleSamples = 0;
  let hleTolerance = 0;
  if (wantHLE) {
    const opts: HLEOptions = typeof params.hideHidden === "object"
        ? params.hideHidden
        : {};
    hleBuffer = await buildHLEDepthBuffer(sourceModel, basis, aabb, {
      resolution: opts.resolution,
      withOwners: false,
      // Forward the progressive yield so the HLE rasterise pass
      // releases the main thread between batches of source
      // SceneObjects — the heavy work is here, not in the
      // edge-emission loop further down.
      ...(progressiveSpec ? {yield: yieldFn} : {}),
      // Optional cut-away — same planes the edge loop tests
      // against below, so HLE depth only reflects kept-side
      // geometry and edges from the discarded side aren't
      // tested against silhouettes that no longer exist.
      ...(planeCount > 0 ? {clipPlanes: clipPlanesResolved} : {}),
      // Drop transparent meshes from the depth buffer so their
      // own edges (still emitted below) survive HLE testing.
      ...(meshFilter ? {meshFilter} : {}),
    });
    hleSamples   = Math.max(2, opts.samples   ?? 5);
    hleTolerance = Math.max(0, opts.tolerance ?? 0.01);
    if (target.destroyed) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[buildDrawing] target model '${target.id}' was destroyed mid-projection`,
      };
    }
  }

  // Pre-bucket fills by source-object id so the per-object loop
  // below can find every fill belonging to one source object in
  // O(1). Each bucket is one entry per *source SceneMesh* that
  // contributed visible pixels.
  let fillsBySource: Map<string, FillPolygons[]> | undefined;
  let fillSpec: FillSpec | undefined;
  if (wantFills) {
    fillSpec = typeof params.fill === "object" ? params.fill as FillSpec : {};
    const fillResolution = fillSpec.resolution
        ?? (wantHLE && typeof params.hideHidden === "object" ? params.hideHidden.resolution : undefined)
        ?? 2048;
    // `tileSize <= 0` or `tileSize ≥ resolution` collapses the
    // tiled pipeline to a single tile spanning the whole buffer
    // — equivalent to the legacy untiled extractor.
    const tileSize = fillSpec.tileSize ?? 1024;
    const fills = await extractFillsTiled({
      sourceModel,
      basis,
      aabb,
      planeDepth,
      resolution:     fillResolution,
      tileSize:       tileSize > 0 ? tileSize : fillResolution,
      collisionIndex: getSceneCollisionIndex(sourceModel.scene),
      minPixelArea:    fillSpec.minPixelArea,
      simplifyEpsilon: fillSpec.simplifyEpsilon,
      // Forward the progressive yield + a cancel-on-destroy
      // check so a teardown mid-extraction stops the rest of
      // the tiles from rasterising once the caller no longer
      // wants the result.
      ...(progressiveSpec ? {
        yield:     yieldFn,
        cancelled: () => target.destroyed,
      } : {}),
      // Same cut-away planes as the HLE rasteriser so fills and
      // wireframe edges agree about what's kept.
      ...(planeCount > 0 ? {clipPlanes: clipPlanesResolved} : {}),
      // Same mesh filter as HLE — transparent meshes get no
      // fill polygon, matching their non-occluding depth role.
      ...(meshFilter ? {meshFilter} : {}),
    });
    if (target.destroyed) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[buildDrawing] target model '${target.id}' was destroyed mid-projection`,
      };
    }
    fillsBySource = new Map();
    for (const f of fills) {
      let bucket = fillsBySource.get(f.sourceObjectId);
      if (!bucket) {
        bucket = [];
        fillsBySource.set(f.sourceObjectId, bucket);
      }
      bucket.push(f);
    }
  }

  let edgeCount = 0;
  let fillCount = 0;
  let objectsSinceYield = 0;
  // Callers can ask for a fills-only projection by setting
  // `lines: false`. Skip the per-mesh edge walk entirely in
  // that case — positions stays empty and the emission block
  // below won't create a line geometry or mesh.
  const emitLines = params.lines !== false;

  for (const objectId of Object.keys(sourceModel.objects)) {
    const srcObj = sourceModel.objects[objectId];
    const baseId = sanitizeId(objectId);
    const targetSuffix = `__${target.id}`;
    const objId   = `${baseId}${targetSuffix}`;

    // The drawing mirrors the source hierarchy: one
    // SceneObject per source SceneObject, one SceneMesh per
    // source SceneMesh (for both lines and fills). meshIds
    // accumulates the per-source-mesh drawing mesh ids
    // emitted below; the SceneObject only materialises if
    // there's at least one of them.
    const meshIds: string[] = [];

    // Index source meshes by id so the fill-emission pass can
    // O(1)-look up the source mesh's colour for each emitted
    // fill mesh.
    const srcMeshById = new Map<string, typeof srcObj.meshes[number]>();
    for (const m of srcObj.meshes) srcMeshById.set(m.id, m);

    // ── Per-source-mesh LINE emission ───────────────────────
    if (emitLines) {
      for (const mesh of srcObj.meshes) {
        const geom = mesh.geometry;
        if (!geom) continue;
        // Edge indices only exist on triangle-flavoured primitives.
        if (geom.primitive !== TrianglesPrimitive &&
            geom.primitive !== SolidPrimitive &&
            geom.primitive !== SurfacePrimitive) continue;
        const edgeIndices = geom.edgeIndices;
        if (!edgeIndices || edgeIndices.length < 2) continue;
        if (!geom.positionsCompressed || !geom.aabb) continue;

        const worldMatrix = mesh.worldMatrix;

        // Decompress positions to mesh-local (RTC-tile-local)
        // coords once per mesh. transformPoint3 then folds in
        // the world matrix per endpoint.
        const localPositions = decompressPositions3WithAABB3(
            geom.positionsCompressed as FloatArrayParam,
            geom.aabb,
        );

        const positions: number[] = [];
        const indices:   number[] = [];
        let vertexCount = 0;

        if (wantHLE && hleBuffer) {
          // HLE path: visibility splits each source edge into
          // zero or more independent sub-segments at occlusion
          // boundaries. The sub-segment endpoints aren't source
          // vertices, so polyline chaining doesn't tile cleanly
          // — keep the per-edge / per-sub-segment emission here
          // and accept that joints won't fire when HLE is on.
          for (let i = 0, len = edgeIndices.length; i < len; i += 2) {
            const aBase = edgeIndices[i]     * 3;
            const bBase = edgeIndices[i + 1] * 3;
            v0[0] = localPositions[aBase];
            v0[1] = localPositions[aBase + 1];
            v0[2] = localPositions[aBase + 2];
            v1[0] = localPositions[bBase];
            v1[1] = localPositions[bBase + 1];
            v1[2] = localPositions[bBase + 2];

            transformPoint3(worldMatrix, v0, p0);
            transformPoint3(worldMatrix, v1, p1);

            if (planeCount > 0) {
              const mx = (p0[0] + p1[0]) * 0.5;
              const my = (p0[1] + p1[1]) * 0.5;
              const mz = (p0[2] + p1[2]) * 0.5;
              let clipped = false;
              for (let pi = 0; pi < planeCount; pi++) {
                if (mx * clipNx[pi] + my * clipNy[pi] + mz * clipNz[pi] < clipThr[pi]) {
                  clipped = true;
                  break;
                }
              }
              if (clipped) continue;
            }

            const segments = visibleEdgeSegments(
                hleBuffer, p0, p1, hleSamples, hleTolerance,
            );
            for (let s = 0; s < segments.length; s++) {
              const seg = segments[s];
              sa[0] = seg.a[0]; sa[1] = seg.a[1]; sa[2] = seg.a[2];
              sb[0] = seg.b[0]; sb[1] = seg.b[1]; sb[2] = seg.b[2];
              project(sa);
              project(sb);
              positions.push(sa[0], sa[1], sa[2]);
              positions.push(sb[0], sb[1], sb[2]);
              indices.push(vertexCount, vertexCount + 1);
              vertexCount += 2;
              edgeCount++;
            }
          }
        } else {
          // Polyline-aware path: dedupe positions by source
          // vertex index and emit edges in greedy chain order.
          // Two consecutive chain segments share their endpoint
          // index → the thick-line shader's `prev.idxB == cur.idxA`
          // check fires → miter joints at every crease junction.
          //
          // Each surviving (post-clip) edge contributes one
          // (srcVtxA, srcVtxB) entry to `edgePool`. The chain
          // builder then walks unvisited edges, hopping by
          // shared vertex at the current chain's end, picking
          // the first available neighbour at higher-valence
          // junctions (sufficient for BIM crease topology
          // where most junctions are 2-valence; corners
          // naturally break into separate chains).
          const sourceVertCount = (localPositions.length / 3) | 0;
          const vertexOutIndex = new Int32Array(sourceVertCount).fill(-1);

          // 1. Collect surviving edges + their endpoints in
          //    source-vertex-index space.
          const edgePool: number[] = [];   // packed (a, b) pairs
          for (let i = 0, len = edgeIndices.length; i < len; i += 2) {
            const a = edgeIndices[i];
            const b = edgeIndices[i + 1];
            if (a === b) continue;
            if (planeCount > 0) {
              const aBase = a * 3;
              const bBase = b * 3;
              v0[0] = localPositions[aBase];
              v0[1] = localPositions[aBase + 1];
              v0[2] = localPositions[aBase + 2];
              v1[0] = localPositions[bBase];
              v1[1] = localPositions[bBase + 1];
              v1[2] = localPositions[bBase + 2];
              transformPoint3(worldMatrix, v0, p0);
              transformPoint3(worldMatrix, v1, p1);
              const mx = (p0[0] + p1[0]) * 0.5;
              const my = (p0[1] + p1[1]) * 0.5;
              const mz = (p0[2] + p1[2]) * 0.5;
              let clipped = false;
              for (let pi = 0; pi < planeCount; pi++) {
                if (mx * clipNx[pi] + my * clipNy[pi] + mz * clipNz[pi] < clipThr[pi]) {
                  clipped = true;
                  break;
                }
              }
              if (clipped) continue;
            }
            edgePool.push(a, b);
          }

          if (edgePool.length > 0) {
            // 2. Adjacency: per source vertex → list of edge ids.
            const numEdges = edgePool.length / 2;
            const adjacency = new Map<number, number[]>();
            for (let e = 0; e < numEdges; e++) {
              const a = edgePool[e * 2];
              const b = edgePool[e * 2 + 1];
              let listA = adjacency.get(a);
              if (!listA) { listA = []; adjacency.set(a, listA); }
              listA.push(e);
              let listB = adjacency.get(b);
              if (!listB) { listB = []; adjacency.set(b, listB); }
              listB.push(e);
            }

            // 3. Greedy chain walk. The chain emits directed
            //    segments (curA → curB); the next segment must
            //    start at curB so the shader's prev.idxB ==
            //    cur.idxA detection fires.
            const visited = new Uint8Array(numEdges);
            const ensureOutIndex = (srcVtx: number): number => {
              let out = vertexOutIndex[srcVtx];
              if (out >= 0) return out;
              const base = srcVtx * 3;
              v0[0] = localPositions[base];
              v0[1] = localPositions[base + 1];
              v0[2] = localPositions[base + 2];
              transformPoint3(worldMatrix, v0, p0);
              project(p0);
              out = vertexCount;
              positions.push(p0[0], p0[1], p0[2]);
              vertexCount++;
              vertexOutIndex[srcVtx] = out;
              return out;
            };
            const findUnvisitedNeighbour = (
                vertex: number, exclude: number,
            ): {edgeIndex: number; far: number} | null => {
              const list = adjacency.get(vertex);
              if (!list) return null;
              for (const e of list) {
                if (e === exclude || visited[e]) continue;
                const ea = edgePool[e * 2];
                const eb = edgePool[e * 2 + 1];
                return {edgeIndex: e, far: ea === vertex ? eb : ea};
              }
              return null;
            };

            for (let start = 0; start < numEdges; start++) {
              if (visited[start]) continue;
              visited[start] = 1;
              let curA = edgePool[start * 2];
              let curB = edgePool[start * 2 + 1];
              indices.push(ensureOutIndex(curA), ensureOutIndex(curB));
              edgeCount++;
              // Extend forward from the chain's end vertex.
              let lastEdge = start;
              while (true) {
                const next = findUnvisitedNeighbour(curB, lastEdge);
                if (!next) break;
                visited[next.edgeIndex] = 1;
                // Emit the directed segment (curB → far) so its
                // first endpoint matches the previous segment's
                // last endpoint.
                indices.push(ensureOutIndex(curB), ensureOutIndex(next.far));
                edgeCount++;
                lastEdge = next.edgeIndex;
                curB = next.far;
              }
            }
          }
        }

        if (positions.length === 0) continue;

        const meshBase = sanitizeId(mesh.id);
        const lineGeometryId = `${meshBase}${targetSuffix}_geom`;
        const lineMeshId     = `${meshBase}${targetSuffix}_mesh`;
        recenterPositions(positions, origin);
        const gRes = target.createGeometry({
          id: lineGeometryId,
          primitive: LinesPrimitive,
          positions,
          indices,
        });
        if (gRes.ok === false) {
          const err = {ok: false as const, type: gRes.type, error: gRes.error};
          return err;
        }
        // Line colour: an explicit `params.color` overrides
        // (technical-drawing convention — uniform line colour
        // across the whole projection); otherwise fall back to
        // the source mesh's *effective* colour so the drawing
        // mirrors the source SceneModel's per-mesh styling. We
        // use `effectiveColor` rather than `mesh.color` so loaders
        // that route colour through a SceneMaterial (OBJ, glTF,
        // XGF…) are honoured — `mesh.color` would be the default
        // white in those cases and every fill would look grey.
        const srcLineColor = mesh.effectiveColor;
        const lineColor: [number, number, number] = params.color
            ? [params.color[0], params.color[1], params.color[2]]
            : [srcLineColor[0], srcLineColor[1], srcLineColor[2]];
        const mRes = target.createMesh({
          id: lineMeshId,
          geometryId: lineGeometryId,
          position: origin,
          color: lineColor,
          ...(lineMaterialId ? {materialId: lineMaterialId} : {}),
        });
        if (mRes.ok === false) {
          const err = {ok: false as const, type: mRes.type, error: mRes.error};
          return err;
        }
        meshIds.push(lineMeshId);
      }
    }

    // ── Per-source-mesh FILL emission ────────────────────────
    const objFills = fillsBySource?.get(objectId);
    if (objFills) {
      for (const fill of objFills) {
        const meshBase = sanitizeId(fill.sourceMeshId);
        const fillGeometryId = `${meshBase}${targetSuffix}_fill_geom`;
        const fillMeshId     = `${meshBase}${targetSuffix}_fill_mesh`;

        // Fill positions arrive in world coordinates from the
        // extractor — recenter them onto the projection's
        // RTC-anchor origin like the line positions so the
        // SceneMesh's Float64 local matrix carries the world
        // offset and the Float32 geometry stays sub-AABB-sized.
        const fillPositions = fill.positions.slice();
        recenterPositions(fillPositions, origin);
        const fgRes = target.createGeometry({
          id: fillGeometryId,
          primitive: TrianglesPrimitive,
          positions: fillPositions,
          indices: fill.indices,
        });
        if (fgRes.ok === false) {
          const err = {ok: false as const, type: fgRes.type, error: fgRes.error};
          return err;
        }
        // Fill colour: an explicit `fillSpec.color` wins (lets
        // callers tint every fill uniformly — e.g. a "ghosted
        // drawing" look); otherwise inherit the source
        // SceneMesh's *effective* colour so the drawing
        // mirrors the source SceneModel's per-mesh styling.
        // Using `effectiveColor` rather than `mesh.color` is
        // important: loaders (OBJ, glTF, XGF) typically route
        // colour through a SceneMaterial attached to the mesh,
        // leaving `mesh.color` at its default white and the
        // colour only reachable via the material. The same
        // path picks up MaterialMaps.flatColor when a procgen
        // painter populated one, since the palette forwards
        // that onto the SceneMaterial's `color`.
        const srcMesh = srcMeshById.get(fill.sourceMeshId);
        const srcFillColor = srcMesh?.effectiveColor;
        const fillColor: [number, number, number] = fillSpec?.color
            ? [fillSpec.color[0], fillSpec.color[1], fillSpec.color[2]]
            : srcFillColor
                ? [srcFillColor[0], srcFillColor[1], srcFillColor[2]]
                : [0.92, 0.93, 0.95];
        // Fill opacity: explicit `fillSpec.opacity` wins;
        // otherwise mirror the source mesh's
        // `effectiveOpacity` so a painter's `flatOpacity`
        // (e.g. glass at 0.35) survives into the drawing.
        // Drops to 1.0 only when neither side has anything to
        // say, preserving the opaque default for materials
        // that didn't bother declaring a flat opacity.
        const srcFillOpacity = srcMesh?.effectiveOpacity;
        const fillOpacity = fillSpec?.opacity
            ?? (typeof srcFillOpacity === "number" ? srcFillOpacity : 1.0);
        const fmRes = target.createMesh({
          id: fillMeshId,
          geometryId: fillGeometryId,
          position: origin,
          color:   fillColor,
          opacity: fillOpacity,
        });
        if (fmRes.ok === false) {
          const err = {ok: false as const, type: fmRes.type, error: fmRes.error};
          return err;
        }
        meshIds.push(fillMeshId);
        fillCount++;
      }
    }

    if (meshIds.length === 0) continue;

    const oRes = target.createObject({
      id: objId,
      meshIds,
      clippable: false,
      ...(params.layerId ? {layerId: params.layerId} : {}),
    });
    if (oRes.ok === false) {
      const err = {ok: false as const, type: oRes.type, error: oRes.error};
      return err;
    }

    // Yield to the host every `batchSize` emitted objects so the
    // renderer can paint the partial drawing. After the yield,
    // bail cleanly if the caller's teardown destroyed the target
    // SceneModel while we were suspended — otherwise the next
    // createGeometry / createMesh would log a destroyed-model
    // error.
    if (progressiveSpec) {
      objectsSinceYield++;
      if (objectsSinceYield >= batchSize) {
        objectsSinceYield = 0;
        await yieldFn();
        if (target.destroyed) {
          return {
            ok: false,
            type: SDKErrorType.InvalidOperation,
            error: `[buildDrawing] target model '${target.id}' was destroyed mid-projection`,
          };
        }
      }
    }
  }

  // ── Phase 5: Space labels (Phase 1 of the labelling system) ─
  //
  // Render text inside each eligible source object's fill
  // polygon. Eligibility is the intersection of:
  //
  //   1. A bucket exists in `fillsBySource` — the fill pass
  //      actually emitted polygons for this object (so the
  //      caller asked for `fill: true` and the projection
  //      didn't skip the object).
  //   2. The supplied `data` graph has a DataObject with the
  //      same id, and its `type` is in `spaceLabels.dataTypes`
  //      (defaults to `["IfcSpace"]`).
  //   3. The pole-of-inaccessibility solver returned a
  //      placement whose inscribed circle radius scales the
  //      label size above `minFontSize` and whose polygon
  //      area is above `minArea`.
  //
  // Each label is one SceneObject (`__spaceLabel__<sourceId>`)
  // carrying one LinesPrimitive geometry — the same shape as
  // the existing title-block emission, so it picks up the
  // global line material / lineWidth automatically.
  if (params.spaceLabels && fillsBySource) {
    if (!params.data) {
      return {
        ok: false,
        type: SDKErrorType.InvalidInput,
        error: "[buildDrawing] `spaceLabels` requires `data` — pass the source model's Data graph so the label pass can read each space's name + type",
      };
    }
    const labelSpec: SpaceLabelSpec = typeof params.spaceLabels === "object"
        ? params.spaceLabels
        : {};
    const dataTypes  = labelSpec.dataTypes  ?? ["IfcSpace"];
    const minArea    = labelSpec.minArea    ?? 0.5;
    const fontScale  = labelSpec.fontScale  ?? 0.30;
    const maxFontSize = labelSpec.maxFontSize ?? 0.45;
    const minFontSize = labelSpec.minFontSize ?? 0.10;
    const upperCase  = labelSpec.upperCase !== false;
    const showArea   = labelSpec.showArea === true;
    const labelColor = labelSpec.color ?? params.color;
    const labelLineWidth = labelSpec.lineWidth ?? params.lineWidth;
    const labelLayerId   = labelSpec.layerId  ?? params.layerId;

    // Per-line vertical spacing. buildVectorText emits Hershey
    // glyphs whose cap-height ≈ size; a line-gap of 0.4*size
    // gives an 1.4*size advance that reads as proper paragraph
    // leading at AEC drafting scale.
    const lineAdvance = 1.4;

    const typeSet = new Set(dataTypes);
    const dataObjects = (params.data as any).objects as Record<string, {type: string; name?: string}>;

    for (const [sourceObjectId, fills] of fillsBySource) {
      const dobj = dataObjects?.[sourceObjectId];
      if (!dobj || !typeSet.has(dobj.type)) continue;
      const rawName = (dobj.name ?? "").trim();
      if (!rawName) continue;

      const place = computeLabelPlacement(fills, basis);
      if (!place) continue;
      if (place.area < minArea) continue;

      let fontSize = place.inscribedRadius * fontScale * 2;  // 2 * radius * scale → diameter-relative
      if (fontSize > maxFontSize) fontSize = maxFontSize;
      if (fontSize < minFontSize) continue;

      const lines: string[] = [
        upperCase ? rawName.toUpperCase() : rawName,
      ];
      if (showArea) {
        lines.push(`${place.area.toFixed(1)} m²`);
      }

      // Render each line via buildVectorText, measure its
      // 2D extents, then map (line-local x, y) → world via
      // basis.right / basis.up offset from the placement
      // anchor on the projection plane. Lines stack downward
      // around a vertical centre on the anchor (so a name +
      // area pair brackets the anchor evenly).
      const positions: number[] = [];
      const indices:   number[] = [];
      let vertexCount = 0;
      const r = basis.right, up = basis.up, f = basis.forward;
      // (u, v, planeDepth) → world: u*right + v*up + planeDepth*forward
      const worldXAt = (u: number, v: number): number => u * r[0] + v * up[0] + planeDepth * f[0];
      const worldYAt = (u: number, v: number): number => u * r[1] + v * up[1] + planeDepth * f[1];
      const worldZAt = (u: number, v: number): number => u * r[2] + v * up[2] + planeDepth * f[2];

      const totalLines = lines.length;
      // First line's baseline `v` so the whole block is
      // centred vertically on the anchor. Block height is
      // `(totalLines - 1) * fontSize * lineAdvance + fontSize`
      // (last line's cap reaches `fontSize` above its baseline).
      const blockHeight = (totalLines - 1) * fontSize * lineAdvance + fontSize;
      const firstBaselineV = place.v + blockHeight * 0.5 - fontSize;

      for (let li = 0; li < lines.length; li++) {
        const lineText = lines[li];
        if (!lineText) continue;
        const tRes = buildVectorText({size: fontSize, origin: [0, 0, 0], text: lineText});
        if (!tRes.ok) continue;
        const arr = tRes.value as {positions: number[]; indices: number[]};
        // Measure line width — buildVectorText emits glyphs
        // advancing along +x from x=0, so width = max(x).
        let maxX = 0;
        for (let i = 0; i < arr.positions.length; i += 3) {
          if (arr.positions[i] > maxX) maxX = arr.positions[i];
        }
        const baselineV = firstBaselineV - li * fontSize * lineAdvance;
        const startU    = place.u - maxX * 0.5;
        const base = vertexCount;
        for (let i = 0; i < arr.positions.length; i += 3) {
          const lx = arr.positions[i];
          const ly = arr.positions[i + 1];
          const u = startU + lx;
          const v = baselineV + ly;
          positions.push(worldXAt(u, v), worldYAt(u, v), worldZAt(u, v));
        }
        const vCount = arr.positions.length / 3;
        for (let i = 0; i < arr.indices.length; i++) {
          indices.push(base + arr.indices[i]);
        }
        vertexCount = base + vCount;
      }

      if (positions.length === 0) continue;

      const gid = `${target.id}__spaceLabel__${sourceObjectId}__geom`;
      const mid = `${target.id}__spaceLabel__${sourceObjectId}__mesh`;
      const oid = `${target.id}__spaceLabel__${sourceObjectId}`;

      recenterPositions(positions, origin);
      const gRes = target.createGeometry({
        id: gid,
        primitive: LinesPrimitive,
        positions,
        indices,
      });
      if (gRes.ok === false) continue;
      const mRes = target.createMesh({
        id: mid,
        geometryId: gid,
        position: origin,
        ...(labelColor ? {color: labelColor} : {}),
      });
      if (mRes.ok === false) continue;
      const oRes = target.createObject({
        id: oid,
        meshIds: [mid],
        clippable: false,
        ...(labelLayerId ? {layerId: labelLayerId} : {}),
      });
      // Failure to create the object isn't fatal for the
      // overall projection — the rest of the drawing is
      // already on the target.
      if (oRes.ok === false) continue;
      void labelLineWidth;  // Threaded through the lineMaterial later if we add per-label widths.
    }
  }

  // A projection counts as successful if it produced either
  // edges or fills — fills alone are a legitimate output when
  // the caller asks for `fill` and the source geometry has no
  // crease/boundary edge indices (rare for BIM, but possible
  // for raw decoded surface meshes).
  if (edgeCount === 0 && fillCount === 0) {
    return {
      ok: false,
      type: SDKErrorType.InvalidOperation,
      error: `[buildDrawing] source model '${sourceModel.id}' has no projectable edges or fills`,
    };
  }

  return {ok: true, value: target};
}


/**
 * Default progressive-yield callback. Resolves on the next
 * `requestAnimationFrame` tick in the browser (so emitted
 * geometry paints between batches) and on a microtask
 * elsewhere (Node, tests).
 */
function defaultYield(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}


/**
 * Destroys a target {@link model!scene.SceneModel | SceneModel}
 * previously populated by {@link buildDrawing}. No-op if the
 * model is null or already destroyed. Equivalent to
 * `targetModel.destroy()` with a destroyed-check; provided as a
 * convenience for symmetry with {@link buildDrawing}.
 */
export function clearDrawing(targetModel: SceneModel | null | undefined): void {
  if (targetModel && !targetModel.destroyed) targetModel.destroy();
}


/**
 * Quick scan to check whether `sourceModel` has any geometry the
 * projector can usefully emit in the given `mode`. Lets callers
 * (panels, batch tools) skip projection entirely when the source
 * is e.g. a point cloud or a line-only model, instead of letting
 * {@link buildDrawing} build and destroy an empty target
 * SceneModel and emit a console-level error.
 *
 * - `"lines"`   — needs at least one triangle-flavoured geometry
 *   with non-empty `edgeIndices`. Used by the wireframe path.
 * - `"fill"`    — needs at least one triangle-flavoured geometry
 *   with non-empty `indices`. Used by the fill-extraction path.
 * - `"either"`  — passes if either of the above holds.
 *
 * Triangle-flavoured means `TrianglesPrimitive`, `SolidPrimitive`,
 * or `SurfacePrimitive` — the three primitives the rasteriser and
 * edge walker know how to consume.
 */
export function canBuildDrawing(
    sourceModel: SceneModel,
    mode: "lines" | "fill" | "either" = "either",
): boolean {
  if (!sourceModel || sourceModel.destroyed) return false;
  for (const objectId of Object.keys(sourceModel.objects)) {
    const obj = sourceModel.objects[objectId];
    for (const mesh of obj.meshes) {
      const geom = mesh.geometry;
      if (!geom) continue;
      const isTriangleFlavoured =
          geom.primitive === TrianglesPrimitive ||
          geom.primitive === SolidPrimitive ||
          geom.primitive === SurfacePrimitive;
      if (!isTriangleFlavoured) continue;
      if (mode === "lines" || mode === "either") {
        if (geom.edgeIndices && geom.edgeIndices.length >= 2) return true;
      }
      if (mode === "fill" || mode === "either") {
        if (geom.indices && geom.indices.length >= 3) return true;
      }
    }
  }
  return false;
}


// ─────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Resolve a {@link DrawingProjectionDirection} (face-name
 * preset or `{forward, up?}` ray) to a fully orthonormal
 * `{right, up, forward}` basis. `worldUp` is the Scene's
 * world-up axis, used as the fallback `up` when the caller
 * passes a ray without one; if both `worldUp` and the
 * supplied `up` end up parallel to `forward`, a stable
 * perpendicular is picked so projection always resolves.
 */
function resolveBasis(
    direction: DrawingProjectionDirection,
    worldUp: [number, number, number] | undefined,
): ProjectionBasis {
  if (typeof direction === "string") {
    return FACE_BASES[direction];
  }
  // Custom ray. Normalise forward; orthonormalise up against it.
  const f = normalize3(direction.forward);
  let up = direction.up ?? worldUp ?? [0, 0, 1];
  let proj = up[0] * f[0] + up[1] * f[1] + up[2] * f[2];
  if (Math.abs(proj) > 0.9995) {
    // `up` collinear with `forward` — pick any perpendicular.
    // Fall back to whichever world axis is least aligned with
    // forward, then orthonormalise.
    const absX = Math.abs(f[0]), absY = Math.abs(f[1]), absZ = Math.abs(f[2]);
    up = absX <= absY && absX <= absZ ? [1, 0, 0]
        : absY <= absZ                 ? [0, 1, 0]
            : [0, 0, 1];
    proj = up[0] * f[0] + up[1] * f[1] + up[2] * f[2];
  }
  const upPerp: [number, number, number] = [
    up[0] - f[0] * proj,
    up[1] - f[1] * proj,
    up[2] - f[2] * proj,
  ];
  const uN = normalize3(upPerp);
  const r: [number, number, number] = [
    f[1] * uN[2] - f[2] * uN[1],
    f[2] * uN[0] - f[0] * uN[2],
    f[0] * uN[1] - f[1] * uN[0],
  ];
  return {right: r, up: uN, forward: f};
}


/**
 * The six face-name presets, expressed as `{right, up, forward}`
 * triples. `forward` is the camera-look direction; `up` is the
 * direction that reads as "up" on the image. Matches the
 * historical face-by-face orientations the projector used
 * before the generalised-direction refactor — `"top"` looks
 * down (-Y) with the -Z axis reading as "up on screen" (north
 * on a plan), etc.
 */
const FACE_BASES: Record<DrawingProjectionFace, ProjectionBasis> = {
  top:    {right: [1, 0, 0],  up: [0, 0, -1], forward: [0, -1, 0]},
  bottom: {right: [1, 0, 0],  up: [0, 0,  1], forward: [0,  1, 0]},
  front:  {right: [1, 0, 0],  up: [0, 1,  0], forward: [0,  0, 1]},
  back:   {right: [-1, 0, 0], up: [0, 1,  0], forward: [0,  0, -1]},
  left:   {right: [0, 0, 1],  up: [0, 1,  0], forward: [1,  0, 0]},
  right:  {right: [0, 0, -1], up: [0, 1,  0], forward: [-1, 0, 0]},
};


function normalize3(v: ArrayLike<number>): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}


/**
 * Project the 8 corners of a world-space AABB onto the basis
 * `right`/`up` axes and return the rotated rectangle's u/v
 * extents. Same as the helper used inside `buildHLEDepthBuffer`,
 * re-derived here so the chrome (frame, panel, title block)
 * can size itself without a depth-buffer build.
 */
function basisUVExtents(
    basis: ProjectionBasis,
    aabb: FloatArrayParam,
): {uMin: number; uMax: number; vMin: number; vMax: number} {
  const {right, up} = basis;
  const xMin = aabb[0], yMin = aabb[1], zMin = aabb[2];
  const xMax = aabb[3], yMax = aabb[4], zMax = aabb[5];
  let uMin =  Infinity, uMax = -Infinity;
  let vMin =  Infinity, vMax = -Infinity;
  for (let i = 0; i < 8; i++) {
    const x = (i & 1) ? xMax : xMin;
    const y = (i & 2) ? yMax : yMin;
    const z = (i & 4) ? zMax : zMin;
    const u = x * right[0] + y * right[1] + z * right[2];
    const v = x * up[0]    + y * up[1]    + z * up[2];
    if (u < uMin) uMin = u; if (u > uMax) uMax = u;
    if (v < vMin) vMin = v; if (v > vMax) vMax = v;
  }
  return {uMin, uMax, vMin, vMax};
}


/**
 * Minimum basis-d coord over the 8 AABB corners — the depth
 * value of the AABB face nearest the camera. The projection
 * plane sits `offset` past this on the camera side.
 */
function computeBasisDMin(basis: ProjectionBasis, aabb: FloatArrayParam): number {
  const f = basis.forward;
  const xMin = aabb[0], yMin = aabb[1], zMin = aabb[2];
  const xMax = aabb[3], yMax = aabb[4], zMax = aabb[5];
  let dMin = Infinity;
  for (let i = 0; i < 8; i++) {
    const x = (i & 1) ? xMax : xMin;
    const y = (i & 2) ? yMax : yMin;
    const z = (i & 4) ? zMax : zMin;
    const d = x * f[0] + y * f[1] + z * f[2];
    if (d < dMin) dMin = d;
  }
  return dMin;
}


/**
 * Signed handedness of a {right, up, forward} basis — equal
 * to `(right × up) · forward`. Right-handed bases give `+1`,
 * left-handed bases `-1`. The panel-box winding flips with
 * sign so the inside-out box always shows the inside-facing
 * surface no matter which way the basis chirality lands.
 */
/**
 * Resolve a {@link DrawingClipSpec} to a world-space plane:
 * a point on the plane and the unit normal vector pointing
 * toward the **kept** side. Triangles whose centroid satisfies
 * `dot(centroid - point, normal) >= 0` are kept; the rest are
 * discarded by the rasterisers.
 *
 * The `{depth}` form translates to a plane perpendicular to
 * `basis.forward` at the requested basis-d coordinate; the
 * normal is `basis.forward` so the kept side is the one farther
 * along the camera-look direction (i.e. deeper into the scene).
 */
function resolveClipPlane(
    clip: DrawingClipSpec,
    basis: ProjectionBasis,
): {point: [number, number, number]; normal: [number, number, number]} {
  if ("depth" in clip) {
    const f = basis.forward;
    const d = clip.depth;
    return {
      // Any point on the plane works; pick `d * forward` so the
      // plane equation reads `dot(p, forward) = d`.
      point:  [f[0] * d, f[1] * d, f[2] * d],
      // Forward already unit-length (resolveBasis normalises it).
      normal: [f[0], f[1], f[2]],
    };
  }
  // Custom plane — normalise the supplied normal so the
  // sign-of-centroid-dot test is meaningful regardless of input
  // magnitude.
  const n = clip.normal;
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  return {
    point:  [clip.point[0],  clip.point[1],  clip.point[2]],
    normal: [n[0] / len, n[1] / len, n[2] / len],
  };
}


function basisHandedness(basis: ProjectionBasis): number {
  const r = basis.right, u = basis.up, f = basis.forward;
  const cx = r[1] * u[2] - r[2] * u[1];
  const cy = r[2] * u[0] - r[0] * u[2];
  const cz = r[0] * u[1] - r[1] * u[0];
  return cx * f[0] + cy * f[1] + cz * f[2];
}


/**
 * In-place "drop" of a world-space point onto the projection
 * plane. The basis-space (u, v) of the point are preserved;
 * its basis-d is replaced with the plane's depth. The closure
 * captures the basis + plane depth so the hot loop just calls
 * it without per-edge allocation.
 */
function makeProjection(
    basis: ProjectionBasis,
    planeDepth: number,
): (p: Vec3) => void {
  const r = basis.right, u = basis.up, f = basis.forward;
  const fx = f[0] * planeDepth;
  const fy = f[1] * planeDepth;
  const fz = f[2] * planeDepth;
  return (p) => {
    const uu = p[0] * r[0] + p[1] * r[1] + p[2] * r[2];
    const vv = p[0] * u[0] + p[1] * u[1] + p[2] * u[2];
    p[0] = uu * r[0] + vv * u[0] + fx;
    p[1] = uu * r[1] + vv * u[1] + fy;
    p[2] = uu * r[2] + vv * u[2] + fz;
  };
}

/**
 * SceneModel ids are unconstrained strings but ours are
 * concatenated into longer ids — strip whitespace and any
 * characters that would break the resulting compound id.
 */
function sanitizeId(s: string): string {
  return s.replace(/\s+/g, "_");
}

/**
 * Subtract `origin` from every triple in `positions` in place.
 *
 * Keeps emitted geometry positions in a small range near zero
 * so {@link SceneGeometry.aabb} — stored as Float32 — stays
 * precise even when the source model sits far from the world
 * origin. The caller passes the same `origin` to
 * {@link SceneModel.createMesh}'s `position` so the world
 * placement carries the full-precision offset in the mesh's
 * Float64 local matrix.
 */
function recenterPositions(
    positions: number[],
    origin: [number, number, number],
): void {
  for (let i = 0, n = positions.length; i < n; i += 3) {
    positions[i]     -= origin[0];
    positions[i + 1] -= origin[1];
    positions[i + 2] -= origin[2];
  }
}

/**
 * Emit a rectangular frame on the projection plane, sized to
 * cover the projected AABB extent plus `margin` on every side.
 * One SceneObject per call, with id `"{targetModelId}__frame"`.
 *
 * Returns the createObject SDKResult so the caller can fold the
 * frame failure into its own teardown.
 */
function emitFrame(
    target: SceneModel,
    basis: ProjectionBasis,
    aabb: FloatArrayParam,
    planeDepth: number,
    margin: number,
    color: Vec3 | undefined,
    origin: [number, number, number],
    lineMaterialId: string | undefined,
    layerId: string | undefined,
): SDKResult<unknown> {
  // Four corners of the framed area on the projection plane.
  // Built in basis space (u, v, planeDepth) and lifted to
  // world via `u*right + v*up + planeDepth*forward` — orients
  // automatically with the projection direction.
  const {uMin, uMax, vMin, vMax} = basisUVExtents(basis, aabb);
  const u0 = uMin - margin, u1 = uMax + margin;
  const v0 = vMin - margin, v1 = vMax + margin;
  const r = basis.right, up = basis.up, f = basis.forward;
  const fx = f[0] * planeDepth;
  const fy = f[1] * planeDepth;
  const fz = f[2] * planeDepth;
  const bl = [u0 * r[0] + v0 * up[0] + fx, u0 * r[1] + v0 * up[1] + fy, u0 * r[2] + v0 * up[2] + fz];
  const br = [u1 * r[0] + v0 * up[0] + fx, u1 * r[1] + v0 * up[1] + fy, u1 * r[2] + v0 * up[2] + fz];
  const tr = [u1 * r[0] + v1 * up[0] + fx, u1 * r[1] + v1 * up[1] + fy, u1 * r[2] + v1 * up[2] + fz];
  const tl = [u0 * r[0] + v1 * up[0] + fx, u0 * r[1] + v1 * up[1] + fy, u0 * r[2] + v1 * up[2] + fz];
  const corners: number[] = [
    bl[0], bl[1], bl[2],
    br[0], br[1], br[2],
    tr[0], tr[1], tr[2],
    tl[0], tl[1], tl[2],
  ];
  // Four edges around the rectangle.
  const indices = [0, 1,  1, 2,  2, 3,  3, 0];

  const gid = `${target.id}__frame_geom`;
  const mid = `${target.id}__frame_mesh`;
  const oid = `${target.id}__frame`;

  recenterPositions(corners, origin);
  const gRes = target.createGeometry({
    id: gid,
    primitive: LinesPrimitive,
    positions: corners,
    indices,
  });
  if (gRes.ok === false) return gRes;
  const mRes = target.createMesh({
    id: mid,
    geometryId: gid,
    position: origin,
    ...(color ? {color} : {}),
    ...(lineMaterialId ? {materialId: lineMaterialId} : {}),
  });
  if (mRes.ok === false) return mRes;
  // The frame is created here as a regular SceneObject. Pickability
  // is a per-View property — callers who want the frame
  // un-pickable can set `view.objects[oid].pickable = false` after
  // the View picks the new SceneModel up.
  return target.createObject({
    id: oid,
    meshIds: [mid],
    clippable: false,
    ...(layerId ? {layerId} : {}),
  });
}

/**
 * Emit a thin, axis-aligned, **inside-out** box straddling the
 * projection plane. The wireframe + frame lines sit at the box's
 * mid-plane; the box extends `±gap` perpendicular to that plane
 * and `+margin` in-plane on every side.
 *
 * Every triangle is wound so its front face points *inward*
 * (into the box interior). Combined with `SolidPrimitive` (which
 * culls back faces), this gives a one-sided backdrop visible
 * only from outside the box — the near wall the camera is
 * looking through gets back-face culled away, and the camera
 * sees the far wall's inner surface as a clean backdrop behind
 * the wireframe. Side walls work the same way at oblique angles,
 * so the diagram has a backdrop even when viewed edge-on — more
 * robust than the previous two-quad sandwich which lost its
 * backing once the camera grazed the plane.
 *
 * Emits as a single SceneObject so the whole box shares opacity
 * and pickability.
 */
function emitPanel(
    target: SceneModel,
    basis: ProjectionBasis,
    aabb: FloatArrayParam,
    planeDepth: number,
    margin: number,
    spec: PanelSpec,
    origin: [number, number, number],
    layerId: string | undefined,
): SDKResult<unknown> {
  // Default colour swaps depending on whether a painter is
  // supplied: a painter expects a white tint so its sampled
  // colour shows through unmodified; without one, we fall back
  // to the cool off-white the old flat-colour panel used.
  const color   = spec.color   ?? (spec.paint ? [1, 1, 1] : [0.96, 0.97, 0.99]);
  const opacity = spec.opacity ?? 0.55;
  const gap = 0.05;

  // Box extents in basis space. The box is thin along
  // `basis.forward` (one wall on the camera side of the plane,
  // one on the AABB side) and is grown by `margin` in the
  // image-plane axes so it covers the framed area plus border.
  //
  // `dInner` (the AABB-side wall) is clamped so the inset
  // never crosses into the source AABB — when `offset < gap`
  // the inner wall coincides with the AABB face instead of
  // dipping inside.
  const {uMin, uMax, vMin, vMax} = basisUVExtents(basis, aabb);
  const dMin = computeBasisDMin(basis, aabb);
  const u0 = uMin - margin, u1 = uMax + margin;
  const v0 = vMin - margin, v1 = vMax + margin;
  const dOuter = planeDepth - gap;
  const dInner = Math.min(planeDepth + gap, dMin);

  // 8 corners of the box, numbered by a 3-bit basis-axis bit
  // pattern: bit 0 = u choice (0 → u0, 1 → u1), bit 1 = v
  // choice, bit 2 = d choice (0 → dInner, 1 → dOuter).
  //
  //         7──────6           +up
  //        ╱│      │            │  +forward
  //       3──────2 │            │ ╱
  //       │ 4────│─5            │╱
  //       │╱     │╱             ┕── +right
  //       0──────1
  //
  // World position of corner i is `u_i*right + v_i*up + d_i*forward`.
  const r = basis.right, up = basis.up, f = basis.forward;
  const corner = (uu: number, vv: number, dd: number): [number, number, number] => [
    uu * r[0] + vv * up[0] + dd * f[0],
    uu * r[1] + vv * up[1] + dd * f[1],
    uu * r[2] + vv * up[2] + dd * f[2],
  ];
  const c0 = corner(u0, v0, dInner);
  const c1 = corner(u1, v0, dInner);
  const c2 = corner(u1, v1, dInner);
  const c3 = corner(u0, v1, dInner);
  const c4 = corner(u0, v0, dOuter);
  const c5 = corner(u1, v0, dOuter);
  const c6 = corner(u1, v1, dOuter);
  const c7 = corner(u0, v1, dOuter);
  const positions: number[] = [
    c0[0], c0[1], c0[2],  c1[0], c1[1], c1[2],  c2[0], c2[1], c2[2],  c3[0], c3[1], c3[2],
    c4[0], c4[1], c4[2],  c5[0], c5[1], c5[2],  c6[0], c6[1], c6[2],  c7[0], c7[1], c7[2],
  ];

  // Inside-out winding: triangles oriented so `(b-a)×(c-a)`
  // points *into* the box. For a left-handed basis (the case
  // for five of the six face presets — only "front" is
  // right-handed) the natural index table below is correct;
  // for a right-handed basis the cross-product direction flips
  // through the basis-to-world transform, so we swap the last
  // two vertices of each triangle to reverse the world normal
  // back to inward.
  const flip = basisHandedness(basis) > 0;
  const tri = (a: number, b: number, c: number): number[] =>
      flip ? [a, c, b] : [a, b, c];
  const indices: number[] = [
    // dInner face (AABB-side wall, corners 0,1,2,3)
    ...tri(0, 1, 2), ...tri(0, 2, 3),
    // dOuter face (camera-side wall, corners 4,5,6,7)
    ...tri(4, 7, 6), ...tri(4, 6, 5),
    // v=v0 face (corners 0,1,5,4)
    ...tri(0, 4, 5), ...tri(0, 5, 1),
    // v=v1 face (corners 2,3,7,6)
    ...tri(3, 2, 6), ...tri(3, 6, 7),
    // u=u0 face (corners 0,3,7,4)
    ...tri(0, 3, 7), ...tri(0, 7, 4),
    // u=u1 face (corners 1,2,6,5)
    ...tri(1, 5, 6), ...tri(1, 6, 2),
  ];

  const gid = `${target.id}__panel_geom`;
  const mid = `${target.id}__panel_mesh`;
  const oid = `${target.id}__panel`;

  recenterPositions(positions, origin);
  const gRes = target.createGeometry({
    id: gid,
    // TrianglesPrimitive routes through the renderer's transparent
    // pass when opacity < 1, which enables `gl.CULL_FACE` —
    // that's what makes the inward-wound box render as
    // "inside-out": the camera-facing wall's back face is culled
    // and the opposite wall's front face shows through as the
    // backdrop. (`SolidPrimitive` isn't registered in the
    // renderer's draw-op map and would silently skip the mesh.)
    primitive: TrianglesPrimitive,
    positions,
    indices,
  });
  if (gRes.ok === false) return gRes;

  // Optional PBR material — paint once and upload colour, normal,
  // and metallic-roughness textures into the target SceneModel.
  // The mesh below binds the material via `materialId`; the
  // renderer's triplanar fallback samples the textures by world
  // position because the quad geometry has no UVs.
  let materialId: string | undefined;
  if (spec.paint) {
    const maps = spec.paint();
    const matSuffix = "__panel";
    const cTexId = `${target.id}${matSuffix}_color_tex`;
    const nTexId = `${target.id}${matSuffix}_normal_tex`;
    const mTexId = `${target.id}${matSuffix}_mr_tex`;
    const matId  = `${target.id}${matSuffix}_mat`;

    const cTex = target.createTexture({
      id: cTexId, mipmap: true, imageData: maps.color,
      encoding: sRGBEncoding, minFilter: LinearFilter, flipY: false,
    });
    if (cTex.ok === false) return cTex;
    const nTex = target.createTexture({
      id: nTexId, mipmap: true, imageData: maps.normal,
      encoding: LinearEncoding, minFilter: LinearFilter, flipY: false,
    });
    if (nTex.ok === false) return nTex;
    const mTex = target.createTexture({
      id: mTexId, mipmap: true, imageData: maps.mr,
      encoding: LinearEncoding, minFilter: LinearFilter, flipY: false,
    });
    if (mTex.ok === false) return mTex;

    const matRes = target.createMaterial({
      id:                         matId,
      colorTextureId:             cTexId,
      normalsTextureId:           nTexId,
      metallicRoughnessTextureId: mTexId,
      triplanarScale:             spec.textureScale ?? 1.0,
      alphaMode:                  opacity < 1 ? "BLEND" : "OPAQUE",
    });
    if (matRes.ok === false) return matRes;
    materialId = matId;
  }

  const mRes = target.createMesh({
    id: mid,
    geometryId: gid,
    position: origin,
    color,
    opacity,
    ...(materialId ? {materialId} : {}),
  });
  if (mRes.ok === false) return mRes;
  return target.createObject({
    id: oid,
    meshIds: [mid],
    clippable: false,
    ...(layerId ? {layerId} : {}),
  });
}

/**
 * 2D-on-the-plane basis for one AABB face. `origin` is the
 * bottom-left corner of the framed area (i.e. AABB face +
 * `margin` on every side); `right` and `up` are world-space
 * unit vectors aligned to the local-2D X and Y axes of the
 * face. `width` and `height` are the framed area's extents
 * along `right` and `up`.
 */
interface FaceBasis {
  origin: [number, number, number];
  right:  [number, number, number];
  up:     [number, number, number];
  width: number;
  height: number;
}

/**
 * Build the 2D-on-the-plane drawing basis for the framed area
 * — bottom-left world anchor, `right`/`up` world axes, and the
 * framed area's width/height in world units along those axes.
 * Derived from the projection basis + AABB extents projected
 * onto it; the result has the same shape the title-block
 * layout used in the old face-based version, just with
 * arbitrary projection orientation.
 */
function frameBasis(
    basis: ProjectionBasis,
    aabb: FloatArrayParam,
    planeDepth: number,
    margin: number,
): FaceBasis {
  const {uMin, uMax, vMin, vMax} = basisUVExtents(basis, aabb);
  const r = basis.right, up = basis.up, f = basis.forward;
  // World anchor: bottom-left of the framed rect on the plane.
  // Basis-space coord (uMin-margin, vMin-margin, planeDepth)
  // lifts to world via right/up/forward.
  const u0 = uMin - margin;
  const v0 = vMin - margin;
  return {
    origin: [
      u0 * r[0] + v0 * up[0] + planeDepth * f[0],
      u0 * r[1] + v0 * up[1] + planeDepth * f[1],
      u0 * r[2] + v0 * up[2] + planeDepth * f[2],
    ],
    right:  [r[0], r[1], r[2]],
    up:     [up[0], up[1], up[2]],
    width:  (uMax - uMin) + 2 * margin,
    height: (vMax - vMin) + 2 * margin,
  };
}

/**
 * Convert a 2D point `(u, v)` in the face's local-plane basis
 * to a world-space point lying on the projection plane.
 */
function place(basis: FaceBasis, u: number, v: number): [number, number, number] {
  return [
    basis.origin[0] + basis.right[0] * u + basis.up[0] * v,
    basis.origin[1] + basis.right[1] * u + basis.up[1] * v,
    basis.origin[2] + basis.right[2] * u + basis.up[2] * v,
  ];
}

/**
 * Emit a standard technical-drawing title cartouche at the
 * bottom-right of the framed area: outer rectangle, horizontal
 * divider under the heading row, vertical divider between
 * label/value cells, vector text in each cell.
 */
function emitTitleBlock(
    target: SceneModel,
    projBasis: ProjectionBasis,
    aabb: FloatArrayParam,
    planeDepth: number,
    margin: number,
    spec: TitleBlockSpec,
    color: Vec3 | undefined,
    origin: [number, number, number],
    layerId: string | undefined,
): SDKResult<unknown> {
  const basis = frameBasis(projBasis, aabb, planeDepth, margin);
  const rows = spec.rows ?? [];
  const widthFrac = clampUnit(spec.widthFraction ?? 0.42);

  // Block dimensions in face-local 2D space, sized relative to
  // the frame. Heading row gets 32% of block height; each
  // additional row gets an equal slice of the remainder.
  const blockWidth  = basis.width * widthFrac;
  // Row height ≈ 4 % of frame height, with a sensible minimum so
  // the cartouche reads on small models.
  const rowHeight = Math.max(basis.height * 0.04, 0.6);
  const headingHeight = rowHeight * 1.4;
  const blockHeight = headingHeight + rowHeight * rows.length;
  // Place in bottom-right corner of frame, inset by margin/2.
  const u0 = basis.width  - blockWidth;
  const v0 = 0;

  // ── Cartouche line geometry (border + dividers) ─────────────
  const positions: number[] = [];
  const indices: number[] = [];
  let vertexCount = 0;
  const push = (p: [number, number, number]) => {
    positions.push(p[0], p[1], p[2]);
    return vertexCount++;
  };
  const line = (a: [number, number, number], b: [number, number, number]) => {
    indices.push(push(a), push(b));
  };

  // Outer rectangle.
  const bl = place(basis, u0,              v0);
  const br = place(basis, u0 + blockWidth, v0);
  const tr = place(basis, u0 + blockWidth, v0 + blockHeight);
  const tl = place(basis, u0,              v0 + blockHeight);
  line(bl, br); line(br, tr); line(tr, tl); line(tl, bl);

  // Horizontal divider under the heading.
  if (rows.length > 0) {
    const dividerV = v0 + blockHeight - headingHeight;
    line(place(basis, u0, dividerV), place(basis, u0 + blockWidth, dividerV));
  }

  // Per-row vertical label/value divider.
  const labelColWidth = blockWidth * 0.36;
  for (let i = 0; i < rows.length; i++) {
    const rowTop = v0 + blockHeight - headingHeight - i * rowHeight;
    const rowBot = rowTop - rowHeight;
    // Vertical divider between label/value cells.
    line(
        place(basis, u0 + labelColWidth, rowTop),
        place(basis, u0 + labelColWidth, rowBot),
    );
    // Horizontal row divider (except for the last row, which sits
    // on the cartouche outline).
    if (i < rows.length - 1) {
      line(
          place(basis, u0,              rowBot),
          place(basis, u0 + blockWidth, rowBot),
      );
    }
  }

  // ── Vector text ─────────────────────────────────────────────
  const headingTextSize = headingHeight * 0.55;
  const rowTextSize     = rowHeight * 0.55;
  const headingPadX = blockWidth * 0.04;
  const headingPadY = headingHeight * 0.22;
  const rowPadX  = blockWidth * 0.03;
  const rowPadY  = rowHeight * 0.22;
  const valueColX = u0 + labelColWidth + rowPadX;
  const labelColX = u0 + rowPadX;

  // Heading row.
  appendText(positions, indices, () => vertexCount, (n) => { vertexCount = n; },
      basis,
      u0 + headingPadX,
      v0 + blockHeight - headingHeight + headingPadY,
      headingTextSize, spec.title,
  );

  // Label/value rows.
  for (let i = 0; i < rows.length; i++) {
    const rowTop = v0 + blockHeight - headingHeight - i * rowHeight;
    const rowBaseV = rowTop - rowHeight + rowPadY;
    appendText(positions, indices, () => vertexCount, (n) => { vertexCount = n; },
        basis, labelColX, rowBaseV, rowTextSize, rows[i].label);
    appendText(positions, indices, () => vertexCount, (n) => { vertexCount = n; },
        basis, valueColX, rowBaseV, rowTextSize, rows[i].value);
  }

  const gid = `${target.id}__titleBlock_geom`;
  const mid = `${target.id}__titleBlock_mesh`;
  const oid = `${target.id}__titleBlock`;

  recenterPositions(positions, origin);
  const gRes = target.createGeometry({
    id: gid,
    primitive: LinesPrimitive,
    positions,
    indices,
  });
  if (gRes.ok === false) return gRes;
  const mRes = target.createMesh({
    id: mid,
    geometryId: gid,
    position: origin,
    ...(color ? {color} : {}),
  });
  if (mRes.ok === false) return mRes;
  return target.createObject({
    id: oid,
    meshIds: [mid],
    clippable: false,
    ...(layerId ? {layerId} : {}),
  });
}

/**
 * Run {@link buildVectorText} for `text`, then remap each
 * generated XY-plane position into the face's world-space
 * basis at the given (u, v) anchor. Appends to the shared
 * `positions` / `indices` arrays and updates the vertex counter
 * through the supplied getter / setter pair so multiple text
 * runs can share one geometry.
 */
function appendText(
    positions: number[],
    indices: number[],
    getVertexCount: () => number,
    setVertexCount: (n: number) => void,
    basis: FaceBasis,
    uAnchor: number,
    vAnchor: number,
    size: number,
    text: string,
): void {
  if (!text) return;
  const res = buildVectorText({size, origin: [0, 0, 0], text});
  if (!res.ok) return;
  const arrays = res.value as {
    positions: number[];
    indices: number[];
  };
  const base = getVertexCount();
  // buildVectorText emits positions in the XY plane. Letters
  // advance in +X; lines descend in -Y from a baseline at y=0.
  // The cartouche cell wants the baseline `vAnchor` from the
  // cell bottom, so source +Y maps into basis.up directly.
  for (let i = 0; i < arrays.positions.length; i += 3) {
    const u = uAnchor + arrays.positions[i];
    const v = vAnchor + arrays.positions[i + 1];
    const p = place(basis, u, v);
    positions.push(p[0], p[1], p[2]);
  }
  const vertCount = arrays.positions.length / 3;
  for (let i = 0; i < arrays.indices.length; i++) {
    indices.push(base + arrays.indices[i]);
  }
  setVertexCount(base + vertCount);
}

function clampUnit(x: number): number {
  return Math.max(0, Math.min(1, x));
}


/**
 * Walk every mesh on every object in `sourceModel` and grow a
 * world-space AABB around the union of their decompressed
 * vertex positions transformed by each mesh's `worldMatrix`.
 *
 * Returns `[xMin, yMin, zMin, xMax, yMax, zMax]`. If the model
 * has no projectable geometry the returned array's first slot
 * is `+Infinity`; the caller is expected to treat that as the
 * empty case.
 */
function computeWorldAABB(sourceModel: SceneModel): FloatArrayParam {
  const aabb = new Float64Array(6);
  aabb[0] = aabb[1] = aabb[2] =  Infinity;
  aabb[3] = aabb[4] = aabb[5] = -Infinity;
  const tmpLocal: Vec3 = new Float32Array(3) as unknown as Vec3;
  const tmpWorld: Vec3 = new Float32Array(3) as unknown as Vec3;
  for (const objectId of Object.keys(sourceModel.objects)) {
    const obj = sourceModel.objects[objectId];
    for (const mesh of obj.meshes) {
      const geom = mesh.geometry;
      if (!geom || !geom.positionsCompressed || !geom.aabb) continue;
      if (geom.primitive !== TrianglesPrimitive &&
          geom.primitive !== SolidPrimitive &&
          geom.primitive !== SurfacePrimitive) continue;
      const local = decompressPositions3WithAABB3(
          geom.positionsCompressed as FloatArrayParam,
          geom.aabb,
      );
      const worldMatrix = mesh.worldMatrix;
      for (let i = 0, len = local.length; i < len; i += 3) {
        tmpLocal[0] = local[i];
        tmpLocal[1] = local[i + 1];
        tmpLocal[2] = local[i + 2];
        transformPoint3(worldMatrix, tmpLocal, tmpWorld);
        if (tmpWorld[0] < aabb[0]) aabb[0] = tmpWorld[0];
        if (tmpWorld[1] < aabb[1]) aabb[1] = tmpWorld[1];
        if (tmpWorld[2] < aabb[2]) aabb[2] = tmpWorld[2];
        if (tmpWorld[0] > aabb[3]) aabb[3] = tmpWorld[0];
        if (tmpWorld[1] > aabb[4]) aabb[4] = tmpWorld[1];
        if (tmpWorld[2] > aabb[5]) aabb[5] = tmpWorld[2];
      }
    }
  }
  return aabb;
}