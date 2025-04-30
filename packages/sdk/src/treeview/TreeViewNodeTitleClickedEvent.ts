import { TreeViewNode } from "./TreeViewNode";
import { TreeView } from "./TreeView";

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
