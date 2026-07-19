const fs = require('fs');
const path = require('path');
const gulp = require('gulp');
const fileinclude = require('gulp-file-include');
const rename = require("gulp-rename");
const replace = require('gulp-replace-task');
const commander = require('commander');

const program = new commander.Command();

program
  .description(`CLI to build website pages`)
  .option('-l, --local', 'build pages to test locally (optional)');

program.parse(process.argv);

const options = program.opts();

const siteBase = "https://xeokit.github.io/sdk/";

function outputBase(localBase) {
  return options.local ? localBase : siteBase;
}


/*----------------------------------------------------------------------------------------
 *
 *
 *---------------------------------------------------------------------------------------*/

function compileExamples() {
  console.log("Compiling examples");

  const baseDir = "./examples/";
  const index = {};

  try {

    const files = fs.readdirSync(baseDir);

    files.forEach(file => {

      const exampleDirPath = path.join(baseDir, file);
      const stats = fs.statSync(exampleDirPath);

      if (stats.isDirectory()) {

        const indexJSONPath = path.join(exampleDirPath, 'index.json');
        const indexJSPath = path.join(exampleDirPath, 'index.js');

        if (fs.existsSync(indexJSONPath)) {

          console.log("Compiling example:" + exampleDirPath);

          try {
            const exampleInfo = JSON.parse(fs.readFileSync(indexJSONPath, 'utf8'));

            exampleInfo.id = file;

            if (exampleInfo.template) {

              console.log("Compiling example template:" + exampleInfo.template);
              const exampleBase = outputBase("../..");

              gulp.src([`./templates/${exampleInfo.template}.html`])
                .pipe(
                  replace({
                    patterns: [
                      {
                        match: 'base',
                        replacement: exampleBase
                      },
                      {
                        match: 'title',
                        replacement: exampleInfo.title
                      }
                    ]
                  })
                )
                .pipe(fileinclude({}))
                .pipe(rename("index.html"))
                .pipe(gulp.dest(`${exampleDirPath}/`))
                .on('end', function () {
                });

              fs.cpSync(`./templates/${exampleInfo.template}.html`, `${exampleDirPath}/index.html`);
            }

            if (fs.existsSync(indexJSPath)) {

              const trimmedExampleInfo = {
                id: exampleInfo.id,
                title: exampleInfo.title,
                description: exampleInfo.description || "",
                isTutorial: !!exampleInfo.isTutorial,
                isVisualTest: !!exampleInfo.isVisualTest,
                categories: exampleInfo.categories || []
              };
              if (exampleInfo.template) {
                trimmedExampleInfo.template = exampleInfo.template;
              }
              if (exampleInfo.isShowcased) {
                trimmedExampleInfo.isShowcased = true;
              }
              fs.writeFileSync(indexJSONPath, JSON.stringify(trimmedExampleInfo, null, 2));

              index[exampleInfo.id] = trimmedExampleInfo;
            }
          } catch (err) {
            console.error(`Error reading or parsing JSON in file: ${indexJSONPath}`, err);
          }
        } else {
          console.log(`index.json not found:  ${indexJSONPath}`);
        }
      }
    });
  } catch (err) {
    console.error(`Error reading directory: ${err}`);
  }
  fs.writeFileSync("./examples/index.json", JSON.stringify(index, null, 2), 'utf8');
}

function compileSitePages() {
  const pageBuilds = [
    {template: "./templates/examples-index.html", dest: "./examples/", renameTo: "index.html", localBase: ".."},
    {template: "./templates/models-index.html", dest: "./models/", renameTo: "index.html", localBase: ".."},
    {template: "./templates/index.html", dest: "./", localBase: "."},
    {template: "./templates/api-docs.html", dest: "./", localBase: "."}
  ];

  for (const pageBuild of pageBuilds) {
    const pageBase = outputBase(pageBuild.localBase);
    let stream = gulp.src([pageBuild.template])
      .pipe(
        replace({
          patterns: [
            {
              match: 'base',
              replacement: pageBase
            }
          ]
        })
      )
      .pipe(fileinclude({}));

    if (pageBuild.renameTo) {
      stream = stream.pipe(rename(pageBuild.renameTo));
    }

    stream
      .pipe(gulp.dest(pageBuild.dest))
      .on('end', function () {
      });
  }
}

compileExamples();
compileSitePages();
