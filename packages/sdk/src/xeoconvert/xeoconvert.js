#!/usr/bin/env node

const yargs = require("yargs/yargs");
const {hideBin} = require("yargs/helpers");
const {getModelConverter} = require("./xeoconvert_core.cjs.js");
const npmPackage = require('./../../package.json');
const fs = require('fs');
const path = require("path");


const argv = yargs(hideBin(process.argv)).argv;

if (!argv.pipeline) {
    console.error("Error: Missing required argument --pipeline");
    process.exit(1);
}

const logEnabled = argv.log;

function logInfo(msg) {
    if (logEnabled) {
        console.log(`[xeoconvert] ${msg}`);
    }
}

function logError(msg) {
    console.error(`[xeoconvert] ${msg}`);
}

const manifest = argv.manifest;
if (manifest) {

}

getModelConverter({})
    .then(modelConverter => {
        try {

            const pipeline = modelConverter.pipelines[argv.pipeline];
            if (!pipeline) {
                logError(`Error: Unknown pipeline '${pipeline}'. Available options: ${Object.keys(modelConverter.pipelines).join(", ")}`);
                process.exit(-1);
                return;
            }

            for (let inputId in pipeline.inputs) {
                if (!argv[inputId]) {
                    logError(`Error: Missing input argument --${inputId}, required for --pipeline ${argv.pipeline}`);
                    process.exit(1);
                }
            }

            for (let outputId in pipeline.outputs) {
                if (!argv[outputId]) {
                    logError(`Error: Missing output argument --${outputId}, required for --pipeline ${argv.pipeline}`);
                    process.exit(1);
                }
            }

            // for (let argId in argv) {
            //     if (argId !== "pipeline" && !pipeline.inputs[argId] && !pipeline.outputs[argId]) {
            //         logError(`Error: Unexpected argument --${argId}, not required for --pipeline ${argv.pipeline}`);
            //         process.exit(1);
            //     }
            // }

            const conversionParams = {
                pipeline: argv.pipeline,
                inputs: {}
            };

            for (let inputId in pipeline.inputs) {
                logInfo(`Loading input --${inputId} ${argv[inputId]}`);
                conversionParams.inputs[inputId] = fs.readFileSync(argv[inputId]);
            }

            logInfo(`Running conversion pipeline ${argv.pipeline}`);

            modelConverter.convert(conversionParams)
                .then(conversionResult => {
                    for (let outputId in conversionResult.outputs) {
                        const output = conversionResult.outputs[outputId];
                        const outFilePath = argv[outputId];
                        if (!outFilePath) {
                            continue;
                        }
                        const dirName = path.dirname(outFilePath);
                        if (dirName !== "" && !fs.existsSync(dirName)) {
                            fs.mkdirSync(dirName, {recursive: true});
                        }
                        switch (output.fileDataType) {
                            case "json":
                                logInfo(`Writing output --${outputId} ${outFilePath}`);
                                fs.writeFileSync(outFilePath, JSON.stringify(output.fileData));
                                break;
                            case "arraybuffer":
                                logInfo(`Writing output --${outputId} ${outFilePath}`);
                                fs.writeFileSync(outFilePath, Buffer.from(output.fileData));
                                break;
                            default:
                                logError(`Internal error: Unsupported exporter fileDataType: "${output.fileDataType}"`);
                                process.exit(-1);
                                return;
                        }
                    }

                    // if (options.log) {
                    //     const sourceFileSizeBytes = fileData.byteLength;
                    //     const targetFileSizeBytes = targetFileData.byteLength;
                    //     const targetFileSizeKBytes = (targetFileSizeBytes / 1000).toFixed(2);
                    //     const compressionRatio = (sourceFileSizeBytes / targetFileSizeBytes).toFixed(2);
                    //     const conversionTime = ((new Date() - startTime) / 1000.0).toFixed(2);
                    //     logInfo("Source file size: " + (sourceFileSizeBytes / 1000).toFixed(2) + " kB");
                    //     logInfo("Target file size: " + targetFileSizeKBytes + " kB");
                    //     logInfo("Compression ratio: " + compressionRatio);
                    //     logInfo("Conversion time: " + conversionTime + " s");
                    //     logInfo(`Converted SceneObjects: ${Object.keys(conversionResult.sceneModel.objects).length}`);
                    //     logInfo(`Converted SceneMeshes: ${Object.keys(conversionResult.sceneModel.meshes).length}`);
                    //     logInfo(`Converted SceneGeometries: ${Object.keys(conversionResult.sceneModel.geometries).length}`);
                    //     logInfo(`Converted DataObjects: ${conversionResult.dataModel ? Object.keys(conversionResult.dataModel.objects).length : "N/A"}`);
                    //     logInfo(`Converted PropertySets: ${conversionResult.dataModel ? Object.keys(conversionResult.dataModel.propertySets).length : "N/A"}`);
                    //     logInfo(`Finished OK.`);
                    // }

                    logInfo(`Done.`);

                    process.exit(1);
                });
        } catch (err) {
            logError(err);
            process.exit(-1);
        }
    }).catch(err => {
    logError(err);
    process.exit(-1);
});
