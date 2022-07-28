/**
 * Parameters for creating a {@link Property} with {@link PropertySet.createProperty}.
 */
export interface PropertyParams  {
    name: string;
    value: any;
    type?: string;
    valueType?: string | number;
    description?: string;
}