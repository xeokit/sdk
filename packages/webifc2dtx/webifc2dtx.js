#!/usr/bin/env node

const {webifc2dtx, _SAVED_DTX_VERSIONS, _DEFAULT_SAVED_DTX_VERSION} = require("./dist/webifc2dtx.cjs.js");

const commander = require('commander');
const npmPackage = require('./package.json');
const fs = require('fs');
const path = require("path");
const WebIFC = require("web-ifc/web-ifc-api-node.js");

const program = new commander.Command();

program.version(npmPackage.version, '-v, --version');

program
    .description(`CLI that uses WebIFC to convert a small IFC file into a xeokit DTX SceneModel file and/or a JSON DataModel file`)
    .option('-i, --input [file]', 'path to input IFC model file (required)')
    .option('-s, --scenemodel [file]', 'path to target DTX SceneModel file (optional)')
    .option('-d, --datamodel [file]', 'path to target JSON DataModel file (optional)')
    .option('-f, --format [number]', `target DTX version (optional) - ${supportedDTX()}, default is ${_DEFAULT_SAVED_DTX_VERSION}`)
    .option('-l, --log', 'enable logging (optional)');

function supportedDTX() {
    if (_SAVED_DTX_VERSIONS.length > 1) {
        return `supported DTX versions are [${_SAVED_DTX_VERSIONS}]`;
    } else {
        return `supported DTX version is ${_DEFAULT_SAVED_DTX_VERSION}`;
    }
}

program.on('--help', () => {
    //  console.log(`\n\nDTX version: 10`);
});

program.parse(process.argv);

const options = program.opts();

function logInfo(msg) {
    if (options.log) {
        console.log(`[webifc2dtx] ${msg}`);
    }
}

function logError(msg) {
    console.error(`[webifc2dtx] ${msg}`);
}

try {
    if (!options.input) {
        logError(`Argument expected: -i`);
        process.exit(-1);
    }

    const startTime = new Date();

    const src = options.input;
    const sceneModelSrc = options.scenemodel;
    const dataModelSrc = options.datamodel;
    let dtxVersion = options.format;

    if (dtxVersion) {
        dtxVersion = Number.parseInt(dtxVersion);
        if (_SAVED_DTX_VERSIONS.includes(dtxVersion)) {
            logError(`Converting to DTX version: ${dtxVersion}`);
        } else {
            logError(`Target DTX version is not supported: ${dtxVersion}.`);
            if (_SAVED_DTX_VERSIONS.length > 1) {
                logError(`Supported DTX versions are: [${_SAVED_DTX_VERSIONS}]`);
            } else {
                logError(`Supported DTX version is: ${_SAVED_DTX_VERSIONS}`);
            }
            process.exit(-1);
            return;
        }
    } else {
        dtxVersion = _DEFAULT_SAVED_DTX_VERSION;
        logInfo(`Converting to DTX version: ${dtxVersion} (default)`);
    }

    const basePath = getBasePath(src);
    const fileData = fs.readFileSync(src);

    logInfo(`\nReading IFC file: ${src}`);

    const createDataModel = (dataModelSrc !== undefined);

    const ifcAPI = new WebIFC.IfcAPI();

    ifcAPI.Init().then(() => {

        webifc2dtx({
            ifcAPI,
            fileData,
            basePath,
            dtxVersion,
            createDataModel
        }).then(result => {

            const {dtxArrayBuffer, dataModelJSON} = result;
            const sceneModelDir = path.dirname(sceneModelSrc);

            if (sceneModelDir !== "" && !fs.existsSync(sceneModelDir)) {
                fs.mkdirSync(sceneModelDir, {recursive: true});
            }

            logInfo(`Writing DTX SceneModel file: ${sceneModelSrc}`);

            const dtxContent = Buffer.from(dtxArrayBuffer);
            fs.writeFileSync(sceneModelSrc, dtxContent);

            if (createDataModel && dataModelJSON) {
                const dataModelDir = path.dirname(dataModelSrc);
                if (dataModelDir !== "" && !fs.existsSync(dataModelDir)) {
                    fs.mkdirSync(dataModelDir, {recursive: true});
                }
                logInfo(`Writing JSON DataModel file: ${dataModelSrc}`);
                const dataModelContent = JSON.stringify(dataModelJSON);
                fs.writeFileSync(dataModelSrc, dataModelContent);
            }

            if (options.log) {
                const sourceFileSizeBytes = fileData.byteLength;
                const targetFileSizeBytes = dtxArrayBuffer.byteLength;
                const dtxSize = (targetFileSizeBytes / 1000).toFixed(2);
                const compressionRatio = (sourceFileSizeBytes / targetFileSizeBytes).toFixed(2);
                const conversionTime = ((new Date() - startTime) / 1000.0).toFixed(2);
                logInfo("Input IFC file size: " + (sourceFileSizeBytes / 1000).toFixed(2) + " kB");
                logInfo("Output DTX file size: " + dtxSize + " kB");
                logInfo("IFC->DTX compression ratio: " + compressionRatio);
                logInfo("Conversion time: " + conversionTime + " s");
                logInfo(`Converted SceneObjects: ${Object.keys(result.sceneModel.objects).length}`);
                logInfo(`Converted SceneMeshes: ${Object.keys(result.sceneModel.meshes).length}`);
                logInfo(`Converted SceneGeometries: ${Object.keys(result.sceneModel.geometries).length}`);
                logInfo(`Converted DataObjects: ${result.dataModel ? Object.keys(result.dataModel.objects).length : "N/A"}`);
                logInfo(`Converted PropertySets: ${result.dataModel ? Object.keys(result.dataModel.propertySets).length : "N/A"}`);
                logInfo(`Finished OK.`);
            }

            process.exit(1);
        });
    }).catch(err => {
        logError(`Failed to initialize WebIFC API - ${err}`);
        process.exit(-1);
    });

} catch (err) {
    logError(`Failed to convert IFC - ${err}`);
    process.exit(-1);
}

function getBasePath(src) {
    const i = src.lastIndexOf("/");
    return (i !== 0) ? src.substring(0, i + 1) : "";
}
