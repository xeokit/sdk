import {View} from "@xeokit/viewer";
import {Data} from "@xeokit/data";

/**
 * Parameters to create a {@link @xeokit/treeview!TreeView | TreeView}.
 */
export interface TreeViewParams {

    /**
     * The {@link @xeokit/viewer!View | View} that contains the {@link @xeokit/viewer!ViewObjects | ViewObjects}
     * navigated by the {@link @xeokit/treeview!TreeView | TreeView}.
     */
    view: View;

    /**
     * The semantic {@link @xeokit/data!Data | Data} model that determines the structure of the {@link @xeokit/treeview!TreeView | TreeView}.
     */
    data: Data;

    /**
     *
     */
    containerElement: HTMLElement;

    /**
     *
     */
    includeLayerIds?: string[];

    /**
     *
     */
    excludeLayerIds?: string[];

    /**
     * When traversing the {@link @xeokit/data!Data | Data} to build the tree UI nodes, at each
     * {@link @xeokit/data!DataObject | DataObjects}, the {@link @xeokit/treeview!TreeView | TreeView} will traverse only the outgoing
     * {@link @xeokit/data!Relationship| Relationships} of this type in
     * {@link @xeokit/data!DataObject.relating | DataObject.relating}.
     */
    linkType: number,

    /**
     * When traversing the {@link @xeokit/data!Data | Data} to build the tree UI nodes for a {@link @xeokit/treeview!TreeView.GroupsHierarchy | GroupsHierarchy}
     * hierarchy, these are the values of {@link @xeokit/data!DataObject.type | DataObject.type} that the
     * {@link @xeokit/treeview!TreeView | TreeView} groups the {@link @xeokit/data!DataObject | DataObjects} on.
     *
     * The grouping for the {@link @xeokit/treeview!TreeView.GroupsHierarchy | GroupsHierarchy} hierarchy has two levels. The major grouping type is given
     * in ````groupTypes[0]```` and the minor grouping type is given in ````storeyGroups[1]````.
     */
    groupTypes: number[]

    /**
     * {@link @xeokit/data!DataObject.type | DataObject.type}
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
}