import type {MetaObjectParams} from "./MetaObjectParams";
import type {MetaPropertySetParams} from "./MetaPropertySetParams";

/**
 * Legacy metadata model parameters.
 */
export interface MetaModelParams {

  /**
   * ID of the project the model belongs to.
   */
  projectId: string,

  /**
   * Author of the model.
   */
  author: string,

  /**
   * Date the model was created.
   */
  createdAt: string,

  /**
   * Identifies the model schema.
   */
  schema: string,

  /**
   * Identifies the application that created the metadata model.
   */
  creatingApplication: string,

  /**
   * Metaobject parameters.
   */
  metaObjects: MetaObjectParams[],

  /**
   * Property set parameters.
   */
  propertySets: MetaPropertySetParams[]
}
