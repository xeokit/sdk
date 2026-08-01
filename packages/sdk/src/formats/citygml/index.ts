/**
 * # citygml — CityGML Importer
 *
 * CityGML is an OGC XML/GML encoding for semantic 3D city models. The
 * {@link CityGMLLoader} imports polygonal CityGML surface geometry into a
 * {@link model!scene.SceneModel | SceneModel} and imports CityGML feature IDs,
 * types, names, and nested feature hierarchy into a
 * {@link model!data.DataModel | DataModel}.
 *
 * This first-pass loader focuses on XML/GML surface geometry (`gml:Polygon`,
 * `gml:Triangle`, `gml:Rectangle`, and `gml:LinearRing` coordinate lists).
 * It does not reproject CRS coordinates, import textures, or preserve full
 * CityGML appearance/semantic-property payloads.
 *
 * ## Example
 *
 * ```ts
 * import {CityGMLLoader} from "@xeokit/sdk/formats/citygml";
 *
 * const cityGMLLoader = new CityGMLLoader();
 * await cityGMLLoader.load({
 *   fileData: cityGMLText,
 *   sceneModel,
 *   dataModel
 * });
 * ```
 *
 * @module citygml
 */
export * from "./CityGMLLoader";
export type {CityGMLLoadOptions} from "./CityGMLLoadOptions";
