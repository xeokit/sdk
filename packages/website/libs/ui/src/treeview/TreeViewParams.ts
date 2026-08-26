import type {Data} from "@xeokit/sdk/model/data";
import type {View} from "@xeokit/sdk/viewing/viewer";
import {TreeViewEvents} from "./TreeViewEvents";

/**
 * Parameters to create a {@link ui!treeview.TreeView | TreeView}.
 *
 * See {@link treeview | @xeokit/sdk/treeview} for usage.
 */
export interface TreeViewParams {

  /**
   * The {@link viewing!viewer.View | View} that contains the {@link viewing!viewer.ViewObject | ViewObjects}
   * navigated by the {@link ui!treeview.TreeView | TreeView}.
   */
  view: View;

  /**
   * The semantic {@link model!data.Data | Data} model that determines the structure of the {@link ui!treeview.TreeView | TreeView}.
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
   * When traversing the {@link model!data.Data | Data} to build the tree UI nodes, at each
   * {@link model!data.DataObject | DataObjects}, the {@link ui!treeview.TreeView | TreeView} will traverse only the outgoing
   * {@link model!data.Relationship| Relationships} of this type in
   * {@link model!data.DataObject.relating | DataObject.relating}.
   */
  linkType: string | string[],

  /**
   * When traversing the {@link model!data.Data | Data} to build the tree UI nodes for a {@link ui!treeview.TreeView.GroupsHierarchy | GroupsHierarchy}
   * hierarchy, these are the values of {@link model!data.DataObject.type | DataObject.type} that the
   * {@link ui!treeview.TreeView | TreeView} groups the {@link model!data.DataObject | DataObjects} on.
   *
   * The grouping for the {@link ui!treeview.TreeView.GroupsHierarchy | GroupsHierarchy} hierarchy has two levels. The major grouping type is given
   * in ````groupTypes[0]```` and the minor grouping type is given in ````storeyGroups[1]````.
   */
  groupTypes: string[]

  /**
   * {@link model!data.DataObject.type | DataObject.type}
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

  /**
   * External emitters for this {@link ui!treeview.TreeView | TreeView}.
   * Used when routing events from multiple TreeViews.
   */
  events? : TreeViewEvents;
}
