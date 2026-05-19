import {paintConcrete} from "../../../model/procgen/paintMaterials";

import type {IfcPainterEntry} from "./IfcPainterEntry";


const DIFFUSE_TINT: [number, number, number] = [1.6, 1.6, 1.6];


/**
 * Painter used by {@link applyIFCMaterials} when an object's IFC type
 * isn't in the lookup table. Defaults to a tinted concrete so unknown
 * elements render as a neutral matte grey.
 */
export const FALLBACK_IFC_PAINTER: IfcPainterEntry = {
  paint:    paintConcrete,
  material: {color: DIFFUSE_TINT},
};
