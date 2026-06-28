/**
 * Resolves URLs for model files and the per-model sidecar files that
 * sit beside them (e.g. `coordSys.json`).
 *
 * Keeps every directory-layout and filename concern out of the loader
 * modules and Studio. Custom deployments inject their own locator via
 * {@link StudioConfig.locator}; loaders never see paths.
 */
export interface ModelLocator {

  /**
   * URL of a model file for the given `(modelId, format)` pair.
   * Studio's `loadModel` calls this when the caller didn't supply an
   * explicit `src`.
   */
  resolve(modelId: string, format: string): string;

  /**
   * URL of a sidecar file beside the model's directory — files that
   * aren't themselves model formats but belong logically to the
   * model (currently just `coordSys.json`; pattern extends to any
   * future per-model metadata).
   */
  resolveSidecar(modelId: string, fileName: string): string;

  /**
   * Optional one-time async setup, awaited by `Studio.loadModel` before
   * {@link resolve}. Lets a locator load whatever catalog it needs to make
   * resolution decisions (e.g. which models have optimized variants). Must be
   * idempotent and must not throw — a failure leaves resolution at its default.
   */
  preload?(): Promise<void>;
}

/**
 * Built-in locator for the demo convention
 * `{modelsDir}/{modelId}/{format}/model.{ext}`.
 *
 * Owns the format → extension map so that loader modules carry no
 * filename or path information. Callers that need a different layout
 * inject their own {@link ModelLocator} via {@link StudioConfig}.
 */
export class DefaultModelLocator implements ModelLocator {

  /**
   * Filename extension per format key. Override via constructor to
   * add new formats or change defaults without subclassing.
   */
  private readonly extensions: Map<string, string>;

  /**
   * `${modelId}/${format}` pairs that have an optimized variant
   * (`model.optimized.{ext}`) beside the original. `null` until learned —
   * supplied via the constructor, or loaded from the catalog by {@link preload}.
   */
  private optimized: Set<string> | null;
  private preloaded = false;

  constructor(
    private readonly modelsDir: string,
    extensions?: Record<string, string>,
    optimized?: Set<string>,
  ) {
    this.extensions = new Map(Object.entries(extensions ?? DEFAULT_EXTENSIONS));
    this.optimized = optimized ?? null;
  }

  resolve(modelId: string, format: string): string {
    const ext = this.extensions.get(format);
    if (!ext) {
      throw new Error(
        `[DefaultModelLocator] No filename extension registered for format '${format}'`,
      );
    }
    // Prefer the optimized variant when the catalog says one exists; otherwise
    // fall back to the original.
    const file = this.optimized && this.optimized.has(`${modelId}/${format}`)
      ? `model.optimized.${ext}`
      : `model.${ext}`;
    return `${this.modelsDir}/${modelId}/${format}/${file}`;
  }

  resolveSidecar(modelId: string, fileName: string): string {
    return `${this.modelsDir}/${modelId}/${fileName}`;
  }

  /**
   * Learn which `(modelId, format)` pairs have an optimized variant by reading
   * the demo catalog `{modelsDir}/index.json` (written by the website's
   * `buildIndex.js`, which records an `optimized: string[]` of formats per
   * model). Runs once; never throws — if the catalog or `fetch` is unavailable,
   * resolution simply stays on the originals. Skipped when an optimized set was
   * supplied explicitly via the constructor.
   */
  async preload(): Promise<void> {
    if (this.preloaded) {
      return;
    }
    this.preloaded = true;
    if (this.optimized || typeof fetch !== "function") {
      return;
    }
    try {
      const res = await fetch(`${this.modelsDir}/index.json`, {cache: "no-cache"});
      if (!res.ok) {
        return;
      }
      this.optimized = optimizedSetFromIndex(await res.json());
    } catch {
      // No catalog (or no fetch) — keep resolving to the original files.
    }
  }
}

/**
 * Builds the set of `${modelId}/${format}` pairs that have an optimized variant,
 * from a parsed models `index.json`. Each model entry may carry
 * `optimized: string[]` — the format keys whose `model.optimized.{ext}` exists.
 */
export function optimizedSetFromIndex(
  index: Record<string, {optimized?: string[]}>,
): Set<string> {
  const set = new Set<string>();
  for (const modelId of Object.keys(index ?? {})) {
    for (const format of index[modelId]?.optimized ?? []) {
      set.add(`${modelId}/${format}`);
    }
  }
  return set;
}

/**
 * Built-in format → extension table. Mirrors the paths used by the
 * pre-registry `Studio.loadModel` switch so the default behaviour
 * is byte-identical.
 */
export const DEFAULT_EXTENSIONS: Record<string, string> = {
  xgf: "xgf",
  ifc: "ifc",
  gltf: "glb",
  fbx: "fbx",
  usdz: "usdz",
  e57: "e57",
  las: "las",
  laz: "laz",
  fds: "fds",
  mtl: "mtl",
  obj: "obj",
  splat: "splat",
  dotbim: "bim",
  cityjson: "json",
  metamodel: "json",
  datamodel: "json",
  scenemodel: "json",
  pdf: "pdf",
  svg: "svg",
  dwg: "dwg",
  dxf: "dxf",
  threedxml: "3dxml",
  threedtiles: "json",
  xkt: "xkt",
};
