import type {MaterialMaps} from "../../procgen/paintMaterials";


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
   * or for adding a per-type colour multiplier.
   */
  material?: {
    color?:     [number, number, number];
    opacity?:   number;
    alphaMode?: "OPAQUE" | "MASK" | "BLEND";
  };
}
