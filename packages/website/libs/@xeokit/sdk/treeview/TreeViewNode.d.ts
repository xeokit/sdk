/**
 * A node in a TreeView.
 *
 * The `TreeViewNode` represents a single node in a hierarchical tree structure used for displaying objects
 * in a TreeView. Each node contains information about its identity, the associated objects, its visibility status,
 * and its relationship with other nodes in the tree.
 *
 * This interface is useful when working with a TreeView in the {@link treeview | @xeokit/sdk/treeview} module.
 *
 * @module treeview
 */
export interface TreeViewNode {
    /**
     * A unique identifier for the node in the tree.
     *
     * This ID is used to distinguish the node from others within the tree structure.
     */
    nodeId: string;
    /**
     * A unique identifier for the object associated with this node.
     *
     * This ID is typically used to link the node to a specific object in the scene or data model.
     */
    objectId: string;
    /**
     * The name or label of the node, usually displayed in the TreeView.
     *
     * This provides a human-readable title for the node.
     */
    title: string;
    /**
     * A numerical identifier or type code representing the type of the node.
     *
     * This type code could correspond to different kinds of nodes, such as groups, categories, or individual objects.
     */
    type: number;
    /**
     * The parent node of this node. If this node is a root node, this will be `null`.
     *
     * This reference creates the hierarchical structure, where nodes are organized into parent-child relationships.
     */
    parentNode: TreeViewNode | null;
    /**
     * The total number of view objects associated with this node, including all child nodes.
     *
     * This count reflects the number of objects under this node, useful for understanding the complexity of the node's contents.
     */
    numViewObjects: number;
    /**
     * The number of view objects that are currently visible under this node.
     *
     * This can be used to track how many objects are currently rendered or displayed in the TreeView.
     */
    numVisibleViewObjects: number;
    /**
     * A boolean flag indicating whether the node is checked (typically used in cases where the TreeView allows for selection of nodes).
     *
     * This is used to track whether the node has been selected or activated by the user.
     */
    checked: boolean;
    /**
     * A boolean flag indicating whether the node is "xrayed" (i.e., whether its objects are highlighted or visually emphasized).
     *
     * This is used to track whether the node's objects are given special visual treatment, such as transparency or emphasis.
     */
    xrayed: boolean;
    /**
     * An array of child nodes under this node. These represent the sub-nodes in the hierarchy.
     *
     * This property allows for recursive tree structures, where each node can have multiple child nodes, forming a tree-like structure.
     */
    childNodes: TreeViewNode[];
}
//# sourceMappingURL=TreeViewNode.d.ts.map