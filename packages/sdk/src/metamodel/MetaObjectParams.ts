/**
 * Legacy metadata object parameters.
 */
export interface MetaObjectParams {

  /**
     * IDs of propery sets linked to the metadata object.
     */
  propertySetIds: string[];

  /**
     * Property sets belonging to the metadata object.
     */
  propertySets?: string[];

  /**
     * The original system ID of the metadata object.
     */
  originalSystemId?: string;

  /**
     * The ID of the metadata object.
     */
  id:string,

  /**
     * The name of the metadata object.
     */
  name: string,

  /**
     * The type of the metadata object.
     */
  type: string,

  /**
     * ID of the parent metadata object.
     */
  parent: string
}
