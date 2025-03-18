import type { View } from "../viewer";
import { Component, EventEmitter } from "../core";
import type { Data } from "../data";
import { TreeViewParams } from "./TreeViewParams";
import { TreeViewNodeContextMenuEvent } from "./TreeViewNodeContextMenuEvent";
import { TreeViewNodeTitleClickedEvent } from "./TreeViewNodeTitleClickedEvent";
/**
 * An HTMl tree view that navigates the {@link data!DataObject | DataObjects} in the given
 * {@link data!Data | Data}, while controlling the visibility of their corresponding
 * {@link viewer!ViewObject | ViewObjects} in the given {@link viewer!View | View}.
 *
 * See {@link treeview | @xeokit/sdk/treeview} for usage.
 */
export declare class TreeView extends Component {
    #private;
    /**
     * Hierarchy mode that arranges the {@link TreeViewNode | TreeViewNodes} as an aggregation hierarchy.
     *
     * The mode creates a TreeViewNode hierarchy that mirrors that of the
     * {@link data!DataObject | DataObjects} and
     * aggregation {@link data!Relationship | Relationships} in the {@link data!Data | Data}.
     *
     * In this hierarchy, each TreeViewNode corresponds to a DataObject in the Data. The TreeViewNodes are connected
     * into a hierarchy that reflects a depth-first traversal from the root DataObjects that follows each DataObject's
     * outgoing Relationships of the type given in {@link TreeView.linkType | TreeView.linkType}.
     */
    static AggregationHierarchy: number;
    /**
     * Hierarchy mode that groups the {@link TreeViewNode | TreeViewNodes} by type.
     *
     * This mode creates a two-level hierarchy. At the root level, we get TreeViewNodes that represent each of the
     * distinct types in our {@link data!Data | Data}. Each of those gets one or more child TreeViewNodes
     * that represent {@link data!DataObject | DataObjects} of that type. When those DataObjects have
     * {@link viewer!ViewObject | ViewObjects} of the same ID, then the TreeViewNodes will have checkboxes
     * that we can use to show, hide, and X-ray their ViewObjects.
     */
    static TypesHierarchy: number;
    /**
     * Hierarchy mode that arranges the {@link TreeViewNode | TreeViewNodes} into an n-level grouped hierarchy.
     *
     * This mode creates a multi-level grouped hierarchy, following the order given
     * in {@link TreeViewParams.groupTypes | TreeViewParams.groupTypes}. The TreeViewNodes at level 0 are all the same
     * type as ````TreeViewParams.groupTypes[0]````, TreeViewNodes at level 1 are all the same type
     * as ````TreeViewParams.groupTypes[2]````, and so on. Once descended beyond the length of ````TreeViewParams.groupTypes````,
     * the TreeViewNodes are just grouped by type.
     */
    static GroupsHierarchy: number;
    /**
     * The semantic {@link data!Data | Data} model that determines the structure of this TreeView.
     */
    data: Data;
    /**
     * The {@link viewer!View | View} that contains the {@link viewer!ViewObject | ViewObjects}
     * navigated by this TreeView.
     */
    view: View;
    /**
     * Emits an event each time the title of a node is clicked in the tree view.
     *
     * @event
     */
    readonly onNodeTitleClicked: EventEmitter<TreeView, TreeViewNodeTitleClickedEvent>;
    /**
     * Emits an event each time we right-click on a tree node.
     *
     * @event
     */
    readonly onContextMenu: EventEmitter<TreeView, TreeViewNodeContextMenuEvent>;
    /**
     * Emits an event when this TreeView has been destroyed.
     *
     * Triggered by {@link TreeView.destroy}.
     *
     * @event
     */
    readonly onDestroyed: EventEmitter<TreeView, null>;
    /**
     *
     * @param params
     */
    constructor(params: TreeViewParams);
    /**
     * Gets how the nodes are organized within this tree view.
     *
     * Accepted values are:
     *
     * * {@link TreeView.AggregationHierarchy} (default)
     * * {@link TreeView.TypesHierarchy}
     * * {@link TreeView.GroupsHierarchy}
     */
    get hierarchy(): number;
    /**
     * Sets how the nodes are organized within this tree view.
     *
     * Accepted values are:
     *
     * * {@link TreeView.AggregationHierarchy} (default)
     * * {@link TreeView.TypesHierarchy}
     * * {@link TreeView.GroupsHierarchy}
     */
    set hierarchy(hierarchy: number);
    /**
     * When traversing the {@link data!Data | Data} to build the tree UI nodes, at each
     * {@link data!DataObject | DataObjects}, the TreeView will traverse only the outgoing
     * {@link data!Relationship | Relationships} of this type in
     * {@link data!DataObject.relating | DataObject.relating}.
     */
    get linkType(): number;
    /**
     * When traversing the {@link data!Data | Data} to build the tree UI nodes, at each
     * {@link data!DataObject | DataObjects}, the TreeView will traverse only the outgoing
     * {@link data!Relationship | Relationships} of this type in
     * {@link data!DataObject.relating | DataObject.relating}.
     */
    set linkType(linkType: number);
    /**
     * When traversing the {@link data!Data | Data} to build the tree UI nodes for
     * a {@link TreeView.GroupsHierarchy}, these are the values
     * of {@link data!DataObject.type | DataObject.type} that the
     * TreeView groups and subgroups the {@link data!DataObject | DataObjects} on.
     *
     * The grouping for {@link TreeView.GroupsHierarchy} has two levels. The major grouping type is given
     * in ````groupTypes[0]```` and the minor grouping type is given in ````storeyGroups[1]````.
     *
     * Example: ````[IfcBuilding, IfcBuildingStorey]````.
     */
    get groupTypes(): number[];
    /**
     * When traversing the {@link data!Data | Data} to build the tree UI nodes for
     * a {@link TreeView.GroupsHierarchy}, these are the values
     * of {@link data!DataObject.type | DataObject.type} that the
     * TreeView groups and subgroups the {@link data!DataObject | DataObjects} on.
     *
     * The grouping for the {@link treeview!TreeView.GroupsHierarchy | GroupsHierarchy} hierarchy has two levels. The major grouping type is given
     * in ````groupTypes[0]```` and the minor grouping type is given in ````storeyGroups[1]````.
     *
     * Example: ````[IfcBuilding, IfcBuildingStorey]````.
     */
    set groupTypes(groupTypes: number[]);
    /**
     * Highlights the tree view node that represents the given object {@link viewObject}.
     *
     * This causes the tree view to collapse, then expand to reveal the node, then highlight the node.
     *
     * If a node is previously highlighted, de-highlights that node and collapses the tree first.
     *
     * Note that if the TreeView was configured with ````pruneEmptyNodes: true```` (default configuration), then the
     * node won't exist in the tree if it has no viewObjects in the {@link scene!Scene | Scene}. in that case, nothing will happen.
     *
     * Within the DOM, the node is represented by an ````<li>```` element. This method will add a ````.highlighted-node```` class to
     * the element to make it appear highlighted, removing that class when de-highlighting it again. See the CSS rules
     * in the TreeView ifcviewer for an example of that class.
     *
     * @param {String} objectId ID of the {@link viewObject}.
     */
    showNode(objectId: string): void;
    /**
     * De-highlights the node previously shown with {@link TreeView#showNode}.
     *
     * Does nothing if no node is currently shown.
     *
     * If the node is currently scrolled into view, keeps the node in view.
     */
    unShowNode(): void;
    /**
     * Expands the tree to the given depth.
     *
     * Collapses the tree first.
     *
     * @param depth Depth to expand to.
     */
    expandToDepth(depth: number): void;
    /**
     * Closes all the nodes in the tree.
     */
    collapse(): void;
    /**
     * Destroys this TreeView.
     */
    destroy(): void;
}
//# sourceMappingURL=TreeView.d.ts.map