#!/usr/bin/env node
import {Data} from "@xeokit/data";
import {Scene} from "@xeokit/scene";
import {SDKError} from "@xeokit/core";
import {loadCityJSON} from "@xeokit/cityjson";
import {saveXKT} from "dtx";

const commander = require('commander');
const npmPackage = require('./package.json');
const fs = require('fs');

const program = new commander.Command();

program.version(npmPackage.version, '-v, --version');

program
    .option('-i, --input [file]', 'path to input CityJSON file')
    .option('-o, --output [file]', 'path to output XKT file');

program.on('--help', () => {
    console.log(`\n\nXKT version: 10`);
});

program.parse(process.argv);

const options = program.opts();

if (options.input === undefined) {
    console.error('[cityjson2dtx] Error: please specify a path to a CityJSON input file (-i).');
    program.help();
    process.exit(1);
}

if (options.output === undefined) {
    console.error('[cityjson2dtx] Error: please specify output XKT file path (-o).');
    program.help();
    process.exit(1);
}

function log(msg) {
    if (options.log) {
        console.log(msg);
    }
}

async function main() {

    log(`[cityjson2dtx] Running cityjson2dtx v${npmPackage.version}...`);
    log(`[cityjson2dtx] Reading CityJSON file ${options.input}...`);

    let fileData;

    try {
        fileData = fs.readFileSync(options.input);
    } catch (err) {
        console.error(`[cityjson2dtx] Error reading CityJSON file: ${err}`);
        process.exit(1);
    }

    const data = new Data();

    const dataModel = data.createModel({
        id: "foo"
    });

    if (dataModel instanceof SDKError) {
        console.error(`[cityjson2dtx] Error converting CityJSON file: ${dataModel.message}`);
        process.exit(1);
    } else {
        const scene = new Scene();
        const sceneModel = scene.createModel({
            id: "foo"
        });
        if (sceneModel instanceof SDKError) {
            console.error(`[cityjson2dtx] Error converting CityJSON file: ${sceneModel.message}`);
            process.exit(1);
        } else {
            loadCityJSON({fileData, dataModel, sceneModel}).then(() => {
                sceneModel.build().then(() => {
                    dataModel.build();
                    const dtxArrayBuffer = saveXKT({dataModel, sceneModel});
                    const outputDir = getBasePath(options.output).trim();
                    if (outputDir !== "" && !fs.existsSync(outputDir)) {
                        fs.mkdirSync(outputDir, {recursive: true});
                    }
                    fs.writeFileSync(options.output, Buffer.from(dtxArrayBuffer));
                    log(`[cityjson2dtx] Created XKT file: ${options.output}`);
                    process.exit(0);
                }).catch((err) => {
                    console.error(`[cityjson2dtx] Error converting CityJSON file: ${err}`);
                    process.exit(1);
                });
            }).catch((err) => {
                console.error(`[cityjson2dtx] Error converting CityJSON file: ${err}`);
                process.exit(1);
            });
        }
    }
}

function getBasePath(src) {
    const i = src.lastIndexOf("/");
    return (i !== 0) ? src.substring(0, i + 1) : "";
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});