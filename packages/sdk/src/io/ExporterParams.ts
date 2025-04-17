import {EncodeParams} from "./EncodeParams";

/**
 *
 */
export interface ExporterParams {
    encoders: {
        [key: string]: (params: EncodeParams, options?: any) => Promise<any>
    };
    defaultVersion: string;
    fileDataType: string;
}
