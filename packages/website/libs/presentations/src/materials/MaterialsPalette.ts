import type {SceneMesh, SceneModel} from "@xeokit/sdk/model/scene";
import {SDKErrorType, type SDKResult} from "@xeokit/sdk/base/core";
import {LinearEncoding, LinearFilter, sRGBEncoding} from "@xeokit/sdk/base/constants";

import {
  paintAluminium,
  paintAsphalt,
  paintBrass,
  paintBrick,
  paintBrushSteel,
  paintCarpet,
  paintCeramicTile,
  paintChrome,
  paintConcrete,
  paintCopper,
  paintCopperRoof,
  paintGlass,
  paintGold,
  paintGranite,
  paintIron,
  paintLimestone,
  paintMarble,
  paintOak,
  paintPlaster,
  paintPlatinum,
  paintPolSteel,
  paintRustyMetal,
  paintSilver,
  paintTitanium,
  paintWallpaper,
  paintWoodPlank,
} from "@xeokit/sdk/model/generation/paintMaterials";
import {HATCH_STYLE_PRESETS, type HatchFamily, type HatchParams, type HatchStyle} from "@xeokit/sdk/model/scene/hatchPattern";

import type {PainterCatalogEntry} from "./PainterCatalogEntry";


/**
 * Pixel → world-units scale applied when promoting a pixel-tuned
 * hatch preset to a world-space hatch. The presets in
 * {@link HATCH_STYLE_PRESETS} use ~8 px spacing; we want roughly
 * 10–20 cm of building geometry per cycle for engineering reads
 * on a metres-unit BIM model — hence ~1 px = 2 cm.
 */
const HATCH_PX_TO_WORLD = 0.02;

/**
 * Build a world-space {@link HatchParams} for the catalog. Same
 * pattern as the IFC painter table — keep hatches consistent
 * between the palette and the IFC type mapping so a brick wall
 * sectioned via IfcWallStandardCase reads the same as a brick wall
 * sectioned via the materials palette. Scales the preset's
 * pixel-space spacings by {@link HATCH_PX_TO_WORLD}.
 */
function hatch(
  style: HatchStyle,
  inkColor: [number, number, number],
  opacity: number = 1.0,
  worldScale: number = HATCH_PX_TO_WORLD,
): HatchParams {
  const scaled = HATCH_STYLE_PRESETS[style].map(f => ({
    ...f,
    spacing:      f.spacing      * worldScale,
    lineWidth:    f.lineWidth    * worldScale,
    phase:        f.phase        !== undefined ? f.phase        * worldScale : undefined,
    amplitude:    f.amplitude    !== undefined ? f.amplitude    * worldScale : undefined,
    wavelength:   f.wavelength   !== undefined ? f.wavelength   * worldScale : undefined,
    brickHeight:  f.brickHeight  !== undefined ? f.brickHeight  * worldScale : undefined,
    courseOffset: f.courseOffset !== undefined ? f.courseOffset * worldScale : undefined,
  })) as HatchFamily[];
  return {
    families: scaled,
    color:    inkColor,
    opacity,
    space:    "world",
  };
}


/**
 * Tints compensating for the diffuse `albedo / π` term in the
 * Cook-Torrance BRDF. Same multipliers the materials chart demo and
 * `applyIFCMaterials` both use, so palette-applied materials match
 * the visual scale of IFC-applied ones.
 */
const DIFFUSE_TINT: [number, number, number] = [1.6, 1.6, 1.6];
const METAL_TINT:   [number, number, number] = [1.2, 1.2, 1.2];
const NEUTRAL_TINT: [number, number, number] = [1.0, 1.0, 1.0];


/**
 * Default catalog covering every applicable painter exported from
 * {@link model!generation.paintMaterials | paintMaterials}. Glass alone uses transparent BLEND
 * material parameters; everything else picks the diffuse / metal
 * tint that goes with its category. {@link paintHeatMap} is excluded
 * — it needs caller-supplied per-vertex scalars and per-geometry UVs
 * that don't fit the "pick a painter, apply to a mesh" interaction
 * the palette is designed for.
 */
// Engineering hatch shorthands used across the catalog. Inline
// because the conventions diverge across metals (most → ANSI 32
// steel crosshatch; cast iron / iron → ANSI 31 single diagonal;
// copper-alloys → ANSI 33 bronze).
const HATCH_STEEL    = hatch("ansi32",          [0.08, 0.08, 0.10]);
const HATCH_CAST     = hatch("ansi31",          [0.10, 0.10, 0.10]);
const HATCH_BRONZE   = hatch("ansi33",          [0.20, 0.14, 0.04]);
const HATCH_BRICK    = hatch("ansi36",          [0.28, 0.14, 0.10]);
const HATCH_CONCRETE = hatch("isoConcreteFine", [0.34, 0.34, 0.32]);
const HATCH_STONE    = hatch("isoConcreteCoarse",[0.30, 0.30, 0.28]);
const HATCH_WOOD     = hatch("ansi31",          [0.22, 0.12, 0.06]);
const HATCH_PLASTER  = hatch("ansi38",          [0.40, 0.40, 0.40], 0.55);
const HATCH_FABRIC   = hatch("ansi37",          [0.28, 0.28, 0.30]);

const DEFAULT_CATALOG: PainterCatalogEntry[] = [

  // ── Masonry ────────────────────────────────────────────────────
  {id: "brick",        label: "Brick",         category: "Masonry",  paint: paintBrick,      material: {color: DIFFUSE_TINT, hatchPattern: HATCH_BRICK}},
  {id: "concrete",     label: "Concrete",      category: "Masonry",  paint: paintConcrete,   material: {color: DIFFUSE_TINT, hatchPattern: HATCH_CONCRETE}},
  {id: "limestone",    label: "Limestone",     category: "Masonry",  paint: paintLimestone,  material: {color: DIFFUSE_TINT, hatchPattern: HATCH_STONE}},
  {id: "granite",      label: "Granite",       category: "Masonry",  paint: paintGranite,    material: {color: DIFFUSE_TINT, hatchPattern: HATCH_STONE}},

  // ── Interior finishes ──────────────────────────────────────────
  {id: "marble",       label: "Marble",        category: "Interior", paint: paintMarble,     material: {color: DIFFUSE_TINT, hatchPattern: HATCH_STONE}},
  {id: "oak",          label: "Oak",           category: "Interior", paint: paintOak,        material: {color: DIFFUSE_TINT, hatchPattern: HATCH_WOOD}},
  {id: "woodPlank",    label: "Wood Plank",    category: "Interior", paint: paintWoodPlank,  material: {color: DIFFUSE_TINT, hatchPattern: HATCH_WOOD}},
  {id: "plaster",      label: "Plaster",       category: "Interior", paint: paintPlaster,    material: {color: DIFFUSE_TINT, hatchPattern: HATCH_PLASTER}},
  {id: "asphalt",      label: "Asphalt",       category: "Interior", paint: paintAsphalt,    material: {color: DIFFUSE_TINT, hatchPattern: hatch("ansi31", [0.16, 0.16, 0.16])}},
  {id: "ceramicTile",  label: "Ceramic Tile",  category: "Interior", paint: paintCeramicTile,material: {color: DIFFUSE_TINT, hatchPattern: hatch("ansi32", [0.30, 0.30, 0.32])}},
  {id: "carpet",       label: "Carpet",        category: "Interior", paint: paintCarpet,     material: {color: DIFFUSE_TINT, hatchPattern: HATCH_FABRIC}},
  {id: "wallpaper",    label: "Wallpaper",     category: "Interior", paint: paintWallpaper,  material: {color: DIFFUSE_TINT, hatchPattern: HATCH_PLASTER}},

  // ── Metals ─────────────────────────────────────────────────────
  //
  // Most metals are ANSI 32 (steel crosshatch). Cast iron and iron
  // get the dedicated ANSI 31 single-diagonal convention. Copper
  // alloys (copper, brass, gold-coloured non-ferrous) use ANSI 33.
  {id: "polSteel",     label: "Polished Steel",category: "Metal",    paint: paintPolSteel,   material: {color: METAL_TINT, hatchPattern: HATCH_STEEL}},
  {id: "brushSteel",   label: "Brushed Steel", category: "Metal",    paint: paintBrushSteel, material: {color: METAL_TINT, hatchPattern: HATCH_STEEL}},
  {id: "copper",       label: "Copper",        category: "Metal",    paint: paintCopper,     material: {color: METAL_TINT, hatchPattern: HATCH_BRONZE}},
  {id: "chrome",       label: "Chrome",        category: "Metal",    paint: paintChrome,     material: {color: METAL_TINT, hatchPattern: HATCH_STEEL}},
  {id: "gold",         label: "Gold",          category: "Metal",    paint: paintGold,       material: {color: METAL_TINT, hatchPattern: HATCH_BRONZE}},
  {id: "aluminium",    label: "Aluminium",     category: "Metal",    paint: paintAluminium,  material: {color: METAL_TINT, hatchPattern: HATCH_STEEL}},
  {id: "brass",        label: "Brass",         category: "Metal",    paint: paintBrass,      material: {color: METAL_TINT, hatchPattern: HATCH_BRONZE}},
  {id: "silver",       label: "Silver",        category: "Metal",    paint: paintSilver,     material: {color: METAL_TINT, hatchPattern: HATCH_STEEL}},
  {id: "platinum",     label: "Platinum",      category: "Metal",    paint: paintPlatinum,   material: {color: METAL_TINT, hatchPattern: HATCH_STEEL}},
  {id: "titanium",     label: "Titanium",      category: "Metal",    paint: paintTitanium,   material: {color: METAL_TINT, hatchPattern: HATCH_STEEL}},
  {id: "iron",         label: "Iron",          category: "Metal",    paint: paintIron,       material: {color: METAL_TINT, hatchPattern: HATCH_CAST}},
  {id: "rustyMetal",   label: "Rusty Metal",   category: "Metal",    paint: paintRustyMetal, material: {color: METAL_TINT, hatchPattern: HATCH_CAST}},
  {id: "copperRoof",   label: "Copper Roof",   category: "Metal",    paint: paintCopperRoof, material: {color: METAL_TINT, hatchPattern: HATCH_BRONZE}},

  // ── Glass ──────────────────────────────────────────────────────
  // No hatch — transparent dielectrics aren't conventionally
  // section-filled; the cap renders as plain capColor.
  {id: "glass",        label: "Glass",         category: "Glass",    paint: paintGlass,      material: {color: NEUTRAL_TINT, opacity: 0.35, alphaMode: "BLEND"}},
];


/**
 * Catalog of {@link model!generation.paintMaterials | paintMaterials} painters
 * plus a method to swap a {@link model!scene.SceneMesh | SceneMesh}'s material
 * to one of them at runtime.
 *
 * Per-(SceneModel, painter) materials are created on first use and
 * cached, so applying the same painter to many meshes produces one shared
 * {@link model!scene.SceneMaterial | SceneMaterial} instead of one material
 * per mesh.
 *
 * The mesh-replacement path mirrors the supported mutation pattern
 * the SDK documents: snapshot the mesh's params (id, geometryId,
 * matrix, opacity, parentTransform), detach it from its
 * {@link model!scene.SceneObject | SceneObject}, destroy it, then create a new SceneMesh with
 * the same id but bound to the palette's SceneMaterial and re-attach
 * to the same SceneObject. The object keeps its identity; only the
 * mesh-material binding changes.
 */
export class MaterialsPalette {

  /**
   * Painter catalog. Each entry carries an id, a human-readable
   * label, a category, the painter callable, and any non-texture
   * material parameters (opacity / colour tint / alpha mode).
   */
  public readonly catalog: PainterCatalogEntry[];

  /**
   * Painter texture size in pixels (square). Default `256`.
   * Larger values produce sharper close-up texturing at the cost of
   * a one-off paint cost on first use.
   */
  public textureSize: number;

  /**
   * Approximate metres of geometry per texture repeat. Forwarded
   * to each created `SceneMaterial` as `triplanarScale`, which
   * the renderer's triplanar texture-sampling fallback consults
   * when painting UV-less geometry (typical of BIM, sweeps and
   * lofted curves). Smaller values tile the painted texture more
   * times across each surface. Default `1.0`.
   */
  public uvScale: number;

  /**
   * Cache of materialId per (SceneModel, painterId). Looked up first
   * by SceneModel, then by painterId. WeakMap so destroying a
   * SceneModel drops the entry without an explicit cleanup pass.
   */
  readonly #matCache: WeakMap<SceneModel, Map<string, string>> = new WeakMap();

  /**
   * Index from painter id → catalog entry, for O(1) lookup.
   */
  readonly #byId: Map<string, PainterCatalogEntry>;

  /**
   * Creates a MaterialsPalette.
   *
   * @param params.catalog Override the default catalog. When omitted,
   *   every applicable {@link model!generation.paintMaterials | paintMaterials}
   *   painter is pre-registered.
   * @param params.textureSize Painter texture size in pixels. Default
   *   `256`.
   * @param params.uvScale Metres of geometry per texture repeat,
   *   forwarded to each created SceneMaterial as `triplanarScale`.
   *   Default `1.0`.
   */
  constructor(params: {
    catalog?:     PainterCatalogEntry[];
    textureSize?: number;
    uvScale?:     number;
  } = {}) {
    this.catalog = params.catalog ?? DEFAULT_CATALOG;
    this.textureSize = params.textureSize ?? 256;
    this.uvScale = params.uvScale ?? 1.0;
    this.#byId = new Map();
    for (const entry of this.catalog) {
      this.#byId.set(entry.id, entry);
    }
  }

  /**
   * List painter ids registered in the catalog, in declaration
   * order. Convenient for building UI menus.
   */
  painterIds(): string[] {
    return this.catalog.map(e => e.id);
  }

  /**
   * Look up a painter entry by id, or `undefined` when no entry
   * matches.
   */
  getEntry(painterId: string): PainterCatalogEntry | undefined {
    return this.#byId.get(painterId);
  }

  /**
   * Replaces `sceneMesh` on its parent {@link model!scene.SceneObject | SceneObject} with a
   * fresh SceneMesh whose `materialId` references the palette's
   * SceneMaterial for `painterId`. The new mesh keeps the same id,
   * geometry, local matrix, opacity, and parent transform — only the
   * material binding changes.
   *
   * Mesh replacement uses the supported detach + destroy + recreate
   * + reattach pattern: see the comment on
   * {@link applyIFCMaterials} for the rationale (renderer batches
   * are sized per-material, so swapping a mesh's material requires a
   * mesh-create / mesh-destroy round-trip rather than a live
   * field-set).
   *
   * @param sceneMesh The SceneMesh to repaint. Must be attached to a
   *   SceneObject in a SceneModel.
   * @param painterId Catalog entry id (e.g. `"brick"`,
   *   `"polSteel"`).
   * @returns SDKResult — `ok: true` with the new SceneMesh on
   *   success; `ok: false` when the mesh is detached / destroyed /
   *   the painter is unknown / texture or material creation fails.
   */
  paintMaterial(sceneMesh: SceneMesh, painterId: string): SDKResult<SceneMesh> {
    if (!sceneMesh) {
      return errInvalid("[MaterialsPalette.paintMaterial] sceneMesh is required");
    }
    if (sceneMesh.destroyed) {
      return errInvalid(`[MaterialsPalette.paintMaterial] SceneMesh '${sceneMesh.id}' is destroyed`);
    }
    const sceneObject = sceneMesh.object;
    if (!sceneObject) {
      return errInvalid(`[MaterialsPalette.paintMaterial] SceneMesh '${sceneMesh.id}' is not attached to a SceneObject`);
    }
    const sceneModel = sceneMesh.model;
    if (!sceneModel) {
      return errInvalid(`[MaterialsPalette.paintMaterial] SceneMesh '${sceneMesh.id}' has no SceneModel`);
    }
    const entry = this.#byId.get(painterId);
    if (!entry) {
      return errInvalid(`[MaterialsPalette.paintMaterial] Unknown painter id '${painterId}'`);
    }

    const matRes = this.#ensureMaterial(sceneModel, entry);
    if (matRes.ok === false) {
      return matRes;
    }
    const materialId = matRes.value;

    // Snapshot the mesh's params before destroying. Reading after
    // destroy is invalid — `matrix` would point at freed state.
    const snap = {
      id:                sceneMesh.id,
      geometryId:        sceneMesh.geometryId,
      matrix:            new Float64Array(sceneMesh.matrix),
      opacity:           sceneMesh.opacity,
      parentTransformId: sceneMesh.parentTransform ? sceneMesh.parentTransform.id : undefined,
    };

    const rmRes = sceneObject.removeMesh(snap.id);
    if (rmRes.ok === false) {
      return rmRes;
    }
    const dRes = sceneMesh.destroy();
    if (dRes.ok === false) {
      return dRes;
    }

    if (!sceneModel.geometries[snap.geometryId]) {
      return {
        ok: false,
        type: SDKErrorType.InvalidOperation,
        error: `[MaterialsPalette.paintMaterial] Source geometry '${snap.geometryId}' is no longer present in SceneModel`,
      };
    }

    const cRes = sceneModel.createMesh({
      id:         snap.id,
      geometryId: snap.geometryId,
      materialId,
      matrix:     snap.matrix,
      opacity:    snap.opacity,
    });
    if (cRes.ok === false) {
      return cRes;
    }

    const aRes = sceneObject.addMesh(cRes.value.id);
    if (aRes.ok === false) {
      return aRes;
    }
    if (snap.parentTransformId) {
      const tRes = cRes.value.setParentTransformId(snap.parentTransformId);
      if (tRes.ok === false) {
        return tRes;
      }
    }
    return {ok: true, value: cRes.value};
  }

  /**
   * Resolve (or lazily build) the SceneMaterial for the given
   * painter inside `sceneModel`, returning the materialId that
   * meshes can bind via `materialId`.
   */
  #ensureMaterial(sceneModel: SceneModel, entry: PainterCatalogEntry): SDKResult<string> {
    let perModel = this.#matCache.get(sceneModel);
    if (!perModel) {
      perModel = new Map();
      this.#matCache.set(sceneModel, perModel);
    }
    const cached = perModel.get(entry.id);
    if (cached) {
      return {ok: true, value: cached};
    }

    // Painter and texture / material ids share a stable prefix so
    // these are easy to spot in inspectors and don't collide with
    // ids the host application might use.
    const matId = `_palette_mat_${entry.id}`;
    const cTex  = `_palette_${entry.id}_color`;
    const nTex  = `_palette_${entry.id}_normal`;
    const mTex  = `_palette_${entry.id}_mr`;

    const maps = entry.paint(this.textureSize);

    const cR = sceneModel.createTexture({id: cTex, mipmap: true, imageData: maps.color,  encoding: sRGBEncoding,   minFilter: LinearFilter, flipY: false});
    const nR = sceneModel.createTexture({id: nTex, mipmap: true, imageData: maps.normal, encoding: LinearEncoding, minFilter: LinearFilter, flipY: false});
    const mR = sceneModel.createTexture({id: mTex, mipmap: true, imageData: maps.mr,     encoding: LinearEncoding, minFilter: LinearFilter, flipY: false});
    if (cR.ok === false) console.warn(`[MaterialsPalette] createTexture(${cTex}) failed:`, cR.error);
    if (nR.ok === false) console.warn(`[MaterialsPalette] createTexture(${nTex}) failed:`, nR.error);
    if (mR.ok === false) console.warn(`[MaterialsPalette] createTexture(${mTex}) failed:`, mR.error);

    const matRes = sceneModel.createMaterial({
      id:                         matId,
      colorTextureId:             cTex,
      normalsTextureId:           nTex,
      metallicRoughnessTextureId: mTex,
      roughness:                  1.0,
      metallic:                   1.0,
      // Forward the palette's `uvScale` as the material's
      // `triplanarScale`. Geometry coming in without UVs (most BIM,
      // sweeps, lofted curve meshes) routes through the renderer's
      // triplanar texture-sampling fallback, which reads this value
      // to convert world position into per-fragment sample
      // coordinates. UV-bearing geometry ignores it.
      triplanarScale:             this.uvScale,
      // Forward the painter's flat-context fallbacks
      // ({@link MaterialMaps.flatColor | flatColor},
      // {@link MaterialMaps.flatOpacity | flatOpacity}) onto the
      // SceneMaterial as its `color` / `opacity`. These are the
      // values consumers like the drawings emitter read when
      // they want a single textureless fill / line style for a
      // material — a glass painter's `flatOpacity: 0.35` ends up
      // as the mesh's effectiveOpacity, and the drawing pipeline
      // (which inherits per-mesh color/opacity) automatically
      // renders the pane as translucent in plan.
      //
      // `entry.material` overrides win — they're authored
      // per-entry on the catalog, finer-grained than the painter
      // itself, and a caller who hands us an entry with an
      // explicit `color` clearly wants that to stick.
      ...(maps.flatColor   !== undefined ? {color:   maps.flatColor}   : {}),
      ...(maps.flatOpacity !== undefined ? {opacity: maps.flatOpacity} : {}),
      ...(entry.material || {}),
    });
    if (matRes.ok === false) {
      return matRes;
    }
    perModel.set(entry.id, matId);
    return {ok: true, value: matId};
  }
}


function errInvalid<T>(message: string): SDKResult<T> {
  return {ok: false, type: SDKErrorType.InvalidOperation, error: message};
}
