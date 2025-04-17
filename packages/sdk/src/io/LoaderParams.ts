import {ParseParams} from "./ParseParams";

/**
 *
 */
export interface LoaderParams {
    parsers: {
        [key: string]: (params: ParseParams, options: any) => Promise<any>
    };
    fileDataType: string;
    getVersion: (fileData: any) => string;
}
