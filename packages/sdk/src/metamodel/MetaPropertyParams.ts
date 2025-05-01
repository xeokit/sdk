/**
 * Legacy metadata property parameters.
 */
export interface MetaPropertyParams {

  /**
     * The name of the property.
     *
     * @property name
     * @type {String}
     */
  name: string;

  /**
     * The type of the property.
     *
     * @property type
     * @type {Number|String}
     */
  type: string;

  /**
     * The value of the property.
     *
     * @property value
     * @type {*}
     */
  value: string;

  /**
     * The type of the property's value.
     *
     * @property valueType
     * @type {Number|String}
     */
  valueType: string;

  /**
     * Informative text to explain the property.
     *
     * @property name
     * @type {String}
     */
  description: string;
}
