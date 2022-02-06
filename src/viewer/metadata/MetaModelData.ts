/**
 * Data type from which a {@link MetaModel} is created.
 */
export type MetaModelData = {
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
    metaObjects?: {
        id: string;
        originalSystemId?: string;
        type: string;
        name: string;
        parentId?: string,
        propertySetIds?: string[]
    }[]
}