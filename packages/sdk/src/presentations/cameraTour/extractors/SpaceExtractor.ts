import type {SDKResult} from "../../../base/core";
import type {DataModel} from "../../../model/data";
import type {SceneModel} from "../../../model/scene";

import type {CameraTourPlanOptions} from "../plan/CameraTourPlanOptions";
import type {SpaceGraph} from "../graph/SpaceGraph";


/**
 * Inputs handed to {@link SpaceExtractor.extract}.
 */
export interface SpaceExtractorInput {
  sceneModel: SceneModel;
  dataModel?: DataModel;
  options: Required<Omit<CameraTourPlanOptions, "onProgress" | "up" | "startSpaceId">> &
           Pick<CameraTourPlanOptions, "onProgress" | "up" | "startSpaceId">;
}


/**
 * Stage 1 of the {@link planCameraTour} pipeline — turns the
 * source model into a {@link SpaceGraph} of rooms and the
 * portals connecting them.
 *
 * The default extractor (`extractSpacesFromIfc`) walks
 * `dataModel.objectsByType["IfcSpace"]` for nodes and uses
 * `IfcRelSpaceBoundary` / adjacent `IfcDoor` placements to wire
 * edges. The geometry fallback (`extractSpacesFromGeometry`)
 * clusters horizontal slab regions and detects wall apertures.
 *
 * Implementations should:
 *  - return `SDKErrorType.InvalidInput` if the source can't be
 *    interpreted (e.g. IFC extractor on a SceneModel with no
 *    DataModel attached);
 *  - return an empty-but-valid `SpaceGraph` (zero nodes) for
 *    sources that are valid but contain no recognisable spaces;
 *  - never throw — failures travel back through `SDKResult`.
 */
export interface SpaceExtractor {
  extract(input: SpaceExtractorInput): Promise<SDKResult<SpaceGraph>>;
}
