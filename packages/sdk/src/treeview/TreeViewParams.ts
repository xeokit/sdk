import type { Data } from "../data";
import type { View } from "../viewer";

/**
 * Parameters to create a {@link treeview!TreeView | TreeView}.
 *
 * See {@link treeview | @xeokit/sdk/treeview} for usage.
 */
export interface TreeViewParams {

  /**
     * The {@link viewer!View | View} that contains the {@link viewer!ViewObjects | ViewObjects}
     * navigated by the {@link treeview!TreeView | TreeView}.
     */
  view: View;

  /**
     * The semantic {@link data!Data | Data} model that determines the structure of the {@link treeview!TreeView | TreeView}.
     */
  data: Data;

  /**
     *
     */
  containerElement: HTMLElement;

  /**
     *
     */
  includeViewLayerIds?: string[];

  /**
     *
     */
  excludeViewLayerIds?: string[];

  /**
     * When traversing the {@link data!Data | Data} to build the tree UI nodes, at each
     * {@link data!DataObject | DataObjects}, the {@link treeview!TreeView | TreeView} will traverse only the outgoing
     * {@link data!Relationship| Relationships} of this type in
     * {@link data!DataObject.relating | DataObject.relating}.
     */
  linkType: number,

  /**
     * When traversing the {@link data!Data | Data} to build the tree UI nodes for a {@link treeview!TreeView.GroupsHierarchy | GroupsHierarchy}
     * hierarchy, these are the values of {@link data!DataObject.type | DataObject.type} that the
     * {@link treeview!TreeView | TreeView} groups the {@link data!DataObject | DataObjects} on.
     *
     * The grouping for the {@link treeview!TreeView.GroupsHierarchy | GroupsHierarchy} hierarchy has two levels. The major grouping type is given
     * in ````groupTypes[0]```` and the minor grouping type is given in ````storeyGroups[1]````.
     */
  groupTypes: number[]

  /**
     * {@link data!DataObject.type | DataObject.type}
     *
     * TODO
     *
     * * {@link TreeView.AggregationHierarchy}
     * * {@link TreeView.TypesHierarchy}
     * * {@link TreeView.GroupsHierarchy}
     */
  hierarchy: number;

  rootName?: string;
  pruneEmptyNodes?: boolean;
  sortNodes?: boolean;
  autoExpandDepth?: number;
}
