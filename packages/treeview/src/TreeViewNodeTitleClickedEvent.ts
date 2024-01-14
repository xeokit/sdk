import {TreeViewNode} from "./TreeViewNode";
import {TreeView} from "./TreeView";

/**
 * Event fired by {@link TreeView.onNodeTitleClicked}.
 */
export interface TreeViewNodeTitleClickedEvent {
    event: Event;
    treeView: TreeView;
    treeViewNode: TreeViewNode;
}