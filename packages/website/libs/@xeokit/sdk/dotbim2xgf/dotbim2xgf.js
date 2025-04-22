#!/usr/bin/env node

const {dotbim2xgf, _SAVED_XGF_VERSIONS, _DEFAULT_SAVED_XGF_VERSION} = require("./dotbim2xgf.cjs.js");

const commander = require('commander');
const npmPackage = require('./../../package.json');
const fs = require('fs');
const path = require("path");
const program = new commander.Command();

program.version(npmPackage.version, '-v, --version');

program
    .description(`CLI to convert a .BIM file into a xeokit XGF SceneModel file and/or a JSON DataModel file`)
    .option('-i, --input [file]', 'path to input .BIM model file (required)')
    .option('-s, --scenemodel [file]', 'path to target SceneModel XGF file (optional)')
    .option('-d, --datamodel [file]', 'path to target DataModel JSON file (optional)')
    .option('-f, --format [number]', `target XGF version (optional) - ${supportedXGF()}, default is ${_DEFAULT_SAVED_XGF_VERSION}`)
    .option('-l, --log', 'enable logging (optional)');

function supportedXGF() {
    if (_SAVED_XGF_VERSIONS.length > 1) {
        return `supported XGF versions are [${_SAVED_XGF_VERSIONS}]`;
    } else {
        return `supported XGF version is ${_DEFAULT_SAVED_XGF_VERSION}`;
    }
}

program.on('--help', () => {
    //  console.log(`\n\nXGF version: 10`);
});

program.parse(process.argv);

const options = program.opts();

function logInfo(msg) {
    if (options.log) {
        console.log(`[dotbim2xgf] ${msg}`);
    }
}

function logError(msg) {
    console.error(`[dotbim2xgf] ${msg}`);
}

try {
    if (!options.input) {
        logError(`Argument expected: -i`);
        process.exit(-1);
    }
    const startTime = new Date();

    const dotBIMSrc = options.input;
    const sceneModelSrc = options.scenemodel;
    const dataModelSrc = options.datamodel;
    let xgfVersion = options.format;

    if (xgfVersion) {
        xgfVersion = Number.parseInt(xgfVersion);
        if (_SAVED_XGF_VERSIONS.includes(xgfVersion)) {
            logError(`Converting to XGF version: ${xgfVersion}`);
        } else {
            logError(`Target XGF version is not supported: ${xgfVersion}.`);
            if (_SAVED_XGF_VERSIONS.length > 1) {
                logError(`Supported XGF versions are: [${_SAVED_XGF_VERSIONS}]`);
            } else {
                logError(`Supported XGF version is: ${_SAVED_XGF_VERSIONS}`);
            }
            process.exit(-1);
            return;
        }
    } else {
        xgfVersion = _DEFAULT_SAVED_XGF_VERSION;
        logInfo(`Converting to XGF version: ${xgfVersion} (default)`);
    }

    const basePath = getBasePath(dotBIMSrc);
    const fileData = JSON.parse(fs.readFileSync(dotBIMSrc));

    logInfo(`\nReading .BIM file: ${dotBIMSrc}`);

    const createDataModel = (dataModelSrc !== undefined);

    dotbim2xgf({
        fileData,
        basePath,
        xgfVersion,
        createDataModel
    }).then(result => {

        const {xgfArrayBuffer, dataModelParams} = result;
        const sceneModelDir = path.dirname(sceneModelSrc);

        if (sceneModelDir !== "" && !fs.existsSync(sceneModelDir)) {
            fs.mkdirSync(sceneModelDir, {recursive: true});
        }

        logInfo(`Writing XGF file: ${sceneModelSrc}`);

        const xktContent = Buffer.from(xgfArrayBuffer);
        fs.writeFileSync(sceneModelSrc, xktContent);

        if (createDataModel && dataModelParams) {
            const dataModelDir = path.dirname(dataModelSrc);
            if (dataModelDir !== "" && !fs.existsSync(dataModelDir)) {
                fs.mkdirSync(dataModelDir, {recursive: true});
            }
            logInfo(`Writing target DataModel JSON: ${dataModelSrc}`);
            const dataModelContent = JSON.stringify(dataModelParams);
            fs.writeFileSync(dataModelSrc, dataModelContent);
        }

        if (options.log) {
            const sourceFileSizeBytes = fileData.byteLength;
            const targetFileSizeBytes = xgfArrayBuffer.byteLength;
            const xgfSize = (targetFileSizeBytes / 1000).toFixed(2);
            const compressionRatio = (sourceFileSizeBytes / targetFileSizeBytes).toFixed(2);
            const conversionTime = ((new Date() - startTime) / 1000.0).toFixed(2);
            logInfo("Input .BIM file size: " + (sourceFileSizeBytes / 1000).toFixed(2) + " kB");
            logInfo("Output XGF file size: " + xgfSize + " kB");
            logInfo(".BIM->XGF compression ratio: " + compressionRatio);
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
} catch (err) {
    logError(err);
    process.exit(-1);
}

function getBasePath(src) {
    const i = src.lastIndexOf("/");
    return (i !== 0) ? src.substring(0, i + 1) : "";
}
