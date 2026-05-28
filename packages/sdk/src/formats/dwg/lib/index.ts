/**
 * Common types shared by {@link DWGLoader} and {@link DXFLoader} —
 * the discriminated-union document model
 * ({@link DWGDocument} + entity subtypes), the per-call load options
 * ({@link DWGLoadOptions} + {@link DEFAULT_DWG_LOAD_OPTIONS}), and
 * the success-result shape ({@link DWGLoadResult}). Each interface
 * and class lives in its own file under this directory; this barrel
 * re-exports them all for the loaders, the version-keyed parsers,
 * and `formats/dwg/index.ts` to consume.
 *
 * @private
 */
export * from "./Vec2";
export * from "./Vec3";
export * from "./DWGHeader";
export * from "./DWGEntityCommon";
export * from "./DWGLine";
export * from "./DWGLwPolyline";
export * from "./DWGPolyline";
export * from "./DWGCircle";
export * from "./DWGArc";
export * from "./DWGEllipse";
export * from "./DWGPoint";
export * from "./DWG3DFace";
export * from "./DWGInsert";
export * from "./DWGText";
export * from "./DWGMText";
export * from "./DWGEntity";
export * from "./DWGBlock";
export * from "./DWGDocument";
export * from "./DWGLoadOptions";
export * from "./DWGLoadResult";
