import type {MaterialMaps} from "../../model/procgen/paintMaterials";
import type {HatchParams, HatchStyle} from "../../model/scene/hatchPattern";


/**
 * Single entry in a {@link MaterialsPalette}'s catalog of procedural
 * painters.
 *
 * Holds the metadata UI code needs to label an entry alongside the
 * painter callable + the SceneMaterial parameter overrides
 * (transparency, colour multiplier) that go with the painter's PBR
 * texture set.
 */
export interface PainterCatalogEntry {

  /**
   * Stable, machine-readable id used to look the painter up
   * (`"brick"`, `"polSteel"`, `"glass"`, …). Must be unique within a
   * MaterialsPalette catalog.
   */
  id: string;

  /**
   * Human-readable label. Used for the context-menu item and other
   * UI surfaces.
   */
  label: string;

  /**
   * Coarse category — the same four buckets {@link paintMaterials |
   * `procgen/paintMaterials`} groups its painters into: `"Masonry"`,
   * `"Interior"`, `"Metal"`, or `"Glass"`. UI code may render
   * painters grouped by this field.
   */
  category: "Masonry" | "Interior" | "Metal" | "Glass";

  /**
   * Painter producing the {@link MaterialMaps} triple. Receives the
   * requested texture size in pixels (square).
   */
  paint: (size: number) => MaterialMaps;

  /**
   * Optional non-texture material parameters merged into the
   * generated `SceneMaterial`. Used for transparent dielectrics
   * (windows, glass) where `opacity` and `alphaMode` matter, for
   * the per-category colour multiplier compensating for the
   * diffuse `albedo / π` term in the Cook-Torrance BRDF, and for
   * tagging the material with an engineering hatch pattern
   * (consumed by the section-plane cap pass and the Detailed-mode
   * hatched body shading — `view.effects.bodyHatch`).
   */
  material?: {
    color?:        [number, number, number];
    opacity?:      number;
    alphaMode?:    "OPAQUE" | "MASK" | "BLEND";
    /**
     * ANSI / ISO hatch convention for this painter. Applied to
     * the section-plane cap and (in detailed profile) overlaid on
     * the body. Realistic mode ignores it and renders PBR.
     */
    hatchPattern?: HatchStyle | HatchParams;
  };
}
