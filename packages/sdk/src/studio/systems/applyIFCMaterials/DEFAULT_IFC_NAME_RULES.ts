import type {IfcNameRule} from "./IfcNameRule";


/**
 * Built-in {@link IfcNameRule} list catching authoring-tool-specific
 * names that carry semantic meaning the IFC type alone doesn't —
 * primarily Revit-style proxy elements exported as
 * `IfcBuildingElementProxy`.
 *
 * Pattern set follows the same spirit as the xeokit V2 example
 * `xkt_vbo_fallbackColors_DigitalHub.html` `nameColorMap`. Regexes
 * are bilingual where common (German + English, the two languages
 * Revit / ArchiCAD models in the wild are most often authored in)
 * so models from European authoring tools route the same way as their
 * US/UK equivalents.
 *
 * Patterns use `\b` word boundaries where possible to avoid
 * false-positives on IFC name strings like
 * `"Basic Wall:Generic - 200mm:1234"` — common words like "light" or
 * "water" are deliberately omitted because they appear too often in
 * other contexts (e.g. "Light grey wall paint", "Water meter cover").
 *
 * Order matters — first match wins. Pass a custom `nameRules` array
 * to {@link applyIFCMaterials} to replace this list, or spread it
 * (`[...DEFAULT_IFC_NAME_RULES, ...mine]`) to extend.
 *
 * Each target key has a corresponding entry in
 * {@link DEFAULT_IFC_PAINTERS}, so a matched object actually paints
 * with a fitting material rather than dropping through to the
 * generic concrete fallback.
 */
export const DEFAULT_IFC_NAME_RULES: IfcNameRule[] = [

  // ── Vegetation ────────────────────────────────────────────────
  //
  // Revit RPC trees / shrubs / plants typically export as
  // IfcBuildingElementProxy. IFC 4.3 finally adds an explicit
  // IfcGeographicElement (with PredefinedType TREE / SHRUB) but
  // models in the wild are overwhelmingly pre-4.3.
  {
    pattern: /\b(?:tree|plant|shrub|hedge|bush|vegetation|baum|strauch|hecke|pflanz|busch)\b/i,
    key:     "IfcVegetation",
  },

  // ── People / RPC figures ──────────────────────────────────────
  //
  // RPC people (Revit Population Component) export as proxies; the
  // name typically contains "RPC", "Person", "Mensch", or
  // "Mannequin". "Figure" is too generic and is deliberately left
  // out — the cost of a false positive (e.g. an architectural
  // figure-eight balustrade) outweighs the benefit.
  {
    pattern: /\b(?:rpc|person|people|mensch|mannequin)\b/i,
    key:     "IfcPerson",
  },

  // ── Vehicles ──────────────────────────────────────────────────
  //
  // RPC cars / trucks / parked vehicles in site-context models. We
  // omit bare "auto" — too common a German word — and "car" — risk
  // of matching "carpet", "carbon", "carrier", "cardinal".
  {
    pattern: /\b(?:vehicle|truck|automobile|fahrzeug|lkw|kfz)\b/i,
    key:     "IfcVehicle",
  },

  // ── Lighting fixtures (proxy form) ────────────────────────────
  //
  // IfcLightFixture is a real IFC type, but lights are very often
  // exported as IfcBuildingElementProxy with a descriptive name.
  // Avoid bare "light" — too many false positives in colour /
  // material naming ("Light Grey Plaster"). Stick to terms that
  // unambiguously refer to a physical fixture.
  {
    pattern: /\b(?:luminaire|leuchte|downlight|spotlight|chandelier|kronleuchter|lampe)\b/i,
    key:     "IfcLightFixture",
  },

  // ── Water bodies ──────────────────────────────────────────────
  //
  // Pools, ponds, fountains in site / landscape models. Bare
  // "water" matches too much (water meters, waterproofing, etc.) so
  // we restrict to feature names.
  {
    pattern: /\b(?:pool|pond|fountain|teich|brunnen|wasserbecken)\b/i,
    key:     "IfcWater",
  },

  // ── Terrain / topography ──────────────────────────────────────
  //
  // IfcSite is the real type for ground / topo, but landscape
  // proxies + Revit toposurface exports often slip through as
  // IfcBuildingElementProxy.
  {
    pattern: /\b(?:terrain|topo|topography|topographie|gel(?:ä|ae)nde|topo(?:surface|graphy))\b/i,
    key:     "IfcSiteTerrain",
  },
];
