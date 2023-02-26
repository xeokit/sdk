/**
 * [![npm version](https://badge.fury.io/js/%40xeokit%2Fdatatypes.svg)](https://badge.fury.io/js/%40xeokit%2Fdatatypes)
 * [![](https://data.jsdelivr.com/v1/package/npm/@xeokit/datatypes/badge)](https://www.jsdelivr.com/package/npm/@xeokit/datatypes)
 * 
 * <img style="padding:10px" src="media://images/xeokit_components_icon.png"/>
 *
 * ## Basic Data Types
 *
 * * Defines numeric constants for a basic set of entity and relationship types.
 * * Use with {@link "@xeokit/datamodel"} to assign basic types to {@link @xeokit/datamodel!DataObject | DataObjects}
 * and {@link @xeokit/datamodel!Relationship | Relationships} and treat them as elements of a basic entity-relationship graph.
 * * Use with {@link "@xeokit/treeview"}, to configure the appearance and behaviour of
 * {@link @xeokit/treeview!TreeView | TreeViews} for navigating basic element hierachies.
 *
 * ## Installation
 *
 * ````bash
 * npm install @xeokit/datatypes
 * ````
 *
 * @module @xeokit/datatypes/basicTypes
 */

/**
 * A generic entity.
 */
export const BasicEntity = 1000;

/**
 * A generic aggregation relationship between two generic entities.
 */
export const BasicAggregation = 1001;
