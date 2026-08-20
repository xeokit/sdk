import type {MaterialMaps} from "../../../model/procgen/paintMaterials";
import type {HatchParams, HatchStyle} from "../../../model/scene/hatchPattern";


/**
 * Painter + optional material-parameter override for a single IFC type.
 *
 * Used as the value type in {@link DEFAULT_IFC_PAINTERS} and in the
 * `painters` override map accepted by {@link applyIFCMaterials}.
 */
export interface IfcPainterEntry {

  /**
   * Painter producing the {@link MaterialMaps} triple for this IFC
   * type. Receives the requested texture size in pixels (square).
   */
  paint: (size: number) => MaterialMaps;

  /**
   * Optional non-texture material parameters merged into the
   * generated `SceneMaterial`. Useful for transparent dielectrics
   * (windows, curtain wall) where `opacity` and `alphaMode` matter,
   * for adding a per-type colour multiplier, and for tagging the
   * material with an engineering hatch pattern (consumed by the
   * section-plane cap pass and the Detailed-mode hatched body
   * shading — `view.effects.bodyHatch`).
   */
  material?: {
    color?:        [number, number, number];
    opacity?:      number;
    alphaMode?:    "OPAQUE" | "MASK" | "BLEND";
    /**
     * ANSI / ISO hatch convention for the IFC type, applied to
     * the section-plane cap and (in detailed profile) overlaid on
     * the body. Accepts either a named style or full params.
     * Realistic mode ignores it and renders PBR.
     */
    hatchPattern?: HatchStyle | HatchParams;
  };
}
