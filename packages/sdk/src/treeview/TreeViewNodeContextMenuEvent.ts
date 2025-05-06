import type {TreeView} from "./TreeView";
import type {TreeViewNode} from "./TreeViewNode";

/**
 * Event fired by {@link TreeView.onContextMenu}.
 *
 * See {@link treeview | @xeokit/sdk/treeview} for usage.
 */
export interface TreeViewNodeContextMenuEvent {
  event: Event;
  treeView: TreeView;
  treeViewNode: TreeViewNode;
}
