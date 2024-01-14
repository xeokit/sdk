import {TreeViewNode} from "./TreeViewNode";
import {TreeView} from "./TreeView";

/**
 * Event fired by {@link TreeView.onContextMenu}.
 */
export interface TreeViewNodeContextMenuEvent {
    event: Event;
    treeView: TreeView;
    treeViewNode: TreeViewNode;
}