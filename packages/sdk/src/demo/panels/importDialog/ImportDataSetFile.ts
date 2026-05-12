/**
 * @module demo/panels/importDialog/ImportDataSetFile
 */

/**
 * One file expected by an {@link ImportDataSet}.
 */
export interface ImportDataSetFile {
  /** Stable key — distinguishes files when a data set has more than one. */
  key: string;

  /** User-facing label, e.g. `"SceneModel JSON"`. */
  label: string;

  /** Native `<input type="file">` `accept` attribute. */
  accept: string;

  /** `format` string passed to {@link DemoHelper.loadModel} for this file. */
  loadFormat: string;

  /** When `false`, the file can be left empty and is skipped on Load. */
  required: boolean;
}
