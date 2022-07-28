/**
 * Parameters for creating a {@link DataObject} with {@link DataModel.createDataObject}.
 */
export interface DataObjectParams {
    id: string;
    originalSystemId?: string;
    type: string;
    name: string;
    parentId?: string,
    propertySetIds?: string[]
}