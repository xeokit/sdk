import type { TreeView } from "./TreeView";
import type { TreeViewNode } from "./TreeViewNode";

/**
 * Event fired by {@link TreeView.onNodeTitleClicked}.
 *
 * See {@link treeview | @xeokit/sdk/treeview} for usage.
 */
export interface TreeViewNodeTitleClickedEvent {
  event: Event;
  treeView: TreeView;
  treeViewNode: TreeViewNode;
}
