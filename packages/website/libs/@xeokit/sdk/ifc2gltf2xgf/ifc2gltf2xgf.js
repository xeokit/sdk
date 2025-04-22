#!/usr/bin/env node

const {
    gltf2xgf,
    _convertMetaModel,
    _SAVED_XGF_VERSIONS,
    _DEFAULT_SAVED_XGF_VERSION
} = require("./ifc2gltf2xgf.cjs.js");

const commander = require('commander');
const npmPackage = require('./../../package.json');
const fs = require('fs');
const path = require("path");
const program = new commander.Command();

program.version(npmPackage.version, '-v, --version');

program
    .description(`CLI to convert a manifest of glTF+JSON files from ifc2gltf into a manifest of XGF+JSON to load into a SceneModel+DataModel`)
    .option('-i, --input [file]', 'path to glTF+JSON manifest created by ifc2gltf (required)')
    .option('-o, --output [file]', 'path to target XGF+JSON manifest to create (required)')
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
        console.log(`[ifc2gltf2xgf] ${msg}`);
    }
}

function logError(msg) {
    console.error(`[ifc2gltf2xgf] ${msg}`);
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}-${month}-${year}- ${hours}-${minutes}-${seconds}`;
}

function getFileNameWithoutExtension(filePath) {
    return path.parse(path.basename(filePath)).name;
}

function getFileExtension(fileName) { // TODO: use node lib
    const parts = fileName.split('.');
    if (parts.length === 1) return '';
    return parts.pop();
}

try {
    if (!options.input) {
        logError(`Argument expected: -i`);
        process.exit(-1);
    }
    if (!options.output) {
        logError(`Argument expected: -o`);
        process.exit(-1);
    }

    const startTime = new Date();

    const gltfManifestSrc = options.input;
    const xgfChunkManifestSrc = options.output;

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

    const basePath = getBasePath(gltfManifestSrc);
    const gltfManifest = JSON.parse(fs.readFileSync(gltfManifestSrc));

    logInfo(`\nReading glTF manifest file: ${gltfManifestSrc}`);

    if (!gltfManifest.gltfOutFiles) {
        logError(`Input manifest invalid - missing field: gltfOutFiles`);
        process.exit(-11);
    }

    const numGLTFFiles = gltfManifest.gltfOutFiles ? gltfManifest.gltfOutFiles.length : 0;
    const numMetaDataFiles = gltfManifest.metadataOutFiles ? gltfManifest.metadataOutFiles.length : 0;
    const glTFFilesExist = numGLTFFiles > 0;
    const metaDataFilesExist = numMetaDataFiles > 0;

    if (numGLTFFiles === 0) {
        logError(`Input manifest invalid - gltfOutFiles array is zero length`);
        process.exit(1);
    }

    const outputDir = path.dirname(options.output);
    if (outputDir !== "" && !fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, {recursive: true});
    }

    const xgfChunkManifest = {
        sceneModelMIMEType: "arraybuffer",
        sceneModelFiles: [],
        dataModelFiles: []
    };

    const convertGLTFFiles = (done) => {

        let i = 0;

        const convertNextGLTFFile = () => {

            const gltfSrc = gltfManifest.gltfOutFiles[i];

            const gltfFileName = path.basename(gltfSrc);
            const gltfFullPath = path.join(basePath, gltfFileName);
            const outputFileName = getFileNameWithoutExtension(gltfSrc);
            const outputFileNameXGF = `${outputFileName}.xgf`;
            const fileData = fs.readFileSync(gltfFullPath);


            gltf2xgf({
                fileData,
                basePath,
                xgfVersion
            }).then(result => {

                const {xgfArrayBuffer} = result;
                const outputFilePathXGF = path.join(outputDir, outputFileNameXGF)

                logInfo(`Writing XGF+JSON files: ${outputFilePathXGF}`);

                const xktContent = Buffer.from(xgfArrayBuffer);

                fs.writeFileSync(outputFilePathXGF, xktContent);

                i++;

                logInfo(`Converted scene model ${gltfSrc} (${i} of ${numGLTFFiles})`);

                xgfChunkManifest.sceneModelFiles.push(outputFileNameXGF);

                if (i === numGLTFFiles) {
                    done()
                } else {
                    convertNextGLTFFile();
                }
            }).catch(err => {
                logError(err);
                process.exit(-1);
            });
        }

        convertNextGLTFFile();
    }

    const convertMetaModelFiles = (done) => {

        let i = 0;

        const convertNextMetaModelFile = () => {

            const metaModelSrc = gltfManifest.metadataOutFiles[i];
            const metaModelName = path.basename(metaModelSrc);
            const metaModelPath = path.join(basePath, metaModelName);
            const outputFileName = getFileNameWithoutExtension(metaModelName);
            const outputFileNameJSON = `${outputFileName}.json`;
            const outputDataModelJSONPath = path.join(outputDir, outputFileNameJSON)
            const metaModelParams = JSON.parse(fs.readFileSync(metaModelPath));

            const dataModelParams = _convertMetaModel(metaModelParams);

            fs.writeFileSync(outputDataModelJSONPath, JSON.stringify(dataModelParams));

            i++;

            logInfo(`Converted data model ${metaModelSrc} (${i} of ${numMetaDataFiles})`);

            xgfChunkManifest.dataModelFiles.push(outputFileNameJSON);

            if (i === numMetaDataFiles) {
                done();
            } else {
                convertNextMetaModelFile();
            }
        }

        convertNextMetaModelFile();
    }

    const done = () => {
        fs.writeFileSync(xgfChunkManifestSrc, JSON.stringify(xgfChunkManifest));
        const conversionTime = ((new Date() - startTime) / 1000.0).toFixed(2);
        logInfo("Conversion time: " + conversionTime + " s");
        logInfo(`Done.\n`);
        process.exit(0);
    }

    console.log("glTFFilesExist = " + glTFFilesExist)
    if (glTFFilesExist && metaDataFilesExist) {
        convertGLTFFiles(() => {
            convertMetaModelFiles(() => {
                done();
            })
        });
    } else if (glTFFilesExist) {
        convertGLTFFiles(() => {
            done();
        });
    } else if (metaDataFilesExist) {
        convertMetaModelFiles(() => {
            done();
        })
    } else {
        done();
    }

} catch (err) {
    logError(err);
    process.exit(-1);
}

function getBasePath(src) {
    const i = src.lastIndexOf("/");
    return (i !== 0) ? src.substring(0, i + 1) : "";
}
