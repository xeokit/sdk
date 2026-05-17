/**
 * # Procedural PBR Materials
 *
 * Functions that build tileable PBR-material texture sets at runtime.
 * Each painter returns a {@link MaterialMaps} triple: a colour map, a
 * tangent-space normal map, and a metallic-roughness map. Each map is
 * a {@link MaterialPixelBuffer} (`{ data: Uint8ClampedArray, width,
 * height }`) carrying RGBA8 pixels in row-major order.
 *
 * Painters are grouped into four categories:
 *
 *   - **Masonry** — brick, concrete, limestone, granite.
 *   - **Interior finishes** — marble, oak, painted plaster, asphalt,
 *     ceramic tile, carpet, wallpaper.
 *   - **Metals** — polished steel, brushed steel, copper, chrome,
 *     gold, aluminium, brass.
 *   - **Glass** — tinted dielectric.
 *
 * Each painter takes a single `size` argument (the square texture's
 * pixel side). The output tiles seamlessly through use of the periodic
 * noise primitives exported from the same module.
 *
 * ## Usage
 *
 * ```ts
 * import {paintBrick} from "@xeokit/sdk/model/procgen/paintMaterials";
 *
 * const {color, normal, mr} = paintBrick(256);
 *
 * sceneModel.createTexture({
 *   id: "brick_color",
 *   imageData: color,
 *   encoding: sRGBEncoding
 * });
 * sceneModel.createTexture({
 *   id: "brick_normal",
 *   imageData: normal,
 *   encoding: LinearEncoding
 * });
 * sceneModel.createTexture({
 *   id: "brick_mr",
 *   imageData: mr,
 *   encoding: LinearEncoding
 * });
 * ```
 *
 * @module materials
 */

export * from "./MaterialMaps";
export * from "./paintBrick";
export * from "./paintConcrete";
export * from "./paintLimestone";
export * from "./paintGranite";
export * from "./paintMarble";
export * from "./paintOak";
export * from "./paintWoodPlank";
export * from "./paintPlaster";
export * from "./paintAsphalt";
export * from "./paintCeramicTile";
export * from "./paintCarpet";
export * from "./paintWallpaper";
export * from "./paintBlueprintPaper";
export * from "./paintPolSteel";
export * from "./paintBrushSteel";
export * from "./paintCopper";
export * from "./paintChrome";
export * from "./paintGold";
export * from "./paintAluminium";
export * from "./paintBrass";
export * from "./paintSilver";
export * from "./paintPlatinum";
export * from "./paintTitanium";
export * from "./paintIron";
export * from "./paintRustyMetal";
export * from "./paintCopperRoof";
export * from "./paintGlass";
export * from "./paintHeatMap";

export {
  newPixelBuffer,
  flatNormal,
  flatMR,
  paintMR,
  heightToNormal,
  periodicHash2,
  periodicNoise2,
  periodicFbm,
  clamp01,
} from "./utils";
export type {MaterialPixelBuffer} from "./MaterialPixelBuffer";
