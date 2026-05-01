import {InspectionRegistry} from "./InspectionRegistry";
import {geometryDataIntegrity}      from "./inspections/geometryDataIntegrity";
import {meshReferences}           from "./inspections/meshReferences";
import {materialAttributeBinding}    from "./inspections/materialAttributeBinding";
import {objectMeshReferences}     from "./inspections/objectMeshReferences";
import {transformParentCycles}    from "./inspections/transformParentCycles";
import {unusedResources}    from "./inspections/unusedResources";
import {identityTransforms} from "./inspections/identityTransforms";
import {duplicateGeometries} from "./inspections/duplicateGeometries";
import {similarGeometries}  from "./inspections/similarGeometries";
import {denseGeometries}    from "./inspections/denseGeometries";
import {largeGeometries}    from "./inspections/largeGeometries";
import {geometryQuality}    from "./inspections/geometryQuality";
import {objectPlacement}    from "./inspections/objectPlacement";
import {textureDimensions}      from "./inspections/textureDimensions";
import {farFromOriginGeometries} from "./inspections/farFromOriginGeometries";


/**
 * The {@link InspectionRegistry} {@link inspectSceneModel} reaches
 * for when no `registry` is supplied in its params. Pre-populated
 * with the built-in inspections that ship from
 * {@link demo/modelInspector/inspections}.
 *
 * Registration order:
 *
 *   1. `geometryDataIntegrity`        (errors, always run)
 *   2. `meshReferences`             (errors, always run)
 *   3. `materialAttributeBinding`      (warnings, always run)
 *   4. `objectMeshReferences`       (errors, always run)
 *   5. `transformParentCycles`      (errors, always run)
 *   6. `unusedResources`      (warnings, always run)
 *   7. `identityTransforms`   (warning, always run)
 *   8. `duplicateGeometries`  (warning, opt-in via params)
 *   9. `similarGeometries`    (warning, opt-in via params)
 *  10. `denseGeometries`      (warning, opt-in via params)
 *  11. `largeGeometries`      (warning, opt-in via params)
 *  12. `geometryQuality`      (warnings, opt-in via params)
 *  13. `objectPlacement`      (warnings, opt-in via params)
 *  14. `textureDimensions`        (warnings, opt-in via params)
 *  15. `farFromOriginGeometries` (warning, opt-in via params)
 *
 * Plugins are expected to register additional inspections into this
 * singleton on import:
 *
 * ```ts
 * import {DEFAULT_INSPECTION_REGISTRY} from "@xeokit/sdk/demo";
 *
 * DEFAULT_INSPECTION_REGISTRY.register({
 *   codes: ["MyApp/CHECK_NAMING"],
 *   description: "Enforce object-naming convention",
 *   run(sceneModel) { ... },
 * });
 * ```
 *
 * Tests / one-off pipelines can ignore the singleton and build a
 * fresh `InspectionRegistry` instead, then pass it via the
 * `registry` field on {@link InspectSceneModelParams}.
 */
export const DEFAULT_INSPECTION_REGISTRY: InspectionRegistry = new InspectionRegistry([
  geometryDataIntegrity,
  meshReferences,
  materialAttributeBinding,
  objectMeshReferences,
  transformParentCycles,
  unusedResources,
  identityTransforms,
  duplicateGeometries,
  similarGeometries,
  denseGeometries,
  largeGeometries,
  geometryQuality,
  objectPlacement,
  textureDimensions,
  farFromOriginGeometries,
]);
