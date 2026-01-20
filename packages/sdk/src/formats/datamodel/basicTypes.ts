/**
 * <img style="padding:10px; width:300px" src="https://xeokit.github.io/sdk/docs/assets/xeokit_components_icon.png"/>
 *
 * # xeokit Basic Semantic Data Types
 *
 * This module defines numeric constants representing a basic set of entity and relationship types.
 *
 * ## Key Features
 * - Assigns fundamental types to {@link data!DataObject | DataObjects} and {@link data!Relationship | Relationships},
 *   treating them as elements within an entity-relationship graph.
 * - Integrates with {@link treeview | treeview} to configure the appearance and behavior of
 *   {@link treeview!TreeView | TreeViews} for navigating basic hierarchical structures.
 *
 * ## Installation
 * ```bash
 * npm install @xeokit/sdk
 * ```
 *
 * ## Usage
 * ```javascript
 * import { BasicEntity, BasicAggregation } from "@xeokit/sdk/basictypes";
 * ```
 *
 * @module basictypes
 */

/**
 * Represents a generic entity.
 * Used as a fundamental building block within an entity-relationship graph.
 */
export const BasicEntity = 1000;

/**
 * Represents a generic aggregation relationship between two entities.
 * Used to define hierarchical or compositional relationships between entities.
 */
export const BasicAggregation = 1001;

/**
 * Maps numeric type codes to their corresponding entity type names.
 */
export const typeNames: { [key: number]: string } = {
  [BasicEntity]: "BasicEntity",
  [BasicAggregation]: "BasicAggregation"
};

/**
 * Maps entity type names to their corresponding numeric type codes.
 */
export const typeCodes: { [key: string]: number } = {
  "BasicEntity": BasicEntity,
  "BasicAggregation": BasicAggregation
};
