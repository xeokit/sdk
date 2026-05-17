import {FixRegistry} from "./FixRegistry";
import {pruneDanglingMeshRefs}   from "./fixes/pruneDanglingMeshRefs";
import {dropUnusedMaterial}    from "./fixes/dropUnusedMaterial";
import {dropUnusedTexture}     from "./fixes/dropUnusedTexture";
import {dropUnusedTransform}   from "./fixes/dropUnusedTransform";
import {dropIdentityTransform} from "./fixes/dropIdentityTransform";
import {mergeDuplicateGeometries}       from "./fixes/mergeDuplicateGeometries";
import {mergeSimilarGeometries}         from "./fixes/mergeSimilarGeometries";
import {splitDenseGeometry}     from "./fixes/splitDenseGeometry";
import {splitLargeGeometry}     from "./fixes/splitLargeGeometry";
import {splitOversizedGeometry} from "./fixes/splitOversizedGeometry";
import {dropDegenerateTriangles} from "./fixes/dropDegenerateTriangles";
import {compactUnusedVertices}  from "./fixes/compactUnusedVertices";
import {mergeDuplicateVertices}         from "./fixes/mergeDuplicateVertices";
import {downgradeNonWatertight} from "./fixes/downgradeNonWatertight";
import {dropDuplicateObject}   from "./fixes/dropDuplicateObject";
import {recenterGeometry}       from "./fixes/recenterGeometry";
import {unifyTriangleWinding}           from "./fixes/unifyTriangleWinding";
import {tightenAabb}            from "./fixes/tightenAabb";
import {dropDuplicateTriangles} from "./fixes/dropDuplicateTriangles";


/**
 * The {@link FixRegistry} {@link applyFixes} reaches for
 * when no `registry` is supplied in its params. Pre-populated with
 * the built-in strategies that ship from
 * {@link demo/sceneModelInspector/fixes}.
 *
 * Plugins are expected to register additional strategies into this
 * singleton on import:
 *
 * ```ts
 * import {DEFAULT_FIX_REGISTRY} from "@xeokit/sdk/demo";
 *
 * DEFAULT_FIX_REGISTRY.register({
 *   codes: ["MyApp/STALE_PROPERTY_SET"],
 *   description: "Prune deprecated property sets",
 *   apply(issue, sceneModel) { ... },
 * });
 * ```
 *
 * To override a built-in remediation, register your own strategy
 * for the same code — last-registration-wins
 * (see {@link FixRegistry.register}). To opt out
 * completely, call `DEFAULT_FIX_REGISTRY.unregister(code)`
 * — subsequent `applyFixes` runs treat that code as having no
 * matching strategy and skip it.
 *
 * Tests / one-off pipelines can ignore the singleton and build a
 * fresh `FixRegistry` instead.
 */
export const DEFAULT_FIX_REGISTRY: FixRegistry = new FixRegistry([
  pruneDanglingMeshRefs,
  dropUnusedMaterial,
  dropUnusedTexture,
  dropUnusedTransform,
  dropIdentityTransform,
  mergeDuplicateGeometries,
  mergeSimilarGeometries,
  splitDenseGeometry,
  splitLargeGeometry,
  splitOversizedGeometry,
  dropDegenerateTriangles,
  compactUnusedVertices,
  mergeDuplicateVertices,
  downgradeNonWatertight,
  dropDuplicateObject,
  recenterGeometry,
  unifyTriangleWinding,
  tightenAabb,
  dropDuplicateTriangles,
]);
