/**
 * A node in a TreeView.
 */
export interface TreeViewNode {
    nodeId: string;
    objectId: string;
    title: string;
    type: number;
    parentNode: TreeViewNode | null;
    numViewObjects: number;
    numVisibleViewObjects: number;
    checked: boolean;
    xrayed: boolean;
    childNodes: TreeViewNode[];
}