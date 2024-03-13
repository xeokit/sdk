/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fdatatypes.svg)](https://badge.fury.io/js/%40xeokit%2Fdatatypes)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/basictypes/badge)](https://www.jsdelivr.com/package/npm/@xeokit/basictypes)
 *
 * <img style="padding:10px; width:300px" src="media://images/xeokit_components_icon.png"/>
 *
 * # xeokit Basic Semantic Data Types
 *
 * * Defines numeric constants for a basic set of entity and relationship types.
 * * Use with {@link "@xeokit/data" | @xeokit/data}  to assign basic types to {@link @xeokit/data!DataObject | DataObjects}
 * and {@link @xeokit/data!Relationship | Relationships} and treat them as elements of a basic entity-relationship graph.
 * * Use with {@link "@xeokit/treeview" | @xeokit/treeview} , to configure the appearance and behaviour of
 * {@link @xeokit/treeview!TreeView | TreeViews} for navigating basic element hierachies.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/basictypes
 * ````
 *
 * @module @xeokit/basictypes
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
export const typeNames: { [key: number]: string } = {
    [BasicEntity]: "BasicEntity",
    [BasicAggregation]: "BasicAggregation"
};

/**
 * Map of type codes for all basic entity type names.
 */
export const typeCodes: { [key: string]: number } = {
    "BasicEntity": BasicEntity,
    "BasicAggregation": BasicAggregation
};
