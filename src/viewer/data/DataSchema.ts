/**
 * Data type from which a {@link DataModel} is created.
 */
export type DataSchema = {
    id?: string,
    projectId?: string | number,
    revisionId?: string | number,
    author?: string,
    createdAt?: string,
    creatingApplication?: string,
    schema?: string,
    propertySets?: {
        id: string;
        originalSystemId?: string;
        name: string;
        type: string;
        properties?: {
            name: string,
            value: any,
            type?: string,
            valueType?: string | number,
            description?: string
        }[]
    }[],
    dataObjects?: {
        id: string;
        originalSystemId?: string;
        type: string;
        name: string;
        parentId?: string,
        propertySetIds?: string[]
    }[]
}