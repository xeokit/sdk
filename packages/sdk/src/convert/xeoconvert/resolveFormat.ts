/**
 * Maps a file extension to the xeoconvert loader/exporter id that handles it.
 *
 * Used by the CLI's generic `--in <file> --out <file>` mode to synthesize an
 * ad-hoc single-input/single-output pipeline without a named `--pipeline`. Only
 * unambiguous extensions are listed; `.json`-based formats (CityJSON, the
 * datamodel/scenemodel intermediates) are intentionally omitted because the
 * extension alone can't disambiguate them — those require an explicit
 * `--pipeline`.
 *
 * The ids must match the keys registered on the ModelConverter in
 * {@link xeoconvert_core}. `convert()` re-validates that the resolved id exists,
 * so a drift here surfaces as a clear "unsupported loader/exporter" error.
 *
 * @internal
 */
export interface FormatBinding {
  /** Loader id for this extension, if the format can be read. */
  loader?: string;
  /** Exporter id for this extension, if the format can be written. */
  exporter?: string;
}

/** @internal */
export const FORMAT_BY_EXTENSION: Record<string, FormatBinding> = {
  ".glb":   {loader: "glb",           exporter: "glb"},
  ".gltf":  {loader: "glb",           exporter: "glb"},
  ".xgf":   {loader: "xgf",           exporter: "xgf"},
  ".xgfstream": {exporter: "xgfstream"},
  ".ifc":   {loader: "ifc",           exporter: "ifc"},
  ".bim":   {loader: "dotbim",        exporter: "dotbim"},
  ".las":   {loader: "las"},          // LAS/LAZ are import-only (no exporter registered)
  ".laz":   {loader: "las"},
  ".e57":   {loader: "e57",           exporter: "e57"},
  ".fbx":   {loader: "fbx",           exporter: "fbx"},
  ".obj":   {loader: "obj",           exporter: "obj"},
  ".ply":   {loader: "ply",           exporter: "ply"},
  ".mtl":   {loader: "mtl",           exporter: "mtl"},
  ".usdz":  {loader: "usdz",          exporter: "usdz"},
  ".3dxml": {loader: "threedxml",     exporter: "threedxml"},
  ".fds":   {loader: "fds",           exporter: "fds"},
  ".splat": {loader: "gaussiansplat", exporter: "gaussiansplat"},
  ".xkt":   {loader: "xkt",           exporter: "xkt"},
  ".dxf":   {exporter: "dxf"},        // DXF/SVG are export-only (loaders don't fit the ModelLoader contract)
  ".svg":   {exporter: "svg"},
};

/**
 * Lowercased final `.ext` of a path (no directory, last dot), or "" if none.
 * @internal
 */
export function extensionOf(filePath: string): string {
  const base = (filePath || "").toLowerCase().split(/[\\/]/).pop() || "";
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot);
}

function knownExtensions(map: Record<string, FormatBinding>, kind: "loader" | "exporter"): string {
  return Object.keys(map).filter((e) => map[e][kind]).join(", ");
}

/**
 * Resolve the loader id for an input file path from its extension.
 * @throws if the extension is unknown or has no loader.
 * @internal
 */
export function resolveLoaderId(filePath: string, map: Record<string, FormatBinding> = FORMAT_BY_EXTENSION): string {
  const ext = extensionOf(filePath);
  const binding = map[ext];
  if (!binding || !binding.loader) {
    throw new Error(
      `Cannot determine an input loader from the extension "${ext || "(none)"}" of "${filePath}". ` +
      `Recognised input extensions: ${knownExtensions(map, "loader")}. ` +
      `For other or ambiguous formats (e.g. .json), use --pipeline instead.`,
    );
  }
  return binding.loader;
}

/**
 * Resolve the exporter id for an output file path from its extension.
 * @throws if the extension is unknown or has no exporter.
 * @internal
 */
export function resolveExporterId(filePath: string, map: Record<string, FormatBinding> = FORMAT_BY_EXTENSION): string {
  const ext = extensionOf(filePath);
  const binding = map[ext];
  if (!binding || !binding.exporter) {
    throw new Error(
      `Cannot determine an output exporter from the extension "${ext || "(none)"}" of "${filePath}". ` +
      `Recognised output extensions: ${knownExtensions(map, "exporter")}. ` +
      `For other or ambiguous formats (e.g. .json), use --pipeline instead.`,
    );
  }
  return binding.exporter;
}
