import { TreeView } from "./TreeView";
import { TreeViewNode } from "./TreeViewNode";

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
