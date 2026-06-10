/**
 * <img style="padding:10px" src="../../assets/xeokit_components_icon.png"/>
 *
 * # fds — NIST Fire Dynamics Simulator Importer
 *
 * Import the geometry of NIST FDS-6 input files into xeokit.
 *
 * ## Overview
 *
 * FDS (Fire Dynamics Simulator) input files are Fortran-style
 * namelist text describing axis-aligned compartment geometry,
 * vents, holes, and the computational meshes that surround them.
 * The xeokit SDK supports importing the geometry and semantic
 * structure of these files so reviewers can visualize what the fire
 * engineer typed up, alongside any IFC / glTF / CityJSON models in
 * the same scene.
 *
 * v1 of the loader covers:
 *
 * - `&HEAD` — project metadata
 * - `&MESH` — computational grids, rendered as wireframe outlines
 * - `&SURF` — surface materials referenced by elements
 * - `&OBST` — solid obstructions (axis-aligned boxes)
 * - `&VENT` — boundary faces (quads)
 * - `&HOLE` — subtractive volumes against obstructions
 *
 * Non-axis-aligned `&GEOM`, simulation output (`.smv`, slice files,
 * particles), `&MULT` instancing, and `&DEVC` devices are not
 * imported in v1; records of these groups are silently ignored.
 *
 * The DataModel uses the `fds6` {@link inspect!dataModel.DataFormatSchema | DataFormatSchema}
 * with object types `FDSProject`, `FDSMesh`, `FDSObstruction`,
 * `FDSVent`, `FDSHole`, `FDSSurface`, and the `contains` /
 * `usesSurface` relationship types.
 *
 * ## Installation
 *
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ## Example
 *
 * ```ts
 * import { Scene } from "@xeokit/sdk/model/scene";
 * import { Data }  from "@xeokit/sdk/model/data";
 * import { FDSLoader } from "@xeokit/sdk/formats/fds";
 *
 * const scene = new Scene();
 * const data  = new Data();
 *
 * const sceneModelResult = scene.createModel({ id: "myModel" });
 * if (sceneModelResult.ok === false) throw new Error(sceneModelResult.error);
 * const dataModelResult  = data.createModel({ id: "myModel" });
 * if (dataModelResult.ok === false) throw new Error(dataModelResult.error);
 *
 * const sceneModel = sceneModelResult.value;
 * const dataModel  = dataModelResult.value;
 *
 * const loader = new FDSLoader();
 *
 * fetch("compartment.fds")
 *   .then(r => r.text())
 *   .then(text => loader.load({
 *     fileData:   text,
 *     sceneModel,
 *     dataModel,
 *   }));
 * ```
 *
 * @module fds
 * @document ./README.md
 */
export * from "./FDSLoader";
export * from "./FDSExporter";
