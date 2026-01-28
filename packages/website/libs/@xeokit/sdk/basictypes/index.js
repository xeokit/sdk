/**
 * <img style="padding:10px; width:300px" src="media://images/xeokit_components_icon.png"/>
 *
 * # xeokit Basic Semantic Data Types
 *
 * * Defines numeric constants for a basic set of entity and relationship types.
 * * Use with {@link "@xeokit/sdk/data" | @xeokit/sdk/data}  to assign basic types to {@link data!DataObject | DataObjects}
 * and {@link data!Relationship | Relationships} and treat them as elements of a basic entity-relationship graph.
 * * Use with {@link "@xeokit/treeview" | @xeokit/treeview} , to configure the appearance and behaviour of
 * {@link @xeokit/treeview!TreeView | TreeViews} for navigating basic element hierachies.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/sdk
 * ````
 *
 * @module basictypes
 */
/**
 * A generic entity.
 */
export const BasicEntity = 1000;
/**
 * A generic aggregation relationship between two generic entities.
 */
export const BasicAggregation = 1001;
/**
 * Map of names for all basic entity types.
 */
export const typeNames = {
    [BasicEntity]: "BasicEntity",
    [BasicAggregation]: "BasicAggregation"
};
/**
 * Map of type codes for all basic entity type names.
 */
export const typeCodes = {
    "BasicEntity": BasicEntity,
    "BasicAggregation": BasicAggregation
};
//# sourceMappingURL=index.js.map
