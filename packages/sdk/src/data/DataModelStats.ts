
/**
 * Statistics for a {@link DataModel | DataModel}.
 *
 */
export interface DataModelStats {

    /**
     * The number of {@link DataObject | DataObjects} in the {@link DataModel | DataModel}.
     */
    numObjects: number;

    /**
     * The number of {@link Relationship | Relationships} in the {@link DataModel | DataModel}.
     */
    numRelationships: number;

    /**
     * The number of {@link PropertySet | PropertySets} in the {@link DataModel | DataModel}.
     */
    numPropertySets: number;
}
