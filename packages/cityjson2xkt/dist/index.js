var data = require('@xeokit/data');
var scene = require('@xeokit/scene');
var core = require('@xeokit/core');
var cityjson = require('@xeokit/cityjson');
var xkt = require('@xeokit/xkt');

const commander = require('commander');
const npmPackage = require('./package.json');
const fs = require('fs');
const program = new commander.Command();
program.version(npmPackage.version, '-v, --version');
program.option('-i, --input [file]', 'path to input CityJSON file').option('-o, --output [file]', 'path to output XKT file');
program.on('--help', () => {
  console.log(`\n\nXKT version: 10`);
});
program.parse(process.argv);
const options = program.opts();
if (options.input === undefined) {
  console.error('[cityjson2xkt] Error: please specify a path to a CityJSON input file (-i).');
  program.help();
  process.exit(1);
}
if (options.output === undefined) {
  console.error('[cityjson2xkt] Error: please specify output XKT file path (-o).');
  program.help();
  process.exit(1);
}
function log(msg) {
  if (options.log) {
    console.log(msg);
  }
}
async function main() {
  log(`[cityjson2xkt] Running cityjson2xkt v${npmPackage.version}...`);
  log(`[cityjson2xkt] Reading CityJSON file ${options.input}...`);
  let fileData;
  try {
    fileData = fs.readFileSync(options.input);
  } catch (err) {
    console.error(`[cityjson2xkt] Error reading CityJSON file: ${err}`);
    process.exit(1);
  }
  const data$1 = new data.Data();
  const dataModel = data$1.createModel({
    id: "foo"
  });
  if (dataModel instanceof core.SDKError) {
    console.error(`[cityjson2xkt] Error converting CityJSON file: ${dataModel.message}`);
    process.exit(1);
  } else {
    const scene$1 = new scene.Scene();
    const sceneModel = scene$1.createModel({
      id: "foo"
    });
    if (sceneModel instanceof core.SDKError) {
      console.error(`[cityjson2xkt] Error converting CityJSON file: ${sceneModel.message}`);
      process.exit(1);
    } else {
      cityjson.loadCityJSON({
        fileData,
        dataModel,
        sceneModel
      }).then(() => {
        sceneModel.build().then(() => {
          dataModel.build();
          const xktArrayBuffer = xkt.saveXKT({
            dataModel,
            sceneModel
          });
          const outputDir = getBasePath(options.output).trim();
          if (outputDir !== "" && !fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, {
              recursive: true
            });
          }
          fs.writeFileSync(options.output, Buffer.from(xktArrayBuffer));
          log(`[cityjson2xkt] Created XKT file: ${options.output}`);
          process.exit(0);
        }).catch(err => {
          console.error(`[cityjson2xkt] Error converting CityJSON file: ${err}`);
          process.exit(1);
        });
      }).catch(err => {
        console.error(`[cityjson2xkt] Error converting CityJSON file: ${err}`);
        process.exit(1);
      });
    }
  }
}
function getBasePath(src) {
  const i = src.lastIndexOf("/");
  return i !== 0 ? src.substring(0, i + 1) : "";
}
main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
//# sourceMappingURL=index.js.map
