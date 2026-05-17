/**
 * @module demo/panels/modelsPanel/ImportProvenance
 */

import type {CoordinateSystemParams} from "../../../model/scene";


/**
 * Where a loaded model came from. The ImportDialog records one
 * of these against the model's id after a successful load so the
 * ModelsPanel can surface "loaded via …" details.
 */
export interface ImportProvenance {
  /** {@link ImportDataSet.id} the user picked. */
  dataSetId: string;

  /** {@link ImportDataSet.label} — preserved as written when the load happened. */
  dataSetLabel: string;

  /** Filenames the user supplied, in `ImportDataSet.files` order. */
  fileNames: string[];

  /** Coordinate system applied at load, when the user overrode it. */
  coordinateSystem?: CoordinateSystemParams;
}
