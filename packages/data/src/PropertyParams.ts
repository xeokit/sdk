/**
 * Parameters for creating a {@link Property} with{@link @xeokit/data!DataModel.createPropertySet | DataModel.createPropertySet}.
 *
 * See {@link "@xeokit/data" | @xeokit/data}  for usage.
 */
export interface PropertyParams {

    /**
     * Name of the {@link Property}.
     */
    name: string;

    /**
     * Value of the {@link Property}.
     */
    value: any;

    /**
     * Type of the {@link Property}.
     */
    type?: string;

    /**
     * Value type of the {@link Property}.
     */
    valueType?: string | number;

    /**
     * Description of the {@link Property}.
     */
    description?: string;
}
