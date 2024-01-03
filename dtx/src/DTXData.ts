import {type DTXDataLayer} from "./DTXDataLayer";

/**
 *  DTX file data.
 *
 *  The elements of an [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#DTX) file, unpacked into a set of arrays for parsing.
 *
 *  This interface represents the structure of an [DTX](https://xeokit.github.io/sdk/docs/pages/GLOSSARY.html#DTX) file.
 */
export interface DTXData {

    layers: DTXDataLayer[];
}