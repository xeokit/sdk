import type {DataObject} from "./DataObject";

/**
 * Parameters to configure the depth-first search performed by {@link searchObjects | searchObjects}
 * to locate {@link DataObject | DataObjects}.
 *
 * For detailed usage, refer to {@link data | @xeokit/sdk/model/data}.
 */
export interface SearchParams {

  /**
   * The ID of the {@link DataObject | DataObject} to start the traversal from.
   *
   * This is overridden by {@link SearchParams.startObject}.
   */
  startObjectId?: string;

  /**
   * The {@link DataObject | DataObject} to start the traversal from.
   *
   * This overrides {@link SearchParams.startObjectId}.
   */
  startObject?: DataObject;

  /**
   * Indicates whether to include the starting {@link SearchParams.startObjectId} or {@link SearchParams.startObject}
   * in the search results.
   *
   * The default is `true`.
   */
  includeStart?: boolean;

  /**
   * The types of {@link DataObject | DataObjects} to exclusively include in the search results.
   */
  includeObjects?: string[];

  /**
   * The types of {@link DataObject | DataObjects} to exclude from the search results.
   */
  excludeObjects?: string[];

  /**
   * The types of {@link Relationship | Relationships} to exclusively follow in each
   * {@link DataObject.relating | DataObject.relating} during the search.
   */
  includeRelating?: string[];

  /**
   * The types of {@link Relationship | Relationships} to exclude from being followed in each
   * {@link DataObject.related | DataObject.related} during the search.
   */
  excludeRelating?: string[];

  /**
   * The types of {@link Relationship | Relationships} to exclusively follow in each
   * {@link DataObject.related | DataObject.related} during the search.
   */
  includeRelated?: string[];

  /**
   * The types of {@link Relationship | Relationships} to exclude from being followed in each
   * {@link DataObject.relating | DataObject.relating} during the search.
   */
  excludeRelated?: string[];

  /**
   * Collects the search results as a list of {@link DataObject | DataObject} IDs.
   *
   * This option is mutually exclusive with {@link SearchParams.resultObjects} and {@link SearchParams.resultCallback}.
   */
  resultObjectIds?: string[];

  /**
   * Collects the search results as a list of {@link DataObject | DataObjects}.
   *
   * This option is mutually exclusive with {@link SearchParams.resultObjectIds} and {@link SearchParams.resultCallback}.
   */
  resultObjects?: DataObject[];

  /**
   * Collects the search results via a callback function that is executed for each matching
   * {@link DataObject | DataObject}.
   *
   * This option is mutually exclusive with {@link SearchParams.resultObjects} and {@link SearchParams.resultObjectIds}.
   */
  resultCallback?: (dataObject: DataObject) => boolean;
}
