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

  constructor(
    private readonly modelsDir: string,
    extensions?: Record<string, string>,
  ) {
    this.extensions = new Map(Object.entries(extensions ?? DEFAULT_EXTENSIONS));
  }

  resolve(modelId: string, format: string): string {
    const ext = this.extensions.get(format);
    if (!ext) {
      throw new Error(
        `[DefaultModelLocator] No filename extension registered for format '${format}'`,
      );
    }
    return `${this.modelsDir}/${modelId}/${format}/model.${ext}`;
  }

  resolveSidecar(modelId: string, fileName: string): string {
    return `${this.modelsDir}/${modelId}/${fileName}`;
  }
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
  mtl: "mtl",
  obj: "obj",
  dotbim: "bim",
  cityjson: "json",
  metamodel: "json",
  datamodel: "json",
  scenemodel: "json",
  pdf: "pdf",
  svg: "svg",
  dwg: "dwg",
  dxf: "dxf",
};
