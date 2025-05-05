
import type { MetaPropertyParams } from "./MetaPropertyParams";

/**
 * Legacy metadata property set parameters.
 */
export interface MetaPropertySetParams {

  /**
     * Globally-unique ID for the metadata property set.
     */
  id: string;

  /**
     * ID of the corresponding object within the originating system, if any.
     */
  originalSystemId: string;

  /**
     * Human-readable name of the metadata property set.
     */
  name: string;

  /**
     * Type of the metadata property set.
     */
  type: string;

  /**
     * Properties within the metadata property set.
     */
  properties: MetaPropertyParams [];

}
