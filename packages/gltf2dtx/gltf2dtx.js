#!/usr/bin/env node

const {gltf2DTX, _SAVED_DTX_VERSIONS, _DEFAULT_SAVED_DTX_VERSION} = require("./dist/gltf2dtx.cjs.js");

const commander = require('commander');
const npmPackage = require('./package.json');
const fs = require('fs');
const path = require("path");
const program = new commander.Command();

program.version(npmPackage.version, '-v, --version');

program
    .description(`CLI to convert glTF files into xeokit's compact DTX format`)
    .option('-i, --source [file]', 'path to source glTF model file (required)')
    .option('-o, --output [file]', 'path to target DTX model file (required)')
    .option('-d, --datamodel [file]', 'path to target DataModel JSON file (optional)')
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
        console.log(`[gltf2DTX] ${msg}`);
    }
}

function logError(msg) {
        console.error(`[gltf2DTX] ${msg}`);
}

try {
    if (!options.source) {
        logError(`Argument expected: -i`);
        process.exit(-1);
    }
    if (!options.output) {
        logError(`Argument expected: -o`);
        process.exit(-1);
    }

    const startTime = new Date();

    const src = options.source;
    const output = options.output;
    const outputJSON= options.datamodel;
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

    logInfo(`Reading glTF file: ${src}`);

    const createDataModel = (outputJSON !== undefined);

    gltf2DTX({
        fileData,
        basePath,
        dtxVersion,
        createDataModel
    }).then(result => {

        const {dtxArrayBuffer, dataModelJSON} = result;
        const outputXKTDir = path.dirname(output);

        if (outputXKTDir !== "" && !fs.existsSync(outputXKTDir)) {
            fs.mkdirSync(outputXKTDir, {recursive: true});
        }

        logInfo(`Writing DTX file: ${output}`);

        const xktContent = Buffer.from(dtxArrayBuffer);
        fs.writeFileSync(output, xktContent);

        if (createDataModel && dataModelJSON) {
            const outputJSONDir = path.dirname(outputJSON);
            if (outputJSONDir !== "" && !fs.existsSync(outputJSONDir)) {
                fs.mkdirSync(outputJSONDir, {recursive: true});
            }
            logInfo(`Writing target DataModel JSON: ${outputJSON}`);
            const dataModelContent = JSON.stringify(dataModelJSON);
            fs.writeFileSync(outputJSON, dataModelContent);
        }

        if (options.log) {
            const sourceFileSizeBytes = fileData.byteLength;
            const targetFileSizeBytes = dtxArrayBuffer.byteLength;
            const dtxSize = (targetFileSizeBytes / 1000).toFixed(2);
            const compressionRatio = (sourceFileSizeBytes / targetFileSizeBytes).toFixed(2);
            const conversionTime = ((new Date() - startTime) / 1000.0).toFixed(2);
            logInfo("Input glTF file size: " + (sourceFileSizeBytes / 1000).toFixed(2) + " kB");
            logInfo("Output DTX file size: " + dtxSize + " kB");
            logInfo("glTF->DTX compression ratio: " + compressionRatio);
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
