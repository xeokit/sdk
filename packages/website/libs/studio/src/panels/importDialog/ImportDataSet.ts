/**
 */

import type {Studio} from "../../Studio";
import type {ImportDataSetFile} from "./ImportDataSetFile";


/**
 * One importable data set — a coherent combination of one or more
 * files the user can load together (e.g. `glTF` alone, or `glTF
 * + DataModel JSON` to pair geometry with semantics).
 *
 * Adding a new data set is a matter of authoring a descriptor and
 * registering it in {@link IMPORT_DATA_SETS}.
 */
export interface ImportDataSet {
  /** Stable id, used as the dropdown's `<option>` value. */
  id: string;

  /** User-facing label shown in the dropdown. */
  label: string;

  /** Files this data set consumes, loaded in declaration order. */
  files: ImportDataSetFile[];

  /**
   * Whether this data set carries SceneModel geometry. The dialog
   * disables the Source-coordinate-system section when `false`
   * (basis / units / origin are meaningless for DataModel-only
   * imports). Defaults to `true` when omitted.
   */
  loadsSceneGeometry?: boolean;

  /**
   * Whether this data set carries DataModel semantics. When
   * `false` the dialog skips pre-creating an empty DataModel
   * (which would otherwise pollute the Data graph and panels
   * like the Explorer with empty entries). Defaults to `true`
   * when omitted.
   */
  loadsDataSemantics?: boolean;

  /**
   * Best-guess basis id (matching an entry in {@link IMPORT_BASES})
   * for files of this type. Used by the dialog as the default
   * Basis when the user picks this data set. Falls back to
   * `"unknown"` when omitted.
   */
  defaultBasisId?: string;

  /**
   * Optional one-line description shown beneath the file rows.
   * Used by file-less entries (e.g. the Sample Models picker) to
   * explain what Load will do.
   */
  description?: string;

  /**
   * Optional override for the default file-based Load. When
   * present, the dialog hides the file rows and routes the Load
   * click here. Used to delegate to a separate picker — e.g. the
   * Sample Models panel.
   */
  onLoad?: (studio: Studio) => void;
}
