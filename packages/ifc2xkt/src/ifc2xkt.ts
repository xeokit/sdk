import {Data} from "@xeokit/data";
import {Scene} from "@xeokit/scene";
import {SDKError} from "@xeokit/core";
import {saveXKT} from "@xeokit/xkt";
import {loadWebIFC} from "@xeokit/webifc";

const commander = require('commander');
const npmPackage = require('./package.json');
const fs = require('fs');

const program = new commander.Command();

program.version(npmPackage.version, '-v, --version');

program
    .option('-i, --source [file]', 'path to source IFC file')
    .option('-o, --output [file]', 'path to target XKT file');

program.on('--help', () => {
    console.log(`\n\nXKT version: 10`);
});

program.parse(process.argv);

const options = program.opts();

let fileData;

try {
    fileData = fs.readFileSync(options.source);
} catch (err) {
    // reject(err);
    // return;
}

const data = new Data();

const dataModel = data.createModel({
    id: "foo"
});

if (dataModel instanceof SDKError) {

} else {

    const scene = new Scene();

    const sceneModel = scene.createModel({
        id: "foo"
    });

    if (sceneModel instanceof SDKError) {

    } else {

        loadWebIFC({
            fileData,
            ifcAPI: null,
            dataModel,
            sceneModel
        })
            .then(() => {

                sceneModel.build().then(() => {

                    dataModel.build();

                    const xktArrayBuffer = saveXKT({
                        dataModel,
                        sceneModel
                    });

                    const outputDir = getBasePath(options.output).trim();
                    if (outputDir !== "" && !fs.existsSync(outputDir)) {
                        fs.mkdirSync(outputDir, {recursive: true});
                    }

                    fs.writeFileSync(options.output, Buffer.from(xktArrayBuffer));

                }).catch((reason)=>{

                });
            });
    }
}

function getBasePath(src) {
    const i = src.lastIndexOf("/");
    return (i !== 0) ? src.substring(0, i + 1) : "";
}